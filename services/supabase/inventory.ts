import { supabase } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  barcode: string | null;
  quantity: number;
  unit: string;
  costPrice: number;
  sellPrice: number;
  lowStockThreshold: number;
  expiryDate: string | null; // ISO date string (YYYY-MM-DD) or null
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a raw Supabase row to the camelCase InventoryItem shape. */
function mapRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    barcode: (row.barcode as string | null) ?? null,
    quantity: parseFloat(String(row.quantity)),
    unit: row.unit as string,
    costPrice: parseFloat(String(row.cost_price)),
    sellPrice: parseFloat(String(row.sell_price)),
    lowStockThreshold: parseInt(String(row.low_stock_threshold), 10),
    expiryDate: (row.expiry_date as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Resolve the Supabase user UUID from a phone number.
 * Returns null when the user is not found or a network/DB error occurs.
 */
async function resolveUserId(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    console.error('[inventory] resolveUserId error:', error);
    return null;
  }

  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all inventory items for a store owner, ordered alphabetically by name.
 * Returns an empty array on error so callers never crash.
 */
export const getInventory = async (phone: string): Promise<InventoryItem[]> => {
  try {
    const userId = await resolveUserId(phone);
    if (!userId) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(mapRow);
  } catch (err) {
    console.error('[inventory] getInventory error:', err);
    return [];
  }
};

/**
 * Add a new product to the store's inventory.
 * Throws a user-readable error on failure.
 */
export const addInventoryItem = async (
  phone: string,
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<InventoryItem> => {
  const userId = await resolveUserId(phone);
  if (!userId) throw new Error('Store account not found. Please log in again.');

  const { data, error } = await supabase
    .from('inventory_items')
    .insert([
      {
        user_id: userId,
        name: item.name,
        barcode: item.barcode ?? null,
        quantity: item.quantity,
        unit: item.unit,
        cost_price: item.costPrice,
        sell_price: item.sellPrice,
        low_stock_threshold: item.lowStockThreshold,
        expiry_date: item.expiryDate ?? null,
        category: item.category ?? null,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('[inventory] addInventoryItem error:', error);
    throw new Error('Could not add item to inventory. Please try again.');
  }

  return mapRow(data);
};

/**
 * Update one or more fields of an existing inventory item.
 * Always sets `updated_at` to the current timestamp.
 * Throws a user-readable error on failure.
 */
export const updateInventoryItem = async (
  id: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>
): Promise<InventoryItem> => {
  // Build the snake_case payload that Supabase expects.
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.barcode !== undefined) payload.barcode = updates.barcode;
  if (updates.quantity !== undefined) payload.quantity = updates.quantity;
  if (updates.unit !== undefined) payload.unit = updates.unit;
  if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
  if (updates.sellPrice !== undefined) payload.sell_price = updates.sellPrice;
  if (updates.lowStockThreshold !== undefined) payload.low_stock_threshold = updates.lowStockThreshold;
  if (updates.expiryDate !== undefined) payload.expiry_date = updates.expiryDate;
  if (updates.category !== undefined) payload.category = updates.category;

  const { data, error } = await supabase
    .from('inventory_items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[inventory] updateInventoryItem error:', error);
    throw new Error('Could not update inventory item. Please try again.');
  }

  return mapRow(data);
};

/**
 * Permanently delete an inventory item by its UUID.
 * Throws a user-readable error on failure.
 */
export const deleteInventoryItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[inventory] deleteInventoryItem error:', error);
    throw new Error('Could not delete inventory item. Please try again.');
  }
};

/**
 * Decrement the stock quantity for an item after a sale.
 * Floors at 0 — stock can never go negative.
 * Designed to be fire-and-forget: logs errors without throwing.
 */
export const decrementStock = async (itemId: string, quantity: number): Promise<void> => {
  try {
    const { data, error: fetchError } = await supabase
      .from('inventory_items')
      .select('quantity')
      .eq('id', itemId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!data) return; // Item not in inventory — nothing to decrement.

    const currentQty = parseFloat(String(data.quantity));
    const newQty = Math.max(0, currentQty - quantity);

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (updateError) throw updateError;
  } catch (err) {
    // Never crash bill creation — log only.
    console.error('[inventory] decrementStock error:', err);
  }
};

/**
 * Return items whose current quantity is at or below their low-stock threshold.
 */
export const getLowStockItems = async (phone: string): Promise<InventoryItem[]> => {
  const items = await getInventory(phone);
  return items.filter((item) => item.quantity <= item.lowStockThreshold);
};

/**
 * Return items whose expiry date falls within the next `daysAhead` days (inclusive).
 * Items with no expiry date are excluded.
 */
export const getExpiringItems = async (
  phone: string,
  daysAhead: number = 7
): Promise<InventoryItem[]> => {
  const items = await getInventory(phone);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return items.filter((item) => {
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today && expiry <= cutoff;
  });
};
