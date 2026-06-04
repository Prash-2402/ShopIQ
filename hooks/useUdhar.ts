import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCustomer,
  addUdharEntry,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  getTransactionHistory,
  getCustomerLoyaltyStats,
  Customer,
  UdharTransaction,
  CustomerLoyaltyStats,
} from '../services/supabase/udhar';

// ---------------------------------------------------------------------------
// Mutation variable types
// ---------------------------------------------------------------------------

export interface AddCustomerVars {
  phone: string;
  name: string;
  customerPhone: string | null;
}

export interface AddUdharEntryVars {
  customerId: string;
  amount: number;
  type: 'credit' | 'repayment';
  note: string | null;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const useCustomers = (phone: string) => {
  return useQuery<Customer[]>({
    queryKey: ['customers', phone],
    queryFn: () => getCustomers(phone),
    enabled: !!phone,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCustomer = (customerId: string) => {
  return useQuery<Customer | null>({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useTransactionHistory = (customerId: string) => {
  return useQuery<UdharTransaction[]>({
    queryKey: ['udharTransactions', customerId],
    queryFn: () => getTransactionHistory(customerId),
    enabled: !!customerId,
    staleTime: 1 * 60 * 1000,
  });
};

export const useCustomerLoyaltyStats = (phone: string) => {
  return useQuery<CustomerLoyaltyStats>({
    queryKey: ['loyaltyStats', phone],
    queryFn: () => getCustomerLoyaltyStats(phone),
    enabled: !!phone,
    staleTime: 10 * 60 * 1000,
  });
};

// ---------------------------------------------------------------------------
// Mutation hooks
// TanStack Query v5: mutationFn receives a single variable object.
// ---------------------------------------------------------------------------

export const useAddCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, AddCustomerVars>({
    mutationFn: ({ phone, name, customerPhone }) =>
      addCustomer(phone, name, customerPhone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useAddUdharEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<UdharTransaction, Error, AddUdharEntryVars>({
    mutationFn: ({ customerId, amount, type, note }) =>
      addUdharEntry(customerId, amount, type, note),
    onSuccess: (_data, variables) => {
      // Invalidate the customer list (balances changed) and this specific
      // customer's detail + transaction history.
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['udharTransactions', variables.customerId] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (customerId) => deleteCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
