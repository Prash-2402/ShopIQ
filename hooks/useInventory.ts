import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addInventoryItem,
  deleteInventoryItem,
  getExpiringItems,
  getInventory,
  getLowStockItems,
  InventoryItem,
  updateInventoryItem,
} from '../services/supabase/inventory';

// ---------------------------------------------------------------------------
// Variable types for mutation hooks
// ---------------------------------------------------------------------------

export interface AddInventoryItemVars {
  phone: string;
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
}

export interface UpdateInventoryItemVars {
  id: string;
  updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const useInventory = (phone: string) => {
  return useQuery({
    queryKey: ['inventory', phone],
    queryFn: () => getInventory(phone),
    enabled: !!phone,
    staleTime: 2 * 60 * 1000,
  });
};

export const useLowStockItems = (phone: string) => {
  return useQuery({
    queryKey: ['lowStock', phone],
    queryFn: () => getLowStockItems(phone),
    enabled: !!phone,
    staleTime: 2 * 60 * 1000,
  });
};

export const useExpiringItems = (phone: string) => {
  return useQuery({
    queryKey: ['expiringItems', phone],
    queryFn: () => getExpiringItems(phone, 7),
    enabled: !!phone,
    staleTime: 2 * 60 * 1000,
  });
};

// ---------------------------------------------------------------------------
// Mutation hooks
// TanStack Query v5 mutationFn receives a single variable object, so we wrap
// the multi-argument service functions in lambdas that destructure that object.
// ---------------------------------------------------------------------------

export const useAddInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation<InventoryItem, Error, AddInventoryItemVars>({
    mutationFn: ({ phone, item }) => addInventoryItem(phone, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['expiringItems'] });
    },
  });
};

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation<InventoryItem, Error, UpdateInventoryItemVars>({
    mutationFn: ({ id, updates }) => updateInventoryItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['expiringItems'] });
    },
  });
};

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['expiringItems'] });
    },
  });
};
