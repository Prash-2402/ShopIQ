import { supabase } from './config';

export interface OnlineOrder {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string | null;
  items: Array<{ name: string; price: number; quantity: number }>;
  total: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  createdAt: string;
}

// Internal helper to get userId
async function resolveUserId(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (error) {
    console.error('[onlineStore] resolveUserId error:', error);
    return null;
  }
  return data?.id ?? null;
}

export const getOnlineOrders = async (phone: string): Promise<OnlineOrder[]> => {
  try {
    const userId = await resolveUserId(phone);
    if (!userId) return [];

    const { data, error } = await supabase
      .from('online_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const orders = (data ?? []).map(row => ({
      id: row.id,
      userId: row.user_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      total: parseFloat(String(row.total)),
      status: row.status,
      createdAt: row.created_at,
    })) as OnlineOrder[];

    // fetch pending orders first, then others
    return orders.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });
  } catch (err) {
    console.error('[onlineStore] getOnlineOrders error:', err);
    return [];
  }
};

export const fulfillOrder = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from('online_orders')
    .update({ status: 'fulfilled' })
    .eq('id', orderId);
    
  if (error) throw new Error('Could not fulfill order: ' + error.message);
};

export const cancelOrder = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from('online_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);
    
  if (error) throw new Error('Could not cancel order: ' + error.message);
};

export const getStoreShareLink = (phone: string, storeName: string): string => {
  // this is just a formatted URL, no API call
  return `https://shopiq.app/store/${phone.replace('+', '')}`;
};
