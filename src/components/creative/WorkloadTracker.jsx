function WorkloadTracker({ completedCredits, maxCredits = 120, availability = 'available', onAvailabilityChange }) {
  const completed = Number(completedCredits || 0)
  const max = Number(maxCredits || 120)
  const utilization = max > 0 ? Math.min(100, Math.round((completed / max) * 100)) : 0

  let status = 'Available'
  if (utilization >= 85) status = 'Busy'
  if (utilization >= 100) status = 'At capacity'
  const warningNearCapacity = completed >= 100
  const warningEightyPercent = utilization >= 80 && utilization < 100

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Workload Tracker</h3>
      <p className="mt-2 text-sm">
        Credits this month: {completed} / {max}
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${utilization}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Utilization: {utilization}% · {status}</p>
      {warningNearCapacity ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          Warning: You are approaching monthly cap (&gt;100 credits).
        </p>
      ) : null}
      {warningEightyPercent ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
          Capacity warning: you crossed 80% utilization.
        </p>
      ) : null}

      <label className="mt-3 block text-sm">
        Availability status
        <select
          value={availability}
          onChange={(event) => onAvailabilityChange(event.target.value)}
          className="mt-1 w-full rounded border border-border px-2 py-1"
        >
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </label>
    </section>
  )
}

export default WorkloadTracker
