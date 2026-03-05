import { useMemo, useState } from 'react'

const PAGE_SIZE = 50

function toDate(value) {
  if (!value) return 'Unknown'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function CreditTransactionsManagementPanel({ transactions = [], clients = [], projects = [] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const clientLabelById = useMemo(() => {
    const map = {}
    clients.forEach((client) => {
      map[client.id] = client.businessName || client.email || 'Unknown client'
      if (client.userId) {
        map[client.userId] = client.businessName || client.email || 'Unknown client'
      }
    })
    return map
  }, [clients])
  const projectLabelById = useMemo(() => {
    const map = {}
    projects.forEach((project) => {
      map[project.id] = project.title || 'Untitled project'
    })
    return map
  }, [projects])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions.filter((entry) => {
      const clientLabel = clientLabelById[entry.clientId] || ''
      const projectLabel = projectLabelById[entry.projectId] || ''
      const matchesSearch =
        term.length === 0 ||
        String(entry.clientId || '').toLowerCase().includes(term) ||
        String(clientLabel).toLowerCase().includes(term) ||
        String(entry.projectId || '').toLowerCase().includes(term) ||
        String(projectLabel).toLowerCase().includes(term) ||
        String(entry.description || '').toLowerCase().includes(term)
      const matchesType = typeFilter === 'all' || String(entry.type || '').toLowerCase() === typeFilter
      return matchesSearch && matchesType
    })
  }, [transactions, search, typeFilter, clientLabelById, projectLabelById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Credit Transactions Management</h2>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client/project" className="rounded border border-border px-2 py-1 text-sm" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All types</option>
            <option value="deduction">Deduction</option>
            <option value="purchase">Purchase</option>
            <option value="admin_adjustment">Admin adjustment</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Client</th>
              <th className="px-2 py-2">Project</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Credits</th>
              <th className="px-2 py-2">Description</th>
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
                  <td className="px-2 py-2">
                    <span title={entry.projectId || ''}>{projectLabelById[entry.projectId] || 'Unknown project'}</span>
                  </td>
                  <td className="px-2 py-2">{entry.type || '-'}</td>
                  <td className="px-2 py-2">{entry.source || '-'}</td>
                  <td className="px-2 py-2">{Number(entry.creditsAmount || 0)}</td>
                  <td className="px-2 py-2">{entry.description || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-muted-foreground">No transactions found.</td>
              </tr>
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

export default CreditTransactionsManagementPanel
