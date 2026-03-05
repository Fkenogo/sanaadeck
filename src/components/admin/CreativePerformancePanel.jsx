import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/services/firebase'

const PAGE_SIZE = 50

function statusBadge(status) {
  const value = String(status || 'good').toLowerCase()
  if (value === 'excellent') return 'bg-green-100 text-green-800'
  if (value === 'good') return 'bg-blue-100 text-blue-800'
  if (value === 'needs_improvement') return 'bg-amber-100 text-amber-800'
  if (value === 'warning') return 'bg-orange-100 text-orange-800'
  if (value === 'probation') return 'bg-red-100 text-red-800'
  return 'bg-muted text-foreground'
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function CreativePerformancePanel({ creatives = [], onManualOverride, onRunMonthlyCps }) {
  const [reviews, setReviews] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const q = query(collection(db, 'performanceReviews'), orderBy('createdAt', 'desc'), limit(500))
    return onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
    })
  }, [])

  const latestByCreative = useMemo(() => {
    const map = new Map()
    reviews.forEach((review) => {
      const creativeId = review.creativeId
      if (!creativeId) return
      if (!map.has(creativeId)) {
        map.set(creativeId, review)
      }
    })
    return map
  }, [reviews])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const joined = creatives.map((creative) => {
      const review = latestByCreative.get(creative.id)
      return {
        creative,
        review,
      }
    })

    return joined.filter(({ creative, review }) => {
      const status = String(review?.status || creative.performance?.status || 'good').toLowerCase()
      const name = String(creative.displayName || '').toLowerCase()
      const specialty = String(creative.specialty || '').toLowerCase()
      const matchesSearch = !term || name.includes(term) || specialty.includes(term)
      return matchesSearch && (statusFilter === 'all' || status === statusFilter)
    })
  }, [creatives, latestByCreative, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleOverride({ creativeId, reviewId, currentScore, currentStatus }) {
    const nextScoreRaw = window.prompt('Override CPS score (0-100)', String(Number(currentScore || 0)))
    if (nextScoreRaw === null) return
    const nextScore = Number(nextScoreRaw)
    if (!Number.isFinite(nextScore) || nextScore < 0 || nextScore > 100) {
      window.alert('Invalid CPS score')
      return
    }

    const nextStatus = window.prompt('Override status (excellent/good/needs_improvement/warning/probation)', String(currentStatus || 'good'))
    if (!nextStatus) return

    const justification = window.prompt('Enter justification for override')
    if (!justification) return

    await onManualOverride?.({
      creativeId,
      reviewId,
      cpsScore: nextScore,
      status: nextStatus,
      justification,
    })
  }

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Creative Performance</h2>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border border-border px-2 py-1 text-xs" onClick={onRunMonthlyCps}>
            Run monthly CPS
          </button>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search creative"
            className="rounded border border-border px-2 py-1 text-sm"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All statuses</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_improvement">Needs Improvement</option>
            <option value="warning">Warning</option>
            <option value="probation">Probation</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Creative</th>
              <th className="px-2 py-2">Specialty</th>
              <th className="px-2 py-2">CPS</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Period</th>
              <th className="px-2 py-2">Reviewed</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length > 0 ? (
              pagedRows.map(({ creative, review }) => {
                const score = Number(review?.cpsScore ?? creative.performance?.cpsScore ?? 0)
                const status = String(review?.status || creative.performance?.status || 'good').toLowerCase()
                return (
                  <tr key={creative.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{creative.displayName || creative.email || 'Unknown creative'}</td>
                    <td className="px-2 py-2">{creative.specialty || 'n/a'}</td>
                    <td className="px-2 py-2 font-semibold">{score.toFixed(1)}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${statusBadge(status)}`}>{status.replaceAll('_', ' ')}</span>
                    </td>
                    <td className="px-2 py-2">{review?.period || '-'}</td>
                    <td className="px-2 py-2">{formatDate(review?.createdAt)}</td>
                    <td className="px-2 py-2">
                      {review ? (
                        <button
                          className="rounded border border-border px-2 py-1 text-xs"
                          onClick={() => handleOverride({
                            creativeId: creative.id,
                            reviewId: review.id,
                            currentScore: score,
                            currentStatus: status,
                          })}
                        >
                          Manual override
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No review yet</span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="px-2 py-4 text-muted-foreground" colSpan={7}>No performance records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</p>
        <div className="flex gap-2">
          <button className="rounded border border-border px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className="rounded border border-border px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default CreativePerformancePanel
