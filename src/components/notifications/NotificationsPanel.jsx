import { formatDateTime } from '@/utils/timestamp'

function NotificationsPanel({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  busy = false,
  autoMarkOnOpen = false,
  onToggleAutoMark,
  filter = 'all',
  onFilterChange,
  preferences = null,
  onSavePreferences,
  preferencesSaving = false,
}) {
  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            In-app updates with read/unread tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-1 text-xs">
            Unread: {unreadCount}
          </span>
          {typeof onFilterChange === 'function' ? (
            <select
              className="rounded border border-border px-2 py-1 text-xs"
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
            >
              <option value="all">All types</option>
              <option value="project_update">Project updates</option>
              <option value="payment_reminder">Payment reminders</option>
              <option value="credit_low">Credit low</option>
              <option value="performance_alert">Performance alerts</option>
              <option value="system">System</option>
            </select>
          ) : null}
          {typeof onToggleAutoMark === 'function' ? (
            <label className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={autoMarkOnOpen}
                onChange={(event) => onToggleAutoMark(event.target.checked)}
              />
              Auto mark on open
            </label>
          ) : null}
          {onMarkAllRead ? (
            <button
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={onMarkAllRead}
              disabled={busy || unreadCount === 0}
            >
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {preferences ? (
        <div className="mt-3 rounded border border-border p-2">
          <p className="text-xs font-medium">Notification channels</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={preferences.inAppEnabled !== false}
                onChange={(event) => onSavePreferences?.({ ...preferences, inAppEnabled: event.target.checked })}
                disabled={preferencesSaving}
              />
              In-app
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(preferences.emailEnabled)}
                onChange={(event) => onSavePreferences?.({ ...preferences, emailEnabled: event.target.checked })}
                disabled={preferencesSaving}
              />
              Email
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(preferences.smsEnabled)}
                onChange={(event) => onSavePreferences?.({ ...preferences, smsEnabled: event.target.checked })}
                disabled={preferencesSaving}
              />
              SMS
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-3 max-h-72 space-y-2 overflow-auto text-sm">
        {notifications.length > 0 ? (
          notifications.map((entry) => (
            <div key={entry.id} className={`rounded border p-2 ${entry.read ? 'border-border' : 'border-blue-200 bg-blue-50/30'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{entry.title || 'Update'}</p>
                {!entry.read && onMarkRead ? (
                  <button
                    className="rounded border border-border px-2 py-1 text-xs"
                    onClick={() => onMarkRead(entry.id)}
                    disabled={busy}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
              <p className="text-muted-foreground">{entry.message || 'No details provided.'}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No notifications yet.</p>
        )}
      </div>
    </section>
  )
}

export default NotificationsPanel
