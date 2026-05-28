import { create } from 'zustand';
import { logoutUser } from '../services/firebase/auth';

interface AuthState {
  phone: string | null;
  storeName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  confirmationResult: any | null;
  setSession: (session: { phone: string | null; storeName: string | null; isAuthenticated: boolean }) => void;
  setStoreName: (name: string | null) => void;
  setLoading: (loading: boolean) => void;
  setConfirmationResult: (result: any) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  phone: null,
  storeName: null,
  isAuthenticated: false,
  isLoading: true,
  confirmationResult: null,
  setSession: (session) => set(() => ({ ...session, isLoading: false })),
  setStoreName: (name) => set(() => ({ storeName: name })),
  setLoading: (loading) => set(() => ({ isLoading: loading })),
  setConfirmationResult: (result) => set(() => ({ confirmationResult: result })),
  logout: async () => {
    set({ isLoading: true });
    try {
      await logoutUser();
    } catch (e) {
      console.error('Logout error:', e);
    }
    set({
      phone: null,
      storeName: null,
      isAuthenticated: false,
      confirmationResult: null,
      isLoading: false,
    });
  },
}));
