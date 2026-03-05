import { useCallback } from 'react'
import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const userProfile = useAuthStore((state) => state.userProfile)
  const loading = useAuthStore((state) => state.loading)
  const initialized = useAuthStore((state) => state.initialized)
  const setAuth = useAuthStore((state) => state.setAuth)
  const setLoading = useAuthStore((state) => state.setLoading)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const signIn = useCallback(
    async (email, password) => {
      setLoading(true)
      try {
        const result = await authService.signIn(email, password)
        setAuth(result)
        return result
      } finally {
        setLoading(false)
      }
    },
    [setAuth, setLoading],
  )

  const signUp = useCallback(
    async (email, password, userData) => {
      setLoading(true)
      try {
        const result = await authService.signUp(email, password, userData)
        setAuth(result)
        return result
      } finally {
        setLoading(false)
      }
    },
    [setAuth, setLoading],
  )

  const signOut = useCallback(async () => {
    try {
      // Clear UI state immediately to avoid route guard stalls.
      clearAuth()
      await authService.signOut()
    } finally {
      setLoading(false)
    }
  }, [clearAuth, setLoading])

  return {
    user,
    userProfile,
    loading,
    initialized,
    signIn,
    signUp,
    signOut,
  }
}
