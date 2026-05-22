import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  accessToken: string | null; // stored in memory only — never localStorage
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  updateToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,

  setAuth: (token, user) => set({ accessToken: token, user }),

  clearAuth: () => set({ accessToken: null, user: null }),

  updateToken: (token) => set({ accessToken: token }),
}));

// Expose the store instance on globalThis so api.ts can access it without
// a circular import at module evaluation time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__authStore = useAuthStore;
