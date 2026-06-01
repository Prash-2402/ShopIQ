import { supabase } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  productsSupplied: string[];
  notes: string | null;
  /** 0–100. 100 = perfectly reliable. */
  reliabilityScore: number;
  createdAt: string;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  amount: number;
  /** ISO date string (YYYY-MM-DD) or null when no due date is set. */
  dueDate: string | null;
  paid: boolean;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveUserId(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    console.error('[suppliers] resolveUserId error:', error);
    return null;
  }

  return data?.id ?? null;
}

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    productsSupplied: (row.products_supplied as string[] | null) ?? [],
    notes: (row.notes as string | null) ?? null,
    reliabilityScore: parseInt(String(row.reliability_score ?? 100), 10),
    createdAt: row.created_at as string,
  };
}

function mapInvoice(row: Record<string, unknown>): SupplierInvoice {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    amount: parseFloat(String(row.amount)),
    dueDate: (row.due_date as string | null) ?? null,
    paid: Boolean(row.paid),
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Supplier CRUD
// ---------------------------------------------------------------------------

/**
 * Fetch all suppliers for a store owner, ordered alphabetically.
 * Returns an empty array on error.
 */
export const getSuppliers = async (phone: string): Promise<Supplier[]> => {
  try {
    const userId = await resolveUserId(phone);
    if (!userId) return [];

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(mapSupplier);
  } catch (err) {
    console.error('[suppliers] getSuppliers error:', err);
    return [];
  }
};

/**
 * Add a new supplier for the store owner.
 * Throws a user-readable error on failure.
 */
export const addSupplier = async (
  phone: string,
  data: Omit<Supplier, 'id' | 'userId' | 'createdAt'>,
): Promise<Supplier> => {
  const userId = await resolveUserId(phone);
  if (!userId) throw new Error('Store account not found. Please log in again.');

  const { data: row, error } = await supabase
    .from('suppliers')
    .insert([
      {
        user_id: userId,
        name: data.name.trim(),
        phone: data.phone ?? null,
        products_supplied: data.productsSupplied ?? [],
        notes: data.notes ?? null,
        reliability_score: data.reliabilityScore ?? 100,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('[suppliers] addSupplier error:', error);
    throw new Error('Could not add supplier. Please try again.');
  }

  return mapSupplier(row);
};

/**
 * Update one or more fields of an existing supplier.
 * Throws a user-readable error on failure.
 */
export const updateSupplier = async (
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'userId' | 'createdAt'>>,
): Promise<Supplier> => {
  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.productsSupplied !== undefined) payload.products_supplied = updates.productsSupplied;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.reliabilityScore !== undefined) payload.reliability_score = updates.reliabilityScore;

  const { data: row, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[suppliers] updateSupplier error:', error);
    throw new Error('Could not update supplier. Please try again.');
  }

  return mapSupplier(row);
};

/**
 * Permanently delete a supplier and all their invoices (via DB cascade).
 * Throws a user-readable error on failure.
 */
export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);

  if (error) {
    console.error('[suppliers] deleteSupplier error:', error);
    throw new Error('Could not delete supplier. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Invoice functions
// ---------------------------------------------------------------------------

/**
 * Record a new invoice against a supplier.
 * Throws a user-readable error on failure.
 */
export const addSupplierInvoice = async (
  supplierId: string,
  amount: number,
  dueDate: string | null,
  notes: string | null,
): Promise<SupplierInvoice> => {
  if (amount <= 0) throw new Error('Invoice amount must be greater than zero.');

  const { data: row, error } = await supabase
    .from('supplier_invoices')
    .insert([
      {
        supplier_id: supplierId,
        amount,
        due_date: dueDate ?? null,
        paid: false,
        notes: notes?.trim() || null,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('[suppliers] addSupplierInvoice error:', error);
    throw new Error('Could not add invoice. Please try again.');
  }

  return mapInvoice(row);
};

/**
 * Fetch all invoices for a given supplier, newest first.
 * Returns an empty array on error.
 */
export const getSupplierInvoices = async (
  supplierId: string,
): Promise<SupplierInvoice[]> => {
  try {
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapInvoice);
  } catch (err) {
    console.error('[suppliers] getSupplierInvoices error:', err);
    return [];
  }
};

/**
 * Mark a supplier invoice as paid.
 * Throws a user-readable error on failure.
 */
export const markInvoicePaid = async (invoiceId: string): Promise<void> => {
  const { error } = await supabase
    .from('supplier_invoices')
    .update({ paid: true })
    .eq('id', invoiceId);

  if (error) {
    console.error('[suppliers] markInvoicePaid error:', error);
    throw new Error('Could not mark invoice as paid. Please try again.');
  }
};

/**
 * Return all unpaid invoices with a due_date before today, joined with the
 * supplier's name. Results ordered by due_date ascending (oldest overdue first).
 * Returns an empty array on error.
 */
export const getOverdueInvoices = async (
  phone: string,
): Promise<(SupplierInvoice & { supplierName: string })[]> => {
  try {
    const userId = await resolveUserId(phone);
    if (!userId) return [];

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Join supplier_invoices → suppliers, filter by user and overdue condition.
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select('*, suppliers!inner(name, user_id)')
      .eq('suppliers.user_id', userId)
      .eq('paid', false)
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      ...mapInvoice(row),
      supplierName: (row.suppliers as { name: string }).name,
    }));
  } catch (err) {
    console.error('[suppliers] getOverdueInvoices error:', err);
    return [];
  }
};

// ---------------------------------------------------------------------------
// WhatsApp reorder message generator
// ---------------------------------------------------------------------------

/**
 * Build a WhatsApp-ready reorder message addressed to a supplier.
 *
 * Example output:
 *   Namaste Sharma Wholesalers ji, Ravi Kirana Store se order hai:
 *   - Tata Salt 1kg x 10
 *   - Amul Butter 500g x 5
 *   Please confirm. Shukriya!
 */
export const generateReorderMessage = (
  supplier: Supplier,
  items: Array<{ name: string; quantity: number }>,
  storeName: string,
): string => {
  const itemLines = items
    .map((item) => `- ${item.name} x ${item.quantity}`)
    .join('\n');

  return `Namaste ${supplier.name}ji, ${storeName} se order hai:\n${itemLines}\nPlease confirm. Shukriya!`;
};
