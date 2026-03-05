import { useEffect, useMemo, useRef, useState } from 'react'
import notificationService from '@/services/notificationService'

export function useNotifications(userId, options = {}) {
  const { type = 'all', autoMarkOnOpen = false, enabled = true } = options
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(Boolean(userId && enabled))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!userId || !enabled) {
      setNotifications([])
      setLoading(false)
      return () => {}
    }

    setLoading(true)
    setError('')

    const unsubscribe = notificationService.subscribeToUserNotifications(
      userId,
      (items) => {
        setNotifications(items)
        setLoading(false)
      },
      (nextError) => {
        console.error('[useNotifications] Failed to load notifications:', nextError)
        setError(nextError?.message || 'Failed to load notifications')
        setLoading(false)
      },
      { type },
    )

    return () => unsubscribe()
  }, [userId, enabled, type])

  const unreadCount = useMemo(
    () => notifications.filter((entry) => !entry.read).length,
    [notifications],
  )

  useEffect(() => {
    if (!autoMarkOnOpen || !userId || !enabled) return
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }
    if (unreadCount === 0) return

    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await notificationService.markAllAsRead(userId, notifications)
      } catch (markError) {
        if (!cancelled) {
          console.error('[useNotifications] Failed to auto-mark notifications:', markError)
          setError(markError?.message || 'Failed to mark notifications as read')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [autoMarkOnOpen, userId, enabled, unreadCount, notifications])

  async function markAsRead(notificationId) {
    if (!notificationId) return
    setBusy(true)
    setError('')
    try {
      await notificationService.markAsRead(notificationId)
    } catch (markError) {
      console.error('[useNotifications] Failed to mark notification as read:', markError)
      setError(markError?.message || 'Failed to mark notification as read')
      throw markError
    } finally {
      setBusy(false)
    }
  }

  async function markAllAsRead() {
    if (!userId) return
    setBusy(true)
    setError('')
    try {
      await notificationService.markAllAsRead(userId, notifications)
    } catch (markError) {
      console.error('[useNotifications] Failed to mark all notifications:', markError)
      setError(markError?.message || 'Failed to mark all notifications as read')
      throw markError
    } finally {
      setBusy(false)
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    busy,
    error,
    markAsRead,
    markAllAsRead,
  }
}

export default useNotifications
