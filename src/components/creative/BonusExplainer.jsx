function bonusStatus(conditionMet) {
  return conditionMet ? 'Eligible' : 'Not eligible yet'
}

function BonusExplainer({ bonuses = {}, performance = {}, completedCredits = 0 }) {
  const avgRating = Number(performance.avgRating || 0)
  const consistencyEligible = Boolean(bonuses.consistency)

  const rows = [
    {
      name: '5-star bonus (+10%)',
      target: 'Average rating >= 4.8',
      eligible: bonuses.fiveStar || avgRating >= 4.8,
    },
    {
      name: 'Fast-track bonus (+20%)',
      target: '24-hour project turnarounds',
      eligible: Boolean(bonuses.fastTrack),
    },
    {
      name: 'Volume bonus (+5%)',
      target: '>= 20 completed credits / month',
      eligible: bonuses.volume || completedCredits >= 20,
    },
    {
      name: 'Consistency bonus (+10%)',
      target: '3 months with rating >= 4.5',
      eligible: consistencyEligible,
    },
  ]

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Bonus Eligibility</h3>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.name} className="rounded border border-border p-2">
            <p className="font-medium">{row.name}</p>
            <p className="text-muted-foreground">Target: {row.target}</p>
            <p className={row.eligible ? 'text-green-700' : 'text-amber-700'}>{bonusStatus(row.eligible)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default BonusExplainer
