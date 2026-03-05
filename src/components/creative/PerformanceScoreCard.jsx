function getStatusColor(score) {
  if (score >= 90) return 'text-green-700'
  if (score >= 70) return 'text-blue-700'
  if (score >= 50) return 'text-amber-700'
  return 'text-red-700'
}

function scoreLabel(score) {
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Improvement'
  return 'Warning'
}

function badgeClass(score) {
  if (score >= 90) return 'bg-green-100 text-green-800'
  if (score >= 70) return 'bg-blue-100 text-blue-800'
  if (score >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function PerformanceScoreCard({ performance }) {
  const cpsScore = Number(performance?.cpsScore || 0)
  const previous = Number(performance?.previousCpsScore ?? cpsScore)
  const delta = cpsScore - previous
  const trend = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const gaugeWidth = Math.min(100, Math.max(0, cpsScore))

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Performance Score</h3>
      <div className="mt-2 flex items-end gap-2">
        <p className={`text-3xl font-bold ${getStatusColor(cpsScore)}`}>{cpsScore}</p>
        <p className="text-sm text-muted-foreground" title="Compared to previous CPS score">
          {trend} {Math.abs(delta).toFixed(0)}
        </p>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(cpsScore)}`}>
          {scoreLabel(cpsScore)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted" title="CPS gauge">
        <div className="h-full bg-primary" style={{ width: `${gaugeWidth}%` }} />
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <p title="Target >= 4.2/5">Average rating: {Number(performance?.avgRating || 0).toFixed(2)} / 5</p>
        <p title="Target >= 95%">On-time rate: {Number(performance?.onTimeRate || 0)}%</p>
        <p title="Target <= 35%">Revision rate: {Number(performance?.revisionRate || 0)}%</p>
        <p title="Monthly limit 2">Missed deadlines: {Number(performance?.missedDeadlines || 0)}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Status: {scoreLabel(cpsScore).toLowerCase()}</p>
    </section>
  )
}

export default PerformanceScoreCard
