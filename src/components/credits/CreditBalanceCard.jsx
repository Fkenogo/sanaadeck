function CreditBalanceCard({ balance, tier, creditsPerMonth, creditsUsed, activeCount, activeLimit, onBuyExtraCredits }) {
  const total = Number(balance?.totalCredits || 0)
  const subscriptionCredits = Number(balance?.subscriptionCredits || 0)
  const extraCredits = Number(balance?.extraCredits || 0)
  const expiringSoonCredits = Number(balance?.expiringSoonCredits || 0)
  const expiringSoonPackCount = Number(balance?.expiringSoonPackCount || 0)
  const allocation = Number(creditsPerMonth || 0)
  const used = Number(creditsUsed || 0)

  const usagePercent = allocation > 0 ? Math.min(100, Math.round((used / allocation) * 100)) : 0
  const showTopUp = usagePercent >= 80

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Credits available</p>
          <p className="text-3xl font-bold">{total}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="text-sm font-semibold uppercase">{tier || 'starter'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <p>Subscription credits: {subscriptionCredits}</p>
        <p>Extra credits: {extraCredits}</p>
        <p>Monthly allocation: {allocation}</p>
        <p>
          Active requests: {activeCount} of {activeLimit}
        </p>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Usage this cycle</span>
          <span>{usagePercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${usagePercent}%` }} />
        </div>
      </div>

      {expiringSoonCredits > 0 ? (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {expiringSoonCredits} extra credit{expiringSoonCredits === 1 ? '' : 's'} expiring in less than 7 days
          {expiringSoonPackCount > 0 ? ` (${expiringSoonPackCount} pack${expiringSoonPackCount === 1 ? '' : 's'})` : ''}.
        </div>
      ) : null}

      {showTopUp ? (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          You are above 80% monthly usage.
          <button className="ml-2 underline" onClick={onBuyExtraCredits}>
            Buy extra credits
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default CreditBalanceCard
