import { useMemo } from 'react'
import { normalizeTimestamp } from '@/utils/timestamp'

function PerformanceAlerts({
  creatives,
  clients,
  projects,
  payments,
  onViewCreative,
  onViewClient,
  onOpenProjectWorkspace,
}) {
  const grouped = useMemo(() => {
    const alerts = {
      critical: [],
      warning: [],
      info: [],
    }

    creatives.forEach((creative) => {
      const cps = Number(creative.performance?.cpsScore || 0)
      const revisionRate = Number(creative.performance?.revisionRate || 0)

      if (cps < 50) {
        alerts.critical.push({
          message: `Creative ${creative.displayName || creative.email || 'Unknown creative'} has critical CPS (${cps}).`,
          actionLabel: 'View creative',
          action: () => onViewCreative?.(creative.id),
        })
      } else if (cps < 70) {
        alerts.warning.push({
          message: `Creative ${creative.displayName || creative.email || 'Unknown creative'} has low CPS (${cps}).`,
          actionLabel: 'View creative',
          action: () => onViewCreative?.(creative.id),
        })
      }

      if (revisionRate > 35) {
        alerts.warning.push({
          message: `Creative ${creative.displayName || creative.email || 'Unknown creative'} has high revision rate (${revisionRate}%).`,
          actionLabel: 'View creative',
          action: () => onViewCreative?.(creative.id),
        })
      }
    })

    clients.forEach((client) => {
      const remaining = Number(client.subscription?.creditsRemaining || 0)
      const tier = client.subscription?.tier || 'starter'
      const status = client.subscription?.status || 'active'

      if (remaining <= 2) {
        alerts.info.push({
          message: `Client ${client.businessName || client.email || 'Unknown client'} is nearing credit limit (${remaining} left on ${tier}).`,
          actionLabel: 'View client',
          action: () => onViewClient?.(client.id),
        })
      }

      if (status === 'past_due') {
        alerts.warning.push({
          message: `Client ${client.businessName || client.email || 'Unknown client'} has a past-due subscription.`,
          actionLabel: 'View client',
          action: () => onViewClient?.(client.id),
        })
      }

      const expired = Array.isArray(client.extraCredits)
        ? client.extraCredits.filter((pack) => Number(pack.creditsRemaining || 0) > 0).some((pack) => {
            const expiry = normalizeTimestamp(pack.expiryDate)
            return expiry !== null && expiry.getTime() < Date.now()
          })
        : false

      if (expired) {
        alerts.info.push({
          message: `Client ${client.businessName || client.email || 'Unknown client'} has expired extra credit packs.`,
          actionLabel: 'View client',
          action: () => onViewClient?.(client.id),
        })
      }
    })

    const failedPayments = payments.filter((payment) => ['failed', 'cancelled', 'canceled'].includes(payment.status)).length
    if (failedPayments > 0) {
      alerts.warning.push({
        message: `${failedPayments} failed payments require follow-up.`,
        actionLabel: null,
        action: null,
      })
    }

    projects.forEach((project) => {
      if (project.status === 'ready_for_qc') {
        alerts.info.push({
          message: `Project ${project.title} is waiting for QC review.`,
          actionLabel: 'Open workspace',
          action: () => onOpenProjectWorkspace?.(project.id),
        })
      }
    })

    return alerts
  }, [clients, creatives, projects, payments, onOpenProjectWorkspace, onViewClient, onViewCreative])

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Performance Alerts</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
        {['critical', 'warning', 'info'].map((level) => (
          <div key={level} className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">{level}</p>
            <div className="mt-2 space-y-2">
              {grouped[level].length > 0 ? (
                grouped[level].map((entry, idx) => (
                  <div key={`${entry.message}-${idx}`} className="rounded border border-border p-2">
                    <p>{entry.message}</p>
                    {entry.actionLabel ? (
                      <button className="mt-2 rounded border border-border px-2 py-1 text-xs" onClick={entry.action}>
                        {entry.actionLabel}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No {level} alerts.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default PerformanceAlerts
