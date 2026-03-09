import { useState } from 'react'
import { normalizeTimestamp } from '@/utils/timestamp'

function PaymentMonitoringPanel({ payments = [], clients = [] }) {
  const [nowMs] = useState(() => Date.now())
  const total = payments.length
  const pending = payments.filter((payment) => ['pending', 'processing', 'initiated'].includes(payment.status)).length
  const failed = payments.filter((payment) => ['failed', 'cancelled', 'canceled'].includes(payment.status)).length
  const failedRetries = payments.reduce((sum, payment) => {
    const retries = Number(payment.retryCount || payment.retries || 0)
    return sum + (Number.isFinite(retries) ? retries : 0)
  }, 0)
  const success = payments.filter((payment) => payment.status === 'completed' || payment.status === 'success').length
  const successRate = total > 0 ? (success / total) * 100 : 0

  const renewalsDue = clients.filter((client) => {
    const renewal = client.subscription?.renewalDate
    if (!renewal) return false
    const date = normalizeTimestamp(renewal)
    if (!date) return false
    const diff = date.getTime() - nowMs
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Payment Monitoring</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Pending payments</p>
          <p className="text-xl font-semibold">{pending}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Failed payments</p>
          <p className="text-xl font-semibold">{failed}</p>
          <p className="text-xs text-muted-foreground">Retry attempts: {failedRetries}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Renewals due (7d)</p>
          <p className="text-xl font-semibold">{renewalsDue}</p>
        </div>
        <div className="rounded border border-border p-3">
          <p className="text-xs uppercase text-muted-foreground">Payment success rate</p>
          <p className="text-xl font-semibold">{successRate.toFixed(1)}%</p>
        </div>
      </div>
    </section>
  )
}

export default PaymentMonitoringPanel
