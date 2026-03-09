import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { formatDate } from '@/utils/timestamp'

const TARGETS = {
  rating: 4.2,
  onTimeRate: 95,
  revisionRate: 35,
  missedDeadlines: 2,
}

function pct(value, max = 100) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(max, n))
}


function MetricRow({ label, valueLabel, percent, ok }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <p>{label}</p>
        <p className={ok ? 'text-green-700' : 'text-red-700'}>{valueLabel}</p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
        <div className={`h-full ${ok ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function PerformanceReview({ creativeId }) {
  const [reviews, setReviews] = useState([])

  useEffect(() => {
    if (!creativeId) return undefined
    const q = query(
      collection(db, 'performanceReviews'),
      where('creativeId', '==', creativeId),
      orderBy('createdAt', 'desc'),
      limit(12),
    )

    return onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
    })
  }, [creativeId])

  const current = reviews[0]
  const previous = reviews[1]

  const trend = useMemo(() => {
    const currentScore = Number(current?.cpsScore || 0)
    const prevScore = Number(previous?.cpsScore || currentScore)
    if (currentScore > prevScore) return 'up'
    if (currentScore < prevScore) return 'down'
    return 'stable'
  }, [current?.cpsScore, previous?.cpsScore])

  if (!current) {
    return (
      <section className="rounded border border-border p-4">
        <h3 className="text-base font-semibold">Performance Review</h3>
        <p className="mt-2 text-sm text-muted-foreground">No monthly performance review generated yet.</p>
      </section>
    )
  }

  const metrics = current.metrics || {}
  const avgRating = Number(metrics.averageRating || 0)
  const onTimeRate = Number(metrics.onTimeRate || 0)
  const revisionRate = Number(metrics.revisionRate || 0)
  const missedDeadlines = Number(metrics.missedDeadlines || 0)

  return (
    <section className="rounded border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Performance Review</h3>
        <p className="text-xs text-muted-foreground">Period: {current.period || formatDate(current.createdAt)}</p>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-bold">{Number(current.cpsScore || 0).toFixed(1)}</p>
        <p className="text-sm text-muted-foreground">Trend: {trend}</p>
        <p className="rounded bg-muted px-2 py-0.5 text-xs">{String(current.status || 'unknown').replaceAll('_', ' ')}</p>
      </div>

      <div className="mt-4 space-y-3">
        <MetricRow
          label="Client rating"
          valueLabel={`${avgRating.toFixed(2)} / 5 (target ≥ ${TARGETS.rating})`}
          percent={pct((avgRating / 5) * 100)}
          ok={avgRating >= TARGETS.rating}
        />
        <MetricRow
          label="On-time delivery"
          valueLabel={`${onTimeRate.toFixed(1)}% (target ≥ ${TARGETS.onTimeRate}%)`}
          percent={pct(onTimeRate)}
          ok={onTimeRate >= TARGETS.onTimeRate}
        />
        <MetricRow
          label="Revision rate"
          valueLabel={`${revisionRate.toFixed(1)}% (target ≤ ${TARGETS.revisionRate}%)`}
          percent={pct(100 - revisionRate)}
          ok={revisionRate <= TARGETS.revisionRate}
        />
        <MetricRow
          label="Missed deadlines"
          valueLabel={`${missedDeadlines} (target ≤ ${TARGETS.missedDeadlines})`}
          percent={pct(100 - missedDeadlines * 20)}
          ok={missedDeadlines <= TARGETS.missedDeadlines}
        />
      </div>

      <div className="mt-4 text-sm">
        <p className="font-medium">Active bonuses</p>
        <p className="text-muted-foreground">
          {current.bonusEligible
            ? Object.entries(current.bonusEligible).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key).join(', ') || 'None'
            : 'None'}
        </p>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{current.reviewNotes || 'No additional notes.'}</p>

      {reviews.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">History loaded: {reviews.length} reviews.</p>
      ) : null}
    </section>
  )
}

export default PerformanceReview
