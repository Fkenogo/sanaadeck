import { create } from 'zustand'

export const useCreditsStore = create((set) => ({
  balance: null,
  loading: false,
  setBalance: (balance) => set({ balance }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ balance: null, loading: false }),
}))
