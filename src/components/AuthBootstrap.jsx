import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/services/firebase'
import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

function sanitizeAuthUser(user) {
  if (!user) return null

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  }
}

function AuthBootstrap() {
  const setAuth = useAuthStore((state) => state.setAuth)
  const setLoading = useAuthStore((state) => state.setLoading)
  const setInitialized = useAuthStore((state) => state.setInitialized)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  useEffect(() => {
    setLoading(true)

    // Fail-safe: never block the app forever if auth observer is delayed.
    const initTimeout = setTimeout(() => {
      setInitialized(true)
      setLoading(false)
    }, 6000)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(initTimeout)
      setLoading(true)

      try {
        if (!firebaseUser) {
          clearAuth()
          return
        }

        const profile = await authService.getUserProfile(firebaseUser.uid)

        setAuth({
          user: sanitizeAuthUser(firebaseUser),
          userProfile: profile,
        })
      } catch (error) {
        console.error('[AuthBootstrap] Failed to hydrate auth state:', error)
        clearAuth()
      } finally {
        setInitialized(true)
        setLoading(false)
      }
    })

    return () => {
      clearTimeout(initTimeout)
      unsubscribe()
    }
  }, [clearAuth, setAuth, setInitialized, setLoading])

  return null
}

export default AuthBootstrap
