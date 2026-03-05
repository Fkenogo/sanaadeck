import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function CreditAnalyticsPanel({ analytics }) {
  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Credit Analytics</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Issued this month</p>
          <p className="text-xl font-semibold">{analytics.issuedThisMonth}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Consumed this month</p>
          <p className="text-xl font-semibold">{analytics.consumedThisMonth}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Utilization rate</p>
          <p className="text-xl font-semibold">{analytics.utilizationRate.toFixed(1)}%</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Credits expiring (&lt;7d)</p>
          <p className="text-xl font-semibold">{analytics.expiringSoon}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Avg credits per project</p>
          <p className="text-xl font-semibold">{analytics.averageCreditsPerProject.toFixed(2)}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Top burn deliverable</p>
          <p className="text-xl font-semibold">{analytics.topBurnDeliverable || 'N/A'}</p>
        </div>
      </div>

      <div className="mt-4 rounded border border-border p-3">
        <p className="text-sm font-semibold">Credit burn by deliverable</p>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.burnPattern}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="deliverableType" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="credits" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export default CreditAnalyticsPanel
