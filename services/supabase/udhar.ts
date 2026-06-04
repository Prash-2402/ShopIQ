import { supabase } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  userId: string;
  name: string;
  /** The customer's own phone number (for WhatsApp reminders). */
  phone: string | null;
  createdAt: string;
  /** Computed: total credits − total repayments. Always >= 0 in practice. */
  balance: number;
  /** ISO string of the most recent udhar_transactions.created_at for this customer. */
  lastActivityAt: string;
  /** Days since lastActivityAt, computed on read. 0 if activity was today. */
  daysSinceActivity: number;
  visitCount: number;
  totalSpend: number;
}

export interface UdharTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'repayment';
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Supabase user UUID from a store-owner phone number.
 * Returns null on error or when the user is not found.
 */
async function resolveUserId(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    console.error('[udhar] resolveUserId error:', error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Compute the outstanding balance from a list of raw transaction rows.
 * balance = sum(credits) - sum(repayments)
 */
function computeBalance(
  transactions: Array<{ amount: number; type: string }>,
): number {
  return transactions.reduce((acc, t) => {
    const amt = parseFloat(String(t.amount));
    return t.type === 'credit' ? acc + amt : acc - amt;
  }, 0);
}

/**
 * Compute the number of full days between a past ISO timestamp and today.
 * Returns 0 if the timestamp is today or in the future.
 */
function daysSince(isoString: string): number {
  const past = new Date(isoString);
  past.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - past.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** Map a raw customer row + its transactions into a typed Customer object. */
function mapCustomer(
  row: Record<string, unknown>,
  transactions: Array<{ amount: number; type: string; created_at: string }>,
): Customer {
  const balance = computeBalance(transactions);

  const totalSpend = transactions
    .filter(t => t.type === 'credit')
    .reduce((acc, t) => acc + parseFloat(String(t.amount)), 0);

  // Most recent transaction timestamp, or fall back to customer creation date.
  const lastActivityAt =
    transactions.length > 0
      ? transactions.reduce((latest, t) =>
          t.created_at > latest.created_at ? t : latest,
        ).created_at
      : (row.created_at as string);

  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    createdAt: row.created_at as string,
    balance,
    lastActivityAt,
    daysSinceActivity: daysSince(lastActivityAt),
    visitCount: transactions.length,
    totalSpend,
  };
}

/** Map a raw udhar_transactions row to a typed UdharTransaction. */
function mapTransaction(row: Record<string, unknown>): UdharTransaction {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    amount: parseFloat(String(row.amount)),
    type: row.type as 'credit' | 'repayment',
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all customers for a store owner, with computed balance and activity fields.
 * Sorted by balance descending — highest-debt customers appear first.
 * Returns an empty array on error.
 */
export const getCustomers = async (phone: string): Promise<Customer[]> => {
  try {
    const userId = await resolveUserId(phone);
    if (!userId) return [];

    // Fetch customers with their transactions in a single joined query.
    const { data, error } = await supabase
      .from('customers')
      .select('*, udhar_transactions(amount, type, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const customers = (data ?? []).map((row) => {
      const transactions = (
        (row.udhar_transactions as Array<{
          amount: number;
          type: string;
          created_at: string;
        }>) ?? []
      );
      return mapCustomer(row, transactions);
    });

    // Sort by outstanding balance descending.
    customers.sort((a, b) => b.balance - a.balance);
    return customers;
  } catch (err) {
    console.error('[udhar] getCustomers error:', err);
    return [];
  }
};

/**
 * Fetch a single customer by their UUID, with computed balance.
 * Returns null if not found or on error.
 */
export const getCustomerById = async (
  customerId: string,
): Promise<Customer | null> => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, udhar_transactions(amount, type, created_at)')
      .eq('id', customerId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const transactions = (
      (data.udhar_transactions as Array<{
        amount: number;
        type: string;
        created_at: string;
      }>) ?? []
    );

    return mapCustomer(data, transactions);
  } catch (err) {
    console.error('[udhar] getCustomerById error:', err);
    return null;
  }
};

/**
 * Add a new customer to the store's udhar list.
 * Returns the newly created Customer with balance = 0 and daysSinceActivity = 0.
 * Throws a user-readable error on failure.
 */
export const addCustomer = async (
  phone: string,
  name: string,
  customerPhone: string | null,
): Promise<Customer> => {
  const userId = await resolveUserId(phone);
  if (!userId) throw new Error('Store account not found. Please log in again.');

  const { data, error } = await supabase
    .from('customers')
    .insert([{ user_id: userId, name: name.trim(), phone: customerPhone ?? null }])
    .select('*')
    .single();

  if (error) {
    console.error('[udhar] addCustomer error:', error);
    throw new Error('Could not add customer. Please try again.');
  }

  // Brand-new customer has no transactions yet.
  return mapCustomer(data, []);
};

/**
 * Record a new credit or repayment entry for a customer.
 * Validates that amount > 0 before inserting.
 * Throws a user-readable error on failure.
 */
export const addUdharEntry = async (
  customerId: string,
  amount: number,
  type: 'credit' | 'repayment',
  note: string | null,
): Promise<UdharTransaction> => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const { data, error } = await supabase
    .from('udhar_transactions')
    .insert([
      {
        customer_id: customerId,
        amount,
        type,
        note: note?.trim() || null,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('[udhar] addUdharEntry error:', error);
    throw new Error('Could not save transaction. Please try again.');
  }

  return mapTransaction(data);
};

/**
 * Fetch the full transaction history for a customer, newest first.
 * Returns an empty array on error.
 */
export const getTransactionHistory = async (
  customerId: string,
): Promise<UdharTransaction[]> => {
  try {
    const { data, error } = await supabase
      .from('udhar_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapTransaction);
  } catch (err) {
    console.error('[udhar] getTransactionHistory error:', err);
    return [];
  }
};

/**
 * Permanently delete a customer and all their transactions (via DB cascade).
 * Throws a user-readable error on failure.
 */
export const deleteCustomer = async (customerId: string): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId);

  if (error) {
    console.error('[udhar] deleteCustomer error:', error);
    throw new Error('Could not delete customer. Please try again.');
  }
};
