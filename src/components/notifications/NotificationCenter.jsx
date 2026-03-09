import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import notificationService from '@/services/notificationService'
import { formatDateTime } from '@/utils/timestamp'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'project_update', label: 'Project' },
  { value: 'payment_reminder', label: 'Payments' },
  { value: 'credit_low', label: 'Credits' },
  { value: 'performance_alert', label: 'Performance' },
  { value: 'system', label: 'System' },
]


function playNotificationTone() {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    const audio = new AudioCtx()
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, audio.currentTime)
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.06, audio.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start(audio.currentTime)
    oscillator.stop(audio.currentTime + 0.21)
    oscillator.onended = () => audio.close().catch(() => {})
  } catch (error) {
    console.error('[NotificationCenter] Tone playback failed:', error)
  }
}

function NotificationCenter({ userId, onOpenNotificationsPage }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [desktopAllowed, setDesktopAllowed] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [preferences, setPreferences] = useState({
    inAppEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
  })
  const [preferencesBusy, setPreferencesBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const seenIdsRef = useRef(new Set())
  const hydratedRef = useRef(false)
  const containerRef = useRef(null)

  const {
    notifications,
    unreadCount,
    busy,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId, { type: filter, enabled: Boolean(userId) })

  const recentNotifications = useMemo(() => {
    return notifications
  }, [notifications])

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target)) return
      setOpen(false)
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const latestUnread = recentNotifications.find((entry) => !entry.read)

    if (!hydratedRef.current) {
      recentNotifications.forEach((entry) => seenIdsRef.current.add(entry.id))
      hydratedRef.current = true
      return
    }

    if (!latestUnread) return
    if (seenIdsRef.current.has(latestUnread.id)) return
    seenIdsRef.current.add(latestUnread.id)
    if (seenIdsRef.current.size > 60) {
      const first = seenIdsRef.current.values().next().value
      if (first) seenIdsRef.current.delete(first)
    }

    setToast({
      id: latestUnread.id,
      title: latestUnread.title || 'New notification',
      message: latestUnread.message || 'You have a new update',
    })
    playNotificationTone()

    if (desktopAllowed && typeof Notification !== 'undefined') {
      try {
        const desktopNotification = new Notification(latestUnread.title || 'Notification', {
          body: latestUnread.message || 'You have a new update',
        })
        setTimeout(() => desktopNotification.close(), 4000)
      } catch (error) {
        console.error('[NotificationCenter] Desktop notification failed:', error)
      }
    }
  }, [desktopAllowed, recentNotifications])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    if (!userId) return undefined

    ;(async () => {
      try {
        const current = await notificationService.getPreferences(userId)
        if (cancelled || !current) return
        setPreferences({
          inAppEnabled: current.inAppEnabled !== false,
          emailEnabled: Boolean(current.emailEnabled),
          smsEnabled: Boolean(current.smsEnabled),
        })
      } catch (error) {
        console.error('[NotificationCenter] Failed to load preferences:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  async function requestDesktopPermission() {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    setDesktopAllowed(permission === 'granted')
  }

  async function handleTogglePreference(key, value) {
    if (!userId) return
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    setPreferencesBusy(true)
    try {
      await notificationService.upsertPreferences(userId, next)
    } catch (error) {
      console.error('[NotificationCenter] Failed to save preferences:', error)
      setPreferences((prev) => ({ ...prev, [key]: !value }))
    } finally {
      setPreferencesBusy(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative rounded border border-border px-3 py-2 text-sm hover:bg-muted"
        onClick={() => setOpen((prev) => !prev)}
        title="Notifications"
      >
        <span className="inline-flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
        </span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 z-50 mt-2 w-[360px] rounded border border-border bg-background p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Notification Center</h3>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">Unread: {unreadCount}</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded border border-border px-2 py-1 text-xs"
            >
              {FILTERS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={markAllAsRead}
              disabled={busy || unreadCount === 0}
            >
              Mark all as read
            </button>
            {!desktopAllowed && typeof Notification !== 'undefined' ? (
              <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={requestDesktopPermission}>
                Enable desktop
              </button>
            ) : null}
          </div>

          <div className="mt-2 rounded border border-border p-2">
            <p className="text-[11px] font-medium text-muted-foreground">Channel preferences</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={preferences.inAppEnabled}
                  onChange={(event) => handleTogglePreference('inAppEnabled', event.target.checked)}
                  disabled={preferencesBusy}
                />
                In-app
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={(event) => handleTogglePreference('emailEnabled', event.target.checked)}
                  disabled={preferencesBusy}
                />
                Email
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={preferences.smsEnabled}
                  onChange={(event) => handleTogglePreference('smsEnabled', event.target.checked)}
                  disabled={preferencesBusy}
                />
                SMS
              </label>
            </div>
          </div>

          <div className="mt-3 max-h-80 space-y-2 overflow-auto">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => markAsRead(entry.id)}
                  className={`block w-full rounded border px-2 py-2 text-left text-xs ${entry.read ? 'border-border' : 'border-blue-200 bg-blue-50/40'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{entry.title || 'Update'}</p>
                    <span className="text-[10px] uppercase text-muted-foreground">{entry.type || 'system'}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{entry.message || 'No details provided.'}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No notifications in the last 30 days.</p>
            )}
          </div>

          {typeof onOpenNotificationsPage === 'function' ? (
            <button
              type="button"
              className="mt-3 w-full rounded border border-border px-2 py-2 text-xs"
              onClick={() => {
                setOpen(false)
                onOpenNotificationsPage()
              }}
            >
              Open full notifications
            </button>
          ) : null}
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] w-[320px] rounded border border-blue-200 bg-blue-50 p-3 shadow-lg">
          <p className="text-sm font-semibold text-blue-900">{toast.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-blue-800">{toast.message}</p>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationCenter
