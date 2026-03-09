import { formatDateTime } from '@/utils/timestamp'

function NotificationsPanel({ notifications = [] }) {
  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Notifications</h3>
      <p className="mt-1 text-sm text-muted-foreground">In-app notifications (email digest pipeline follows in automation phase).</p>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
        {notifications.length > 0 ? (
          notifications.map((entry) => (
            <div key={entry.id} className="rounded border border-border p-2">
              <p className="font-medium">{entry.title || 'Update'}</p>
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
