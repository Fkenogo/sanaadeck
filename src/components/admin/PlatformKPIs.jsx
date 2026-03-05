function KPI({ label, value, helper }) {
  return (
    <div className="rounded border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

function PlatformKPIs({ kpis }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <KPI label="MRR" value={`$${kpis.mrr.toFixed(2)}`} helper={`Starter ${kpis.byTier.starter} · Growth ${kpis.byTier.growth} · Pro ${kpis.byTier.pro}`} />
      <KPI label="ARR" value={`$${kpis.arr.toFixed(2)}`} />
      <KPI label="Active Subscriptions" value={String(kpis.activeSubscriptions)} />
      <KPI label="Credits Issued vs Used" value={`${kpis.creditsIssued} / ${kpis.creditsUsed}`} helper={`Utilization: ${kpis.utilization.toFixed(1)}%`} />
      <KPI label="Gross Margin" value={`${kpis.grossMargin.toFixed(1)}%`} />
      <KPI label="Active Projects" value={String(kpis.activeProjects)} />
    </section>
  )
}

export default PlatformKPIs
