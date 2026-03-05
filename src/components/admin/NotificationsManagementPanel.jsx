import { useMemo, useState } from 'react'

const PAGE_SIZE = 50

function toDate(value) {
  if (!value) return 'Unknown'
  const d = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString()
}

function NotificationsManagementPanel({
  notifications = [],
  users = [],
  clients = [],
  creatives = [],
  onSendNotification,
  onDeleteNotification,
  onTriggerDigest,
  digestRunning = false,
  digestResult = null,
}) {
  const [recipientId, setRecipientId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const userLabelById = useMemo(() => {
    const map = {}
    users.forEach((user) => {
      map[user.id] = user.displayName || user.email || user.id
    })
    clients.forEach((client) => {
      const label = client.businessName || client.email || client.id
      map[client.id] = label
      if (client.userId) map[client.userId] = label
    })
    creatives.forEach((creative) => {
      const label = creative.displayName || creative.email || creative.id
      map[creative.id] = label
      if (creative.userId) map[creative.userId] = label
    })
    return map
  }, [users, clients, creatives])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return notifications.filter((entry) => {
      const recipientLabel = userLabelById[entry.recipientId] || entry.recipientId || ''
      if (!term) return true
      return (
        String(entry.recipientId || '').toLowerCase().includes(term) ||
        String(recipientLabel).toLowerCase().includes(term) ||
        String(entry.title || '').toLowerCase().includes(term) ||
        String(entry.message || '').toLowerCase().includes(term)
      )
    })
  }, [notifications, search, userLabelById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSend() {
    if (!recipientId || !title.trim() || !message.trim()) return
    onSendNotification(recipientId, title.trim(), message.trim())
    setTitle('')
    setMessage('')
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Notifications Management</h2>
      {onTriggerDigest ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-border px-3 py-1.5 text-sm"
            onClick={onTriggerDigest}
            disabled={digestRunning}
          >
            {digestRunning ? 'Generating digest...' : 'Generate daily digest now'}
          </button>
          {digestResult ? (
            <p className="text-xs text-muted-foreground">
              Recipients: {digestResult.totalRecipients || 0} · Created digests: {digestResult.createdDigests || 0} · Source unread: {digestResult.sourceNotifications || 0}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="rounded border border-border px-3 py-2 text-sm">
          <option value="">Select recipient</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.displayName || user.email || 'Unknown user'}</option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded border border-border px-3 py-2 text-sm" />
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" className="rounded border border-border px-3 py-2 text-sm" />
        <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleSend}>Send</button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notifications" className="mt-3 w-full rounded border border-border px-2 py-1 text-sm" />

      <div className="mt-3 max-h-96 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Recipient</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Message</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length > 0 ? (
              paged.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{toDate(entry.createdAt)}</td>
                  <td className="px-2 py-2">
                    <span title={entry.recipientId || ''}>
                      {userLabelById[entry.recipientId] || entry.recipientId || '-'}
                    </span>
                  </td>
                  <td className="px-2 py-2">{entry.title || '-'}</td>
                  <td className="px-2 py-2">{entry.message || '-'}</td>
                  <td className="px-2 py-2">
                    <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onDeleteNotification(entry.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-2 py-4 text-muted-foreground">No notifications found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
        <div className="flex gap-2">
          <button className="rounded border border-border px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className="rounded border border-border px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default NotificationsManagementPanel
