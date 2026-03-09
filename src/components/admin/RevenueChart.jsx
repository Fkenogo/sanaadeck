import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
const legendStyle = { color: '#71717A', fontSize: '12px' }

function RevenueChart({
  revenueTrend = [],
  subscriptionBreakdown = [],
  revenuePerCredit = [],
  extraCreditPackSales = 0,
  churnRate = 0,
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <h2 className="text-base font-semibold text-white">Revenue Analytics</h2>
      <p className="mt-1 text-sm text-zinc-500">Revenue trend (last 6 months), subscription split, and revenue per credit by tier.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#222222] p-4">
          <p className="text-xs uppercase text-zinc-500">Extra credit pack sales</p>
          <p className="text-xl font-semibold text-white">{extraCreditPackSales}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#222222] p-4">
          <p className="text-xs uppercase text-zinc-500">Churn rate</p>
          <p className="text-xl font-semibold text-white">{Number(churnRate || 0).toFixed(1)}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <p className="text-sm font-semibold text-white">Revenue trend</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={cursorStyle} />
                <Legend wrapperStyle={legendStyle} />
                <Line type="monotone" dataKey="subscriptionRevenue" stroke="#C9A227" name="Subscriptions" />
                <Line type="monotone" dataKey="extraCreditsRevenue" stroke="#10B981" name="Extra credits" />
                <Line type="monotone" dataKey="totalRevenue" stroke="#A78BFA" name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <p className="text-sm font-semibold text-white">Subscriptions by tier</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriptionBreakdown}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="tier" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={cursorStyle} />
                <Bar dataKey="count" fill="#C9A227" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-[#141414] p-4">
        <p className="text-sm font-semibold text-white">Revenue per credit by tier</p>
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenuePerCredit}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="tier" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={cursorStyle} />
              <Bar dataKey="revenuePerCredit" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export default RevenueChart
