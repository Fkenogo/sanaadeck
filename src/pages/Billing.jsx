import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import creditService from '@/services/creditService'
import clientService from '@/services/clientService'
import { db } from '@/services/firebase'
import { CLIENT_ACTIVE_REQUEST_LIMITS } from '@/utils/constants'
import { formatDate, formatDateTime, toMillis } from '@/utils/timestamp'

function getTierLabel(tier) {
  if (!tier) return 'Starter'
  return String(tier).charAt(0).toUpperCase() + String(tier).slice(1)
}

function paymentStatusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'completed') return 'text-emerald-700'
  if (normalized === 'failed' || normalized === 'cancelled') return 'text-red-600'
  return 'text-amber-600'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function printReceipt(payment, businessName) {
  const win = window.open('', '_blank', 'width=700,height=600')
  if (!win) return

  const date = escapeHtml(formatDateTime(payment.createdAt))
  const amount = escapeHtml(`${payment.currency || 'USD'} ${Number(payment.amount || 0).toLocaleString()}`)
  const status = escapeHtml(payment.status || 'unknown')
  const reason = escapeHtml(String(payment.reason || '—').replaceAll('_', ' '))
  const method = escapeHtml(payment.paymentMethod || '—')
  const ref = escapeHtml(payment.trackingId || payment.id)
  const name = escapeHtml(businessName)

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${ref}</title>
  <style>
    body { font-family: sans-serif; padding: 40px; color: #111; max-width: 600px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #555; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; width: 40%; }
    .footer { margin-top: 32px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>SanaaDeck &mdash; Payment Receipt</h1>
  <p class="sub">${name}</p>
  <table>
    <tr><th>Date</th><td>${date}</td></tr>
    <tr><th>Amount</th><td>${amount}</td></tr>
    <tr><th>Purpose</th><td>${reason}</td></tr>
    <tr><th>Payment method</th><td>${method}</td></tr>
    <tr><th>Status</th><td>${status}</td></tr>
    <tr><th>Reference / Tracking ID</th><td>${ref}</td></tr>
  </table>
  <p class="footer">Computer-generated receipt. No signature required.</p>

</body>
</html>`)
  win.document.close()
  win.onload = () => win.print()
}

function Billing() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()

  const [clientData, setClientData] = useState(null)
  const [creditBalance, setCreditBalance] = useState(null)
  const [payments, setPayments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const clientId = user?.uid

  useEffect(() => {
    if (!clientId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const unsubscribeClient = onSnapshot(
      doc(db, 'clients', clientId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setError('Client profile not found.')
          setLoading(false)
          return
        }

        setClientData(snapshot.data())

        try {
          const balance = await creditService.getCreditBalance(clientId)
          setCreditBalance(balance)
        } catch {
          setError('Failed to load credit balance.')
        } finally {
          setLoading(false)
        }
      },
      () => {
        setError('Failed to load billing data.')
        setLoading(false)
      },
    )

    const unsubscribePayments = clientService.subscribeToPayments(
      clientId,
      (records) => setPayments(records),
      () => setError('Failed to load payment history.'),
    )

    const txQuery = query(
      collection(db, 'creditTransactions'),
      where('clientId', '==', clientId),
    )
    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .slice(0, 10)
        setTransactions(items)
      },
      () => {},
    )

    return () => {
      unsubscribeClient()
      unsubscribePayments()
      unsubscribeTx()
    }
  }, [clientId])

  const tier = clientData?.subscription?.tier || 'starter'
  const creditsPerMonth = Number(clientData?.subscription?.creditsPerMonth || 0)
  const creditsUsed = Number(clientData?.subscription?.creditsUsed || 0)
  const maxActiveRequests = CLIENT_ACTIVE_REQUEST_LIMITS[tier] || 1
  const renewalDate = clientData?.subscription?.renewalDate
    || clientData?.subscription?.nextRenewalAt
    || null
  const businessName = clientData?.businessName || userProfile?.displayName || 'Client'

  const extraPacks = useMemo(() => {
    const packs = Array.isArray(clientData?.extraCredits) ? clientData.extraCredits : []
    const now = Date.now()
    return packs
      .filter((pack) => toMillis(pack?.expiryDate) > now && Number(pack?.creditsRemaining || 0) > 0)
      .sort((a, b) => toMillis(a.purchaseDate) - toMillis(b.purchaseDate))
  }, [clientData?.extraCredits])

  const usagePercent = useMemo(() => {
    if (creditsPerMonth <= 0) return 0
    return Math.min(100, Math.round((creditsUsed / creditsPerMonth) * 100))
  }, [creditsUsed, creditsPerMonth])

  if (loading) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading billing information...</p>
      </main>
    )
  }

  return (
    <main className="space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-muted-foreground">{businessName}</p>
        </div>
        <button
          className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
          onClick={() => navigate('/dashboard')}
        >
          Back to dashboard
        </button>
      </header>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Subscription plan */}
      <section className="rounded border border-border p-4">
        <h2 className="text-base font-semibold">Subscription plan</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Current plan</p>
            <p className="mt-1 text-lg font-semibold">{getTierLabel(tier)}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Monthly credits</p>
            <p className="mt-1 text-lg font-semibold">{creditsPerMonth}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Active request limit</p>
            <p className="mt-1 text-lg font-semibold">{maxActiveRequests}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Next renewal</p>
            <p className="mt-1 text-base font-semibold">
              {renewalDate ? formatDate(renewalDate) : '—'}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          To change your plan or cancel, go to{' '}
          <button className="underline" onClick={() => navigate('/credits')}>
            Credits Center
          </button>
          {' '}or contact support.
        </p>
      </section>

      {/* Credit balance */}
      <section className="rounded border border-border p-4">
        <h2 className="text-base font-semibold">Credit balance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Total available</p>
            <p className="mt-1 text-2xl font-semibold">{Number(creditBalance?.totalCredits || 0)}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Subscription credits</p>
            <p className="mt-1 text-2xl font-semibold">
              {Number(creditBalance?.subscriptionCredits ?? clientData?.subscription?.creditsRemaining ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {creditsUsed} used &middot; {usagePercent}% of {creditsPerMonth}
            </p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Extra credits</p>
            <p className="mt-1 text-2xl font-semibold">{Number(creditBalance?.extraCredits || 0)}</p>
            {creditBalance?.expiringSoonCredits ? (
              <p className="mt-1 text-xs text-amber-600">
                {creditBalance.expiringSoonCredits} expiring within 7 days
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Monthly subscription usage</span>
            <span>{creditsUsed} / {creditsPerMonth}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Active extra packs */}
      {extraPacks.length > 0 ? (
        <section className="rounded border border-border p-4">
          <h2 className="text-base font-semibold">Active extra credit packs</h2>
          <div className="mt-3 space-y-2">
            {extraPacks.map((pack, index) => {
              const expiryMs = toMillis(pack.expiryDate)
              const daysLeft = expiryMs
                ? Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <div
                  key={pack.packId || `pack-${index}`}
                  className="flex items-center justify-between rounded border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{Number(pack.creditsRemaining || 0)} credits remaining</p>
                    <p className="text-xs text-muted-foreground">
                      Pack {pack.packId || 'n/a'} &middot; Purchased {formatDate(pack.purchaseDate)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={daysLeft !== null && daysLeft <= 7 ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
                      {daysLeft !== null ? `Expires in ${daysLeft} day(s)` : 'No expiry'}
                    </p>
                    <p className="text-muted-foreground">{formatDate(pack.expiryDate)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Payment history */}
      <section className="rounded border border-border p-4">
        <h2 className="text-base font-semibold">Payment history</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All payments processed through your account. Click &ldquo;Print receipt&rdquo; for a printable record.
        </p>

        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No payment records found.</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Purpose</th>
                  <th className="px-2 py-2">Method</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{formatDateTime(payment.createdAt)}</td>
                    <td className="px-2 py-2">
                      {String(payment.currency || 'USD')}{' '}
                      {Number(payment.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      {payment.reason ? String(payment.reason).replaceAll('_', ' ') : '—'}
                    </td>
                    <td className="px-2 py-2">{payment.paymentMethod || '—'}</td>
                    <td className={`px-2 py-2 font-medium ${paymentStatusClass(payment.status)}`}>
                      {String(payment.status || 'unknown')}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                      {payment.trackingId || payment.id}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => printReceipt(payment, businessName)}
                      >
                        Print receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent credit activity */}
      <section className="rounded border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Recent credit activity</h2>
          <button
            className="text-xs underline text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/credits')}
          >
            View full ledger
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No credit activity yet.</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Credits</th>
                  <th className="px-2 py-2">Balance after</th>
                  <th className="px-2 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => {
                  const isDebit = entry.type === 'deduction' || entry.type === 'expiry'
                  return (
                    <tr key={entry.id} className="border-b border-border/60">
                      <td className="px-2 py-2">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-2 py-2">{entry.type || '—'}</td>
                      <td className={`px-2 py-2 font-medium ${isDebit ? 'text-red-600' : 'text-emerald-700'}`}>
                        {isDebit ? '-' : '+'}{Number(entry.creditsAmount || 0)}
                      </td>
                      <td className="px-2 py-2">{Number(entry.balanceAfter || 0)}</td>
                      <td className="px-2 py-2">{entry.description || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default Billing
