import { useMemo, useState } from 'react'
import { SUBSCRIPTION_TIERS } from '@/utils/constants'
import { formatDate } from '@/utils/timestamp'
import adminService from '@/services/adminService'

const SUCCESS_PAYMENT_STATUSES = new Set(['completed', 'success', 'paid'])
const FAILED_PAYMENT_STATUSES = new Set(['failed', 'canceled', 'cancelled'])
const PENDING_PAYMENT_STATUSES = new Set(['pending', 'processing', 'initiated'])

function toMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function lower(value) {
  return String(value || '').trim().toLowerCase()
}

function isSubscriptionPayment(payment) {
  const reason = lower(payment?.reason)
  const purchaseType = lower(payment?.metadata?.purchaseType)
  return reason === 'subscription_renewal' || purchaseType === 'subscription'
}

function isExtraCreditPayment(payment) {
  const reason = lower(payment?.reason)
  return reason === 'extra_credits' || reason === 'bundle_purchase'
}

function statusPill(status) {
  const value = lower(status)
  if (value === 'paid') return 'bg-emerald-500/10 text-emerald-400'
  if (value === 'failed') return 'bg-red-500/10 text-red-400'
  if (value === 'queued') return 'bg-blue-500/10 text-blue-400'
  return 'bg-yellow-500/10 text-yellow-400'
}

function FinanceDashboardPanel({
  clients = [],
  payments = [],
  creditTransactions = [],
  projects = [],
  creativeEarnings = [],
  onUpdatePayoutStatus,
}) {
  const [queueFilter, setQueueFilter] = useState('pending')

  const paymentStats = useMemo(() => {
    const successful = payments.filter((entry) => SUCCESS_PAYMENT_STATUSES.has(lower(entry.status)))
    const failed = payments.filter((entry) => FAILED_PAYMENT_STATUSES.has(lower(entry.status)))
    const pending = payments.filter((entry) => PENDING_PAYMENT_STATUSES.has(lower(entry.status)))

    const subscriptionRevenue = successful
      .filter(isSubscriptionPayment)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const extraCreditRevenue = successful
      .filter(isExtraCreditPayment)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    return {
      successful,
      failed,
      pending,
      subscriptionRevenue,
      extraCreditRevenue,
    }
  }, [payments])

  const creditStats = useMemo(() => {
    const creditsIssued = creditTransactions
      .filter((entry) => ['allocation', 'extra_pack_purchase'].includes(lower(entry.type)))
      .reduce((sum, entry) => sum + Number(entry.creditsAmount || entry.amount || 0), 0)

    const creditsConsumed = creditTransactions
      .filter((entry) => lower(entry.type) === 'deduction')
      .reduce((sum, entry) => sum + Number(entry.creditsAmount || entry.amount || 0), 0)

    const remainingLiability = clients.reduce((sum, client) => {
      const remainingSubscription = Number(client?.subscription?.creditsRemaining || 0)
      const remainingExtra = Array.isArray(client?.extraCredits)
        ? client.extraCredits.reduce((packSum, pack) => packSum + Number(pack?.creditsRemaining || 0), 0)
        : 0
      return sum + remainingSubscription + remainingExtra
    }, 0)

    return {
      creditsIssued,
      creditsConsumed,
      remainingLiability,
    }
  }, [clients, creditTransactions])

  const burnMetrics = useMemo(
    () => adminService.calculateCreditBurnMetrics(creditTransactions, clients),
    [creditTransactions, clients],
  )

  const payoutStats = useMemo(() => {
    const pending = creativeEarnings.filter((entry) => ['earned', 'pending'].includes(lower(entry.status)))
    const queued = creativeEarnings.filter((entry) => lower(entry.status) === 'queued')
    const paid = creativeEarnings.filter((entry) => lower(entry.status) === 'paid')
    const failed = creativeEarnings.filter((entry) => lower(entry.status) === 'failed')

    const totals = {
      pending: pending.reduce((sum, entry) => sum + Number(entry.totalPayout || 0), 0),
      queued: queued.reduce((sum, entry) => sum + Number(entry.totalPayout || 0), 0),
      paid: paid.reduce((sum, entry) => sum + Number(entry.totalPayout || 0), 0),
      failed: failed.reduce((sum, entry) => sum + Number(entry.totalPayout || 0), 0),
    }

    return { pending, queued, paid, failed, totals }
  }, [creativeEarnings])

  const projectMarginStats = useMemo(() => {
    const approvedProjects = projects.filter((project) => lower(project?.status) === 'approved')
    const totals = approvedProjects.reduce((acc, project) => {
      const clientRevenue = Number(project.clientRevenue || 0)
      const creativeCost = Number(project.creativeCost || project.creativeEarning || 0)
      const projectMargin = Number.isFinite(Number(project.projectMargin))
        ? Number(project.projectMargin)
        : clientRevenue - creativeCost
      acc.clientRevenue += clientRevenue
      acc.creativeCost += creativeCost
      acc.projectMargin += projectMargin
      return acc
    }, { clientRevenue: 0, creativeCost: 0, projectMargin: 0 })

    return {
      count: approvedProjects.length,
      totals: {
        clientRevenue: Number(totals.clientRevenue.toFixed(2)),
        creativeCost: Number(totals.creativeCost.toFixed(2)),
        projectMargin: Number(totals.projectMargin.toFixed(2)),
      },
    }
  }, [projects])

  const marginByTier = useMemo(() => {
    const tierKeys = ['starter', 'growth', 'pro']
    const rows = tierKeys.map((tierKey) => {
      const clientsOnTier = clients.filter((client) => lower(client?.subscription?.tier || 'starter') === tierKey)
      const estimatedRevenue = clientsOnTier.length * Number(SUBSCRIPTION_TIERS[tierKey.toUpperCase()]?.priceUsd || 0)

      const payoutCost = projects.reduce((sum, project) => {
        if (lower(project?.status) !== 'approved') return sum
        const client = clients.find((entry) => entry.id === project.clientId)
        const clientTier = lower(client?.subscription?.tier || 'starter')
        if (clientTier !== tierKey) return sum
        return sum + Number(project.creativeEarning || 0)
      }, 0)

      const margin = estimatedRevenue - payoutCost
      const marginPct = estimatedRevenue > 0 ? (margin / estimatedRevenue) * 100 : 0

      return {
        tier: tierKey,
        clients: clientsOnTier.length,
        estimatedRevenue,
        payoutCost,
        margin,
        marginPct,
      }
    })

    return rows
  }, [clients, projects])

  const queueRecords = useMemo(() => {
    if (queueFilter === 'pending') return payoutStats.pending
    if (queueFilter === 'queued') return payoutStats.queued
    if (queueFilter === 'paid') return payoutStats.paid
    if (queueFilter === 'failed') return payoutStats.failed
    return []
  }, [queueFilter, payoutStats])

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h2 className="text-base font-semibold text-white">Finance Dashboard</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Subscriptions Revenue</p>
            <p className="text-xl font-semibold text-white">{toMoney(paymentStats.subscriptionRevenue)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Extra Credit Revenue</p>
            <p className="text-xl font-semibold text-white">{toMoney(paymentStats.extraCreditRevenue)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Credits Issued</p>
            <p className="text-xl font-semibold text-white">{Number(creditStats.creditsIssued || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Credits Consumed</p>
            <p className="text-xl font-semibold text-white">{Number(creditStats.creditsConsumed || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Remaining Liability (credits)</p>
            <p className="text-xl font-semibold text-white">{Number(creditStats.remainingLiability || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Creative Payouts Pending</p>
            <p className="text-xl font-semibold text-white">{toMoney(payoutStats.totals.pending + payoutStats.totals.queued)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Creative Payouts Paid</p>
            <p className="text-xl font-semibold text-white">{toMoney(payoutStats.totals.paid)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Failed Payouts</p>
            <p className="text-xl font-semibold text-red-400">{toMoney(payoutStats.totals.failed)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Credits Consumed (30d)</p>
            <p className="text-xl font-semibold text-white">{Number(burnMetrics.creditsConsumedLast30Days || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Credits Consumed (This Month)</p>
            <p className="text-xl font-semibold text-white">{Number(burnMetrics.creditsConsumedThisMonth || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Avg Credits / Client (30d)</p>
            <p className="text-xl font-semibold text-white">{Number(burnMetrics.avgCreditsPerClient || 0).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Project Revenue (Approved)</p>
            <p className="text-xl font-semibold text-white">{toMoney(projectMarginStats.totals.clientRevenue)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Project Creative Cost</p>
            <p className="text-xl font-semibold text-white">{toMoney(projectMarginStats.totals.creativeCost)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Project Margin</p>
            <p className={`text-xl font-semibold ${projectMarginStats.totals.projectMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{toMoney(projectMarginStats.totals.projectMargin)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-semibold text-white">Payment Monitoring</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5 text-sm">
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Successful payments</p>
            <p className="font-semibold text-white">{paymentStats.successful.length}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Failed payments</p>
            <p className="font-semibold text-red-400">{paymentStats.failed.length}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Pending verification</p>
            <p className="font-semibold text-yellow-400">{paymentStats.pending.length}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Subscription renewals</p>
            <p className="font-semibold text-white">{paymentStats.successful.filter(isSubscriptionPayment).length}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Extra credit purchases</p>
            <p className="font-semibold text-white">{paymentStats.successful.filter(isExtraCreditPayment).length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Payout Queue</h3>
          <div className="flex gap-2 text-xs">
            {['pending', 'queued', 'paid', 'failed'].map((status) => (
              <button
                key={status}
                className={`rounded-lg border px-2 py-1 ${queueFilter === status ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10' : 'border-white/10 text-zinc-400 hover:text-white'}`}
                onClick={() => setQueueFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {queueRecords.length > 0 ? (
            queueRecords.slice(0, 80).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/5 bg-[#141414] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{entry.projectTitle || entry.projectId}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusPill(entry.status)}`}>{entry.status}</span>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-zinc-400 md:grid-cols-4">
                  <p>Creative: {entry.creativeId}</p>
                  <p>Credits: {Number(entry.creditsDelivered || 0)}</p>
                  <p>Total: {toMoney(entry.totalPayout)}</p>
                  <p>Updated: {formatDate(entry.updatedAt)}</p>
                </div>
                {onUpdatePayoutStatus ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['queued', 'paid', 'failed'].map((status) => (
                      <button
                        key={`${entry.id}-${status}`}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:border-white/20"
                        onClick={() => onUpdatePayoutStatus(entry.id, status)}
                        disabled={lower(entry.status) === status}
                      >
                        Mark {status}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-zinc-500">No records in this queue.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-semibold text-white">Reconciliation</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Credits sold (issued)</p>
            <p className="font-semibold text-white">{Number(creditStats.creditsIssued || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Credits consumed</p>
            <p className="font-semibold text-white">{Number(creditStats.creditsConsumed || 0).toFixed(0)}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#141414] p-3">
            <p className="text-zinc-500">Revenue vs payout cost</p>
            <p className="font-semibold text-white">
              {toMoney(paymentStats.subscriptionRevenue + paymentStats.extraCreditRevenue)} vs {toMoney(payoutStats.totals.paid + payoutStats.totals.pending + payoutStats.totals.queued)}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500">
                <th className="px-2 py-2">Tier</th>
                <th className="px-2 py-2">Clients</th>
                <th className="px-2 py-2">Est. Revenue</th>
                <th className="px-2 py-2">Creative Payout Cost</th>
                <th className="px-2 py-2">Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              {marginByTier.map((row) => (
                <tr key={row.tier} className="border-b border-white/5">
                  <td className="px-2 py-2 uppercase">{row.tier}</td>
                  <td className="px-2 py-2">{row.clients}</td>
                  <td className="px-2 py-2">{toMoney(row.estimatedRevenue)}</td>
                  <td className="px-2 py-2">{toMoney(row.payoutCost)}</td>
                  <td className={`px-2 py-2 font-semibold ${row.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {toMoney(row.margin)} ({row.marginPct.toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

export default FinanceDashboardPanel
