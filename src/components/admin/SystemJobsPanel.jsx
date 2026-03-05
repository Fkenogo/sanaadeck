import { useMemo, useState } from 'react'

const PAGE_SIZE = 20

function toDateTime(value) {
  if (!value) return 'Unknown'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function SystemJobsPanel({ jobs = [], onResume }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((job) => {
      const statusMatches = statusFilter === 'all' || String(job.status || '').toLowerCase() === statusFilter
      if (!statusMatches) return false
      if (!term) return true
      return (
        String(job.type || '').toLowerCase().includes(term) ||
        String(job.requestedBy || '').toLowerCase().includes(term) ||
        String(job.result?.nextCursor || '').toLowerCase().includes(term)
      )
    })
  }, [jobs, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">System Jobs</h2>
        <p className="text-xs text-muted-foreground">Workspace migration run history and resume cursors.</p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          className="rounded border border-border px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search by type, requester, cursor"
          className="rounded border border-border px-2 py-1 text-sm md:col-span-2"
        />
      </div>

      <div className="mt-3 max-h-80 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Started</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Requested by</th>
              <th className="px-2 py-2">Scanned</th>
              <th className="px-2 py-2">Migrated</th>
              <th className="px-2 py-2">Next cursor</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length > 0 ? (
              paged.map((job) => {
                const result = job.result || {}
                const nextCursor = result.nextCursor || ''
                const resumeCursor = nextCursor || job.startAfterId || ''
                const canResume = typeof onResume === 'function' && Boolean(resumeCursor)
                return (
                  <tr key={job.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{toDateTime(job.startedAt || job.createdAt)}</td>
                    <td className="px-2 py-2">{job.status || 'unknown'}</td>
                    <td className="px-2 py-2">{job.requestedBy || '-'}</td>
                    <td className="px-2 py-2">{Number(result.scanned || 0)}</td>
                    <td className="px-2 py-2">{Number(result.migratedProjects || 0)}</td>
                    <td className="max-w-[220px] truncate px-2 py-2" title={resumeCursor || '-'}>{resumeCursor || '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        className="rounded border border-border px-2 py-1 text-xs"
                        disabled={!canResume}
                        onClick={() => onResume?.(resumeCursor)}
                      >
                        Use cursor
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-muted-foreground">No system jobs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>
          Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-border px-2 py-1"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
          >
            Prev
          </button>
          <span>Page {safePage}/{totalPages}</span>
          <button
            className="rounded border border-border px-2 py-1"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default SystemJobsPanel
