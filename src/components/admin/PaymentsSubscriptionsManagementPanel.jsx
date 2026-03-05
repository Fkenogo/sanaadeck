import { useMemo, useState } from 'react'
import PaymentMonitoringPanel from '@/components/admin/PaymentMonitoringPanel'

const PAGE_SIZE = 50

function toDate(value) {
  if (!value) return 'Unknown'
  const d = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString()
}

function formatProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase()
  if (!normalized || normalized === 'pesapal') return 'pesapal'
  return normalized
}

function PaymentsSubscriptionsManagementPanel({ payments = [], clients = [], onUpdatePaymentStatus, onUpdateSubscriptionStatus }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const clientLabelById = useMemo(() => {
    const map = {}
    clients.forEach((client) => {
      const label = client.businessName || client.email || 'Unknown client'
      map[client.id] = label
      if (client.userId) map[client.userId] = label
    })
    return map
  }, [clients])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payments.filter((entry) => {
      const clientLabel = clientLabelById[entry.clientId] || ''
      if (!term) return true
      return (
        String(entry.clientId || '').toLowerCase().includes(term) ||
        String(clientLabel).toLowerCase().includes(term) ||
        String(entry.status || '').toLowerCase().includes(term) ||
        String(entry.provider || '').toLowerCase().includes(term)
      )
    })
  }, [payments, search, clientLabelById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className="space-y-4">
      <PaymentMonitoringPanel payments={payments} clients={clients} />

      <section className="rounded border border-border p-4">
        <h2 className="text-base font-semibold">Payments & Subscription Management</h2>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-border p-3">
            <h3 className="text-sm font-semibold">Payments</h3>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client/status/provider" className="mt-2 w-full rounded border border-border px-2 py-1 text-sm" />

            <div className="mt-2 max-h-72 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Provider</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length > 0 ? (
                    paged.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/60">
                        <td className="px-2 py-2">{toDate(entry.createdAt)}</td>
                        <td className="px-2 py-2">
                          <span title={entry.clientId || ''}>{clientLabelById[entry.clientId] || 'Unknown client'}</span>
                        </td>
                        <td className="px-2 py-2">{formatProvider(entry.provider) || '-'}</td>
                        <td className="px-2 py-2">{Number(entry.amount || 0)}</td>
                        <td className="px-2 py-2">
                          <select value={entry.status || 'pending'} onChange={(e) => onUpdatePaymentStatus(entry.id, e.target.value)} className="rounded border border-border px-2 py-1 text-xs">
                            <option value="pending">pending</option>
                            <option value="processing">processing</option>
                            <option value="completed">completed</option>
                            <option value="failed">failed</option>
                            <option value="canceled">canceled</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="px-2 py-3 text-muted-foreground">No payments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex gap-2">
                <button className="rounded border border-border px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>Page {page}/{totalPages}</span>
                <button className="rounded border border-border px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </div>

          <div className="rounded border border-border p-3">
            <h3 className="text-sm font-semibold">Subscriptions</h3>
            <div className="mt-2 max-h-72 overflow-auto text-sm">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-border/60">
                      <td className="px-2 py-2">{client.businessName || client.email || 'Unknown client'}</td>
                      <td className="px-2 py-2">{client.subscription?.tier || 'starter'}</td>
                      <td className="px-2 py-2">
                        <select value={client.subscription?.status || 'active'} onChange={(e) => onUpdateSubscriptionStatus(client.id, e.target.value)} className="rounded border border-border px-2 py-1 text-xs">
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="past_due">past_due</option>
                          <option value="canceled">canceled</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">{toDate(client.subscription?.renewalDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

export default PaymentsSubscriptionsManagementPanel
