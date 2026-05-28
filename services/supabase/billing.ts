import { supabase } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decrementStock } from './inventory';

export interface LocalBillItem {
  name: string;
  barcode?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface LocalBill {
  id: string;
  billNumber: string;
  phone: string;
  items: LocalBillItem[];
  total: number;
  createdAt: string;
  synced: boolean;
  retryCount?: number;
  nextRetryTime?: string;
}

const PENDING_BILLS_KEY = '@pending_bills';
const LOCAL_HISTORY_CACHE_KEY = '@local_history_cache';

export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    await fetch('https://www.google.com', { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
};

export const generateBillNumber = async (): Promise<string> => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const key = `@bill_counter_${dateStr}`;
  
  const currentVal = await AsyncStorage.getItem(key);
  let nextCounter = 1;
  if (currentVal) {
    nextCounter = parseInt(currentVal) + 1;
  }
  await AsyncStorage.setItem(key, nextCounter.toString());
  
  const formattedCounter = String(nextCounter).padStart(4, '0');
  return `KB-${dateStr}-${formattedCounter}`;
};

export const createBill = async (
  phone: string,
  items: Array<{ name: string; price: number; quantity: number; barcode?: string }>,
  total: number
): Promise<LocalBill> => {
  const billNumber = await generateBillNumber();
  const localId = Math.random().toString(36).substring(2, 15);
  const createdAt = new Date().toISOString();

  const formattedItems: LocalBillItem[] = items.map((item) => ({
    name: item.name,
    barcode: item.barcode,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.price * item.quantity,
  }));

  const localBill: LocalBill = {
    id: localId,
    billNumber,
    phone,
    items: formattedItems,
    total,
    createdAt,
    synced: false,
    retryCount: 0,
    nextRetryTime: new Date().toISOString(),
  };

  const isOnline = await checkInternetConnection();
  if (isOnline) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        const { data: billData, error: billError } = await supabase
          .from('bills')
          .insert([{
            user_id: userData.id,
            bill_number: billNumber,
            total,
            created_at: createdAt,
          }])
          .select('id')
          .single();

        if (billError) throw billError;

        const itemsToInsert = formattedItems.map((item) => ({
          bill_id: billData.id,
          product_name: item.name,
          barcode: item.barcode || null,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        }));

        const { error: itemsError } = await supabase
          .from('bill_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        localBill.synced = true;
        localBill.id = billData.id;

        // Fire-and-forget stock decrement — must never block or fail bill creation.
        // We look up each item's inventory_items row by barcode and decrement qty.
        try {
          for (const item of formattedItems) {
            if (!item.barcode) continue;

            // Resolve the inventory_items id for this barcode under this user.
            const { data: invRow } = await supabase
              .from('inventory_items')
              .select('id')
              .eq('user_id', userData.id)
              .eq('barcode', item.barcode)
              .maybeSingle();

            if (invRow?.id) {
              // Intentionally not awaited — fire-and-forget per spec.
              decrementStock(invRow.id, item.quantity).catch((e: unknown) =>
                console.warn('[billing] background decrementStock failed:', e)
              );
            }
          }
        } catch (stockErr) {
          // Stock decrement errors are non-fatal — bill is already saved.
          console.warn('[billing] stock decrement lookup failed:', stockErr);
        }

        await cacheCompletedBill(localBill);
        return localBill;
      }
    } catch (error) {
      console.warn('Online bill save failed, queueing offline:', error);
    }
  }

  await queueOfflineBill(localBill);
  return localBill;
};

const queueOfflineBill = async (bill: LocalBill) => {
  try {
    const stored = await AsyncStorage.getItem(PENDING_BILLS_KEY);
    const list = stored ? (JSON.parse(stored) as LocalBill[]) : [];
    list.push(bill);
    await AsyncStorage.setItem(PENDING_BILLS_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Failed to queue bill locally:', error);
  }
};

const cacheCompletedBill = async (bill: LocalBill) => {
  try {
    const stored = await AsyncStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    const list = stored ? (JSON.parse(stored) as LocalBill[]) : [];
    list.unshift(bill);
    await AsyncStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (error) {
    console.error('Failed to cache completed bill:', error);
  }
};

export const syncPendingBills = async (): Promise<{ successCount: number; failedCount: number }> => {
  const isOnline = await checkInternetConnection();
  if (!isOnline) {
    return { successCount: 0, failedCount: 0 };
  }

  const stored = await AsyncStorage.getItem(PENDING_BILLS_KEY);
  if (!stored) return { successCount: 0, failedCount: 0 };

  const pendingList = JSON.parse(stored) as LocalBill[];
  if (pendingList.length === 0) return { successCount: 0, failedCount: 0 };

  const stillPending: LocalBill[] = [];
  let successCount = 0;
  let failedCount = 0;

  const nowTime = Date.now();

  for (const bill of pendingList) {
    // Check if next retry is in the future
    if (bill.nextRetryTime && new Date(bill.nextRetryTime).getTime() > nowTime) {
      stillPending.push(bill);
      continue;
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', bill.phone)
        .maybeSingle();

      if (userError || !userData) {
        throw userError || new Error('User not found in database.');
      }

      const { data: billData, error: billError } = await supabase
        .from('bills')
        .insert([{
          user_id: userData.id,
          bill_number: bill.billNumber,
          total: bill.total,
          created_at: bill.createdAt,
        }])
        .select('id')
        .single();

      if (billError) throw billError;

      const itemsToInsert = bill.items.map((item) => ({
        bill_id: billData.id,
        product_name: item.name,
        barcode: item.barcode || null,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('bill_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      const syncedBill = { ...bill, synced: true, id: billData.id };
      await cacheCompletedBill(syncedBill);
      successCount++;
    } catch (e) {
      console.error(`Failed to sync bill ${bill.billNumber}:`, e);
      
      const retryCount = (bill.retryCount || 0) + 1;
      // Exponential backoff: 2^retryCount * 10 seconds. Cap at 30 minutes (1800000ms).
      const backoffMs = Math.min(Math.pow(2, retryCount) * 10 * 1000, 1800000);
      const nextRetryTime = new Date(Date.now() + backoffMs).toISOString();

      stillPending.push({
        ...bill,
        retryCount,
        nextRetryTime,
      });
      failedCount++;
    }
  }

  await AsyncStorage.setItem(PENDING_BILLS_KEY, JSON.stringify(stillPending));
  return { successCount, failedCount };
};

export const getBillsHistory = async (phone: string): Promise<LocalBill[]> => {
  await syncPendingBills();

  const isOnline = await checkInternetConnection();
  let dbBills: LocalBill[] = [];

  if (isOnline) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        const { data: billsData, error: billsError } = await supabase
          .from('bills')
          .select(`
            id,
            bill_number,
            total,
            created_at,
            bill_items (
              product_name,
              barcode,
              quantity,
              price,
              subtotal
            )
          `)
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false });

        if (billsError) throw billsError;

        if (billsData) {
          dbBills = billsData.map((b: any) => ({
            id: b.id,
            billNumber: b.bill_number,
            phone,
            total: parseFloat(b.total),
            createdAt: b.created_at,
            synced: true,
            items: b.bill_items.map((i: any) => ({
              name: i.product_name,
              barcode: i.barcode,
              quantity: i.quantity,
              price: parseFloat(i.price),
              subtotal: parseFloat(i.subtotal),
            })),
          }));

          await AsyncStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(dbBills));
        }
      }
    } catch (error) {
      console.warn('Failed to fetch bills history from Supabase, loading from cache:', error);
    }
  }

  if (dbBills.length === 0) {
    const cached = await AsyncStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    if (cached) {
      dbBills = JSON.parse(cached) as LocalBill[];
    }
  }

  const storedPending = await AsyncStorage.getItem(PENDING_BILLS_KEY);
  const pendingList = storedPending
    ? (JSON.parse(storedPending) as LocalBill[]).filter((b) => b.phone === phone)
    : [];

  return [...pendingList, ...dbBills];
};

export const getBillById = async (id: string): Promise<LocalBill | null> => {
  const pending = await AsyncStorage.getItem(PENDING_BILLS_KEY);
  if (pending) {
    const list = JSON.parse(pending) as LocalBill[];
    const found = list.find((b) => b.id === id);
    if (found) return found;
  }

  const cached = await AsyncStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
  if (cached) {
    const list = JSON.parse(cached) as LocalBill[];
    const found = list.find((b) => b.id === id);
    if (found) return found;
  }

  const isOnline = await checkInternetConnection();
  if (isOnline) {
    try {
      const { data: b, error } = await supabase
        .from('bills')
        .select(`
          id,
          bill_number,
          total,
          created_at,
          users (phone),
          bill_items (
            product_name,
            barcode,
            quantity,
            price,
            subtotal
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (b) {
        return {
          id: b.id,
          billNumber: b.bill_number,
          phone: b.users?.phone || '',
          total: parseFloat(b.total),
          createdAt: b.created_at,
          synced: true,
          items: b.bill_items.map((i: any) => ({
            name: i.product_name,
            barcode: i.barcode,
            quantity: i.quantity,
            price: parseFloat(i.price),
            subtotal: parseFloat(i.subtotal),
          })),
        };
      }
    } catch (err) {
      console.error('Failed to fetch detailed bill by id:', err);
    }
  }

  return null;
};
