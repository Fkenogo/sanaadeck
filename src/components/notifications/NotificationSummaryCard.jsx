function NotificationSummaryCard({ unreadCount = 0, onOpen, onMarkAllRead, busy = false }) {
  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Notifications</h3>
      <p className="mt-1 text-sm text-muted-foreground">Unread updates requiring attention.</p>
      <p className="mt-3 text-3xl font-semibold">{Number(unreadCount || 0)}</p>
      <p className="text-xs text-muted-foreground">Unread</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded border border-border px-3 py-1.5 text-xs" onClick={onOpen}>
          Open notifications
        </button>
        {typeof onMarkAllRead === 'function' ? (
          <button
            className="rounded border border-border px-3 py-1.5 text-xs"
            onClick={onMarkAllRead}
            disabled={busy || unreadCount === 0}
          >
            Mark all read
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default NotificationSummaryCard
