import { create } from 'zustand';

export interface BillItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface BillState {
  items: BillItem[];
  total: number;
  addItem: (item: BillItem) => void;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearBill: () => void;
}

const calculateTotal = (items: BillItem[]) => {
  return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
};

export const useBillStore = create<BillState>((set) => ({
  items: [],
  total: 0,
  addItem: (newItem) =>
    set((state) => {
      const existingIdx = state.items.findIndex((i) => i.id === newItem.id);
      let updatedItems;
      if (existingIdx > -1) {
        updatedItems = [...state.items];
        updatedItems[existingIdx].quantity += newItem.quantity;
      } else {
        updatedItems = [...state.items, newItem];
      }
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
    }),
  updateQuantity: (id, qty) =>
    set((state) => {
      if (qty <= 0) {
        const updatedItems = state.items.filter((i) => i.id !== id);
        return {
          items: updatedItems,
          total: calculateTotal(updatedItems),
        };
      }
      const updatedItems = state.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i));
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
    }),
  removeItem: (id) =>
    set((state) => {
      const updatedItems = state.items.filter((i) => i.id !== id);
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
    }),
  clearBill: () => set({ items: [], total: 0 }),
}));
