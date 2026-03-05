import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      userProfile: null,
      loading: true,
      initialized: false,
      setAuth: ({ user, userProfile }) => set({ user, userProfile }),
      setLoading: (loading) => set({ loading }),
      setInitialized: (initialized) => set({ initialized }),
      clearAuth: () => set({ user: null, userProfile: null }),
    }),
    {
      name: 'sanaadeck-auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        userProfile: state.userProfile,
      }),
    },
  ),
)
