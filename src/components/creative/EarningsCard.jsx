import { useMemo, useState } from 'react'

function formatDate(value) {
  if (!value) return 'Not paid yet'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not paid yet'
  return date.toLocaleDateString()
}

function EarningsCard({ earnings, payoutRate, creditsCompletedThisMonth, projects = [], bonuses = {} }) {
  const [showHistory, setShowHistory] = useState(false)

  const appliedRate = Number(payoutRate || 0)
  const bonusMultiplier = Number(earnings?.bonusMultiplier || 1)
  const calculatedThisMonth = Number((creditsCompletedThisMonth || 0) * appliedRate * bonusMultiplier)
  const activeBonuses = [
    bonuses.fiveStar ? '5-star (+10%)' : null,
    bonuses.fastTrack ? 'Fast-track (+20%)' : null,
    bonuses.volume ? 'Volume (+5%)' : null,
    bonuses.consistency ? 'Consistency (+10%)' : null,
  ].filter(Boolean)

  const payoutHistory = useMemo(() => {
    return projects
      .filter((project) => ['ready_for_qc', 'client_review', 'approved'].includes(project.status))
      .map((project) => {
        const credits = Number(project.actualCreditsUsed || project.confirmedCredits || 0)
        return {
          id: project.id,
          title: project.title,
          status: project.status,
          credits,
          estimate: credits * appliedRate,
        }
      })
  }, [appliedRate, projects])

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Earnings</h3>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <p>This month (calculated): ${calculatedThisMonth.toFixed(2)}</p>
        <p>Pending payout: ${Number(earnings?.pendingPayout || 0).toFixed(2)}</p>
        <p>Last month: ${Number(earnings?.lastMonth || 0).toFixed(2)}</p>
        <p>Lifetime: ${Number(earnings?.lifetime || 0).toFixed(2)}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Payout rate: ${appliedRate.toFixed(2)} per credit</p>
      <p className="text-sm text-muted-foreground">
        Bonus multiplier: x{bonusMultiplier.toFixed(2)}
        {activeBonuses.length > 0 ? ` · ${activeBonuses.join(', ')}` : ''}
      </p>
      <p className="text-sm text-muted-foreground">Last payout date: {formatDate(earnings?.lastPayoutAt)}</p>
      <button className="mt-2 rounded border border-border px-3 py-1 text-sm" onClick={() => setShowHistory(true)}>
        View payment history
      </button>

      {showHistory ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Payment History</h4>
              <button className="text-sm underline" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
              {payoutHistory.length > 0 ? (
                payoutHistory.map((entry) => (
                  <div key={entry.id} className="rounded border border-border p-2">
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-muted-foreground">Status: {entry.status}</p>
                    <p>Credits: {entry.credits}</p>
                    <p>Estimated payout: ${entry.estimate.toFixed(2)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No payout history yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default EarningsCard
