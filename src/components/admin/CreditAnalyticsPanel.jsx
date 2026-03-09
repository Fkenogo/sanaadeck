import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const tooltipStyle = {
  background: '#1C1C1C',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F4F4F5',
  fontSize: '12px',
}
const labelStyle = { color: '#A1A1AA' }
const cursorStyle = { fill: 'rgba(255,255,255,0.03)' }
const axisProps = {
  tick: { fill: '#71717A', fontSize: 11 },
  axisLine: { stroke: 'rgba(255,255,255,0.05)' },
  tickLine: false,
}
const gridProps = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '4 4' }

function CreditAnalyticsPanel({ analytics }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <h2 className="text-base font-semibold text-white">Credit Analytics</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Issued this month</p>
          <p className="text-xl font-semibold text-white">{analytics.issuedThisMonth}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Consumed this month</p>
          <p className="text-xl font-semibold text-white">{analytics.consumedThisMonth}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Utilization rate</p>
          <p className="text-xl font-semibold text-white">{analytics.utilizationRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Credits expiring (&lt;7d)</p>
          <p className="text-xl font-semibold text-white">{analytics.expiringSoon}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Avg credits per project</p>
          <p className="text-xl font-semibold text-white">{analytics.averageCreditsPerProject.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
          <p className="text-xs uppercase text-zinc-500">Top burn deliverable</p>
          <p className="text-xl font-semibold text-white">{analytics.topBurnDeliverable || 'N/A'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-[#141414] p-4">
        <p className="text-sm font-semibold text-white">Credit burn by deliverable</p>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.burnPattern}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="deliverableType" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={cursorStyle} />
              <Bar dataKey="credits" fill="#C9A227" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export default CreditAnalyticsPanel
