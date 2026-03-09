function KPI({ label, value, helper, highlight = false }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      highlight
        ? 'border-[#C9A227]/20 bg-[#1A1A1A]'
        : 'border-white/5 bg-[#1A1A1A] hover:border-white/10'
    }`}>
      <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? 'text-[#C9A227]' : 'text-white'}`}>{value}</p>
      {helper ? <p className="mt-1.5 text-xs text-zinc-500">{helper}</p> : null}
    </div>
  )
}

function PlatformKPIs({ kpis }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <KPI label="MRR" value={`$${kpis.mrr.toFixed(2)}`} helper={`Starter ${kpis.byTier.starter} · Growth ${kpis.byTier.growth} · Pro ${kpis.byTier.pro}`} highlight={true} />
      <KPI label="ARR" value={`$${kpis.arr.toFixed(2)}`} highlight={true} />
      <KPI label="Active Subscriptions" value={String(kpis.activeSubscriptions)} />
      <KPI label="Credits Issued vs Used" value={`${kpis.creditsIssued} / ${kpis.creditsUsed}`} helper={`Utilization: ${kpis.utilization.toFixed(1)}%`} />
      <KPI label="Gross Margin" value={`${kpis.grossMargin.toFixed(1)}%`} />
      <KPI label="Active Projects" value={String(kpis.activeProjects)} />
    </section>
  )
}

export default PlatformKPIs
