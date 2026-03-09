import { useMemo, useState } from 'react'
import { toMillis, formatDate } from '@/utils/timestamp'

const PAGE_SIZE = 50

function exportRowsAsCsv(rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const str = String(v ?? '')
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
  }
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `clients-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function ClientManagementTable({
  clients,
  onAdjustCredits,
  onChangeTier,
  onUpdateStatus,
  onSendNotification,
  onViewClient,
  onRefundCredits,
}) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('businessName')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState({})

  const countries = useMemo(() => Array.from(new Set(clients.map((entry) => entry.country).filter(Boolean))).sort(), [clients])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()

    const rows = clients.filter((client) => {
      const matchesSearch =
        term.length === 0 ||
        String(client.businessName || '').toLowerCase().includes(term) ||
        String(client.id || '').toLowerCase().includes(term) ||
        String(client.userId || '').toLowerCase().includes(term)

      const tier = String(client.subscription?.tier || 'starter').toLowerCase()
      const status = String(client.subscription?.status || 'unknown').toLowerCase()
      const country = String(client.country || '').toLowerCase()

      return (
        matchesSearch &&
        (tierFilter === 'all' || tier === tierFilter) &&
        (statusFilter === 'all' || status === statusFilter) &&
        (countryFilter === 'all' || country === countryFilter)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1

    rows.sort((a, b) => {
      if (sortBy === 'lastActive') return (toMillis(a.updatedAt || a.createdAt) - toMillis(b.updatedAt || b.createdAt)) * dir
      if (sortBy === 'creditsRemaining') {
        return (Number(a.subscription?.creditsRemaining || 0) - Number(b.subscription?.creditsRemaining || 0)) * dir
      }
      if (sortBy === 'creditsUsed') {
        return (Number(a.subscription?.creditsUsed || 0) - Number(b.subscription?.creditsUsed || 0)) * dir
      }
      const av = String(a[sortBy] || a.subscription?.[sortBy] || '').toLowerCase()
      const bv = String(b[sortBy] || b.subscription?.[sortBy] || '').toLowerCase()
      return av.localeCompare(bv) * dir
    })

    return rows
  }, [clients, search, tierFilter, statusFilter, countryFilter, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const pagedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(column)
    setSortDir('asc')
  }

  function toggleSelect(clientId) {
    setSelectedIds((prev) => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  function handleBulkNotify() {
    const selected = filteredClients.filter((entry) => selectedIds[entry.id])
    selected.forEach((entry) => onSendNotification(entry.id, 'Account notice', 'Please review your dashboard updates.'))
  }

  const exportRows = filteredClients.map((client) => ({
    businessName: client.businessName || client.id,
    tier: client.subscription?.tier || 'starter',
    subscriptionStatus: client.subscription?.status || 'unknown',
    creditsRemaining: Number(client.subscription?.creditsRemaining || 0),
    creditsUsed: Number(client.subscription?.creditsUsed || 0),
    lifetimeValue: Number(client.stats?.lifetimeValue || 0),
    lastActive: new Date(toMillis(client.updatedAt || client.createdAt)).toISOString(),
  }))

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Client Management</h2>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business/email" className="rounded border border-border px-2 py-1 text-sm" />
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All tiers</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
            <option value="past_due">Past due</option>
          </select>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country.toLowerCase()}>{country}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => exportRowsAsCsv(exportRows)}>
          Export CSV
        </button>
        <button className="rounded border border-border px-2 py-1 text-xs" onClick={handleBulkNotify}>
          Send notification
        </button>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Select</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('businessName')}>Business</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('tier')}>Tier</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('status')}>Status</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('creditsRemaining')}>Credits remaining</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('creditsUsed')}>Credits used</th>
              <th className="px-2 py-2">Lifetime value</th>
              <th className="cursor-pointer px-2 py-2" onClick={() => toggleSort('lastActive')}>Last active</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedClients.length > 0 ? (
              pagedClients.map((client) => (
                <tr key={client.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={Boolean(selectedIds[client.id])} onChange={() => toggleSelect(client.id)} />
                  </td>
                  <td className="px-2 py-2">{client.businessName || client.email || 'Unknown client'}</td>
                  <td className="px-2 py-2 uppercase">{client.subscription?.tier || 'starter'}</td>
                  <td className="px-2 py-2">{client.subscription?.status || 'unknown'}</td>
                  <td className="px-2 py-2">{Number(client.subscription?.creditsRemaining || 0)}</td>
                  <td className="px-2 py-2">{Number(client.subscription?.creditsUsed || 0)}</td>
                  <td className="px-2 py-2">${Number(client.stats?.lifetimeValue || 0).toFixed(2)}</td>
                  <td className="px-2 py-2">{formatDate(client.updatedAt || client.createdAt)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onViewClient?.(client.id)}>View</button>
                      <select className="rounded border border-border px-2 py-1 text-xs" value={client.subscription?.tier || 'starter'} onChange={(e) => onChangeTier(client.id, e.target.value)}>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="pro">Pro</option>
                      </select>
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onAdjustCredits(client)}>Edit</button>
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onRefundCredits?.(client)}>Refund</button>
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onUpdateStatus(client.id, 'paused')}>Pause</button>
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onUpdateStatus(client.id, 'canceled')}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-4 text-muted-foreground" colSpan={9}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredClients.length)} of {filteredClients.length}</p>
        <div className="flex gap-2">
          <button className="rounded border border-border px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className="rounded border border-border px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default ClientManagementTable
