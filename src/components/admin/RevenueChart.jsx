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

function RevenueChart({
  revenueTrend = [],
  subscriptionBreakdown = [],
  revenuePerCredit = [],
  extraCreditPackSales = 0,
  churnRate = 0,
}) {
  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Revenue Analytics</h2>
      <p className="mt-1 text-sm text-muted-foreground">Revenue trend (last 6 months), subscription split, and revenue per credit by tier.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Extra credit pack sales</p>
          <p className="text-xl font-semibold">{extraCreditPackSales}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Churn rate</p>
          <p className="text-xl font-semibold">{Number(churnRate || 0).toFixed(1)}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded border border-border p-3">
          <p className="text-sm font-semibold">Revenue trend</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="subscriptionRevenue" stroke="#0f766e" name="Subscriptions" />
                <Line type="monotone" dataKey="extraCreditsRevenue" stroke="#2563eb" name="Extra credits" />
                <Line type="monotone" dataKey="totalRevenue" stroke="#7c3aed" name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded border border-border p-3">
          <p className="text-sm font-semibold">Subscriptions by tier</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriptionBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-border p-3">
        <p className="text-sm font-semibold">Revenue per credit by tier</p>
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenuePerCredit}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenuePerCredit" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export default RevenueChart
