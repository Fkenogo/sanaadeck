import { formatDate } from '@/utils/timestamp'

function getTrendSymbol(value) {
  if (value > 0) return '↑'
  if (value < 0) return '↓'
  return '→'
}

function RatingSummaryCard({ summary }) {
  const avg = Number(summary?.average || 0)
  const count = Number(summary?.count || 0)
  const trend = Number(summary?.trend || 0)
  const latest = summary?.latest || null

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Client Ratings</h3>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-bold">{avg.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">/ 5</p>
        <p className="text-sm text-muted-foreground" title="Recent trend versus previous ratings">
          {getTrendSymbol(trend)} {Math.abs(trend).toFixed(2)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Total ratings: {count}</p>

      {latest ? (
        <div className="mt-3 rounded border border-border p-3 text-sm">
          <p className="font-medium">Latest: {Number(latest.rating || 0)}/5</p>
          <p className="text-xs text-muted-foreground">Project: {latest.projectTitle || 'Unnamed project'}</p>
          <p className="text-xs text-muted-foreground">Date: {formatDate(latest.createdAt)}</p>
          {latest.feedback ? <p className="mt-1 text-sm text-muted-foreground">{latest.feedback}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No client ratings yet.</p>
      )}
    </section>
  )
}

export default RatingSummaryCard
