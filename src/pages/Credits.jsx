import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import UnifiedPaymentForm from '@/components/payments/UnifiedPaymentForm'
import { useAuth } from '@/hooks/useAuth'
import adminService from '@/services/adminService'
import creditService from '@/services/creditService'
import { db } from '@/services/firebase'
import { toMillis, formatDateTime } from '@/utils/timestamp'

function getTierLabel(tier) {
  if (!tier) return 'Starter'
  return String(tier).charAt(0).toUpperCase() + String(tier).slice(1)
}

function withinRange(value, from, to) {
  const ms = toMillis(value)
  if (!ms) return false
  if (from) {
    const startMs = new Date(from).getTime()
    if (!Number.isNaN(startMs) && ms < startMs) return false
  }
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    const endMs = end.getTime()
    if (!Number.isNaN(endMs) && ms > endMs) return false
  }
  return true
}

function makeCsv(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (value) => {
    const str = String(value ?? '')
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
  }
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n')
}

function Credits() {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const [clientData, setClientData] = useState(null)
  const [creditBalance, setCreditBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false)
  const [checkoutType, setCheckoutType] = useState('extra_credits')
  const [checkoutTier, setCheckoutTier] = useState('starter')
  const [adminActionBusy, setAdminActionBusy] = useState(false)
  const [adminActionClientId, setAdminActionClientId] = useState('')
  const [adminActionAmount, setAdminActionAmount] = useState(1)
  const [adminActionMode, setAdminActionMode] = useState('add')
  const [adminActionReason, setAdminActionReason] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [adminCursorMillis, setAdminCursorMillis] = useState(null)
  const [adminHasMore, setAdminHasMore] = useState(false)
  const [adminLoadingMore, setAdminLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isClient = userProfile?.role === 'client'
  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role || '')
  const clientId = isClient ? user?.uid : null

  const serverFilters = useMemo(() => ({
    clientId: isAdmin && clientFilter !== 'all' ? clientFilter : '',
    type: typeFilter !== 'all' ? typeFilter : '',
    source: sourceFilter !== 'all' ? sourceFilter : '',
    fromDate: fromDate || '',
    toDate: toDate || '',
  }), [isAdmin, clientFilter, typeFilter, sourceFilter, fromDate, toDate])

  useEffect(() => {
    if (!isClient || !clientId) return undefined

    setLoading(true)
    setError('')

    const unsubscribeClient = onSnapshot(
      doc(db, 'clients', clientId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setClientData(null)
          setCreditBalance(null)
          setError('Client profile not found.')
          setLoading(false)
          return
        }

        const data = snapshot.data()
        setClientData(data)

        try {
          const balance = await creditService.getCreditBalance(clientId)
          setCreditBalance(balance)
        } catch (balanceError) {
          console.error('[Credits] Failed to load credit balance:', balanceError)
          setError('Failed to load credit balance.')
        } finally {
          setLoading(false)
        }
      },
      (nextError) => {
        console.error('[Credits] Failed to subscribe to client profile:', nextError)
        setError('Failed to load client profile.')
        setLoading(false)
      },
    )

    const txQuery = query(collection(db, 'creditTransactions'), where('clientId', '==', clientId))
    const unsubscribeTransactions = onSnapshot(
      txQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        setTransactions(items)
      },
      (nextError) => {
        console.error('[Credits] Failed to subscribe to credit transactions:', nextError)
        setError('Failed to load transaction history.')
      },
    )

    return () => {
      unsubscribeClient()
      unsubscribeTransactions()
    }
  }, [clientId, isClient])

  useEffect(() => {
    if (!isAdmin) return undefined
    setLoading(false)
    return undefined
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return undefined
    const unsubscribeClients = onSnapshot(
      collection(db, 'clients'),
      (snapshot) => {
        const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
        setClients(items)
      },
      (nextError) => {
        console.error('[Credits] Failed to load clients for admin actions:', nextError)
      },
    )
    return () => unsubscribeClients()
  }, [isAdmin])

  useEffect(() => {
    if (isClient || isAdmin) return
    setLoading(false)
  }, [isAdmin, isClient])

  const expiringPacks = useMemo(() => {
    const packs = Array.isArray(clientData?.extraCredits) ? clientData.extraCredits : []
    const now = Date.now()
    return packs
      .map((pack) => {
        const expiryMs = toMillis(pack.expiryDate)
        const daysLeft = expiryMs ? Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24)) : null
        return { ...pack, daysLeft }
      })
      .filter((pack) => Number(pack.creditsRemaining || 0) > 0 && Number.isFinite(pack.daysLeft) && pack.daysLeft >= 0 && pack.daysLeft <= 7)
      .sort((a, b) => Number(a.daysLeft || 0) - Number(b.daysLeft || 0))
  }, [clientData?.extraCredits])

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions.filter((entry) => {
      if (!isAdmin) {
        const typeMatch = typeFilter === 'all' || String(entry.type || '').toLowerCase() === typeFilter
        if (!typeMatch) return false
        const sourceMatch = sourceFilter === 'all' || String(entry.source || '').toLowerCase() === sourceFilter
        if (!sourceMatch) return false
        const dateMatch = withinRange(entry.createdAt, fromDate, toDate)
        if (!dateMatch) return false
      }
      if (!term) return true
      return (
        String(entry.description || '').toLowerCase().includes(term) ||
        String(entry.type || '').toLowerCase().includes(term) ||
        String(entry.source || '').toLowerCase().includes(term) ||
        String(entry.projectId || '').toLowerCase().includes(term)
      )
    })
  }, [transactions, search, typeFilter, sourceFilter, fromDate, toDate, isAdmin])

  const loadAdminTransactions = useCallback(async ({ mode = 'replace', cursorMillis = null } = {}) => {
    if (!isAdmin) return

    const pageSize = 200
    if (mode === 'append') setAdminLoadingMore(true)
    else setLoading(true)

    setError('')
    try {
      const pageData = await adminService.getCreditTransactionsPage({
        pageSize,
        cursorMillis,
        filters: serverFilters,
      })
      const incoming = Array.isArray(pageData?.items) ? pageData.items : []

      const normalized = incoming.map((entry) => ({
        ...entry,
        createdAt: Number.isFinite(entry.createdAtMillis)
          ? new Date(entry.createdAtMillis)
          : entry.createdAt,
      }))

      if (mode === 'append') {
        setTransactions((prev) => [...prev, ...normalized])
      } else {
        setTransactions(normalized)
      }
      setAdminCursorMillis(pageData?.nextCursorMillis || null)
      setAdminHasMore(Boolean(pageData?.hasMore))
    } catch (nextError) {
      console.error('[Credits] Failed to fetch paginated admin credit ledger:', nextError)
      setError(nextError?.message || 'Failed to load credit transaction ledger.')
    } finally {
      setLoading(false)
      setAdminLoadingMore(false)
    }
  }, [isAdmin, serverFilters])

  useEffect(() => {
    if (!isAdmin) return
    setPage(1)
    setAdminCursorMillis(null)
    setAdminHasMore(false)
    loadAdminTransactions({ mode: 'replace', cursorMillis: null })
  }, [isAdmin, loadAdminTransactions])

  const sourceOptions = useMemo(() => {
    const set = new Set(transactions.map((entry) => String(entry.source || '').toLowerCase()).filter(Boolean))
    return [...set].sort()
  }, [transactions])

  const clientOptions = useMemo(() => {
    if (!isAdmin) return []
    return [...clients]
      .map((entry) => ({ id: entry.id, label: entry.businessName || entry.id }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [clients, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (!adminActionClientId && clientOptions.length > 0) {
      setAdminActionClientId(clientOptions[0].id)
    }
  }, [isAdmin, clientOptions, adminActionClientId])

  const PAGE_SIZE = 50
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedTransactions = useMemo(
    () => filteredTransactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredTransactions, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [search, typeFilter, sourceFilter, clientFilter, fromDate, toDate])

  const exportRows = useMemo(
    () =>
      filteredTransactions.map((entry) => ({
        date: formatDateTime(entry.createdAt),
        clientId: entry.clientId || '',
        projectId: entry.projectId || '',
        type: entry.type || '',
        source: entry.source || '',
        creditsAmount: Number(entry.creditsAmount || 0),
        balanceBefore: Number(entry.balanceBefore || 0),
        balanceAfter: Number(entry.balanceAfter || 0),
        description: entry.description || '',
      })),
    [filteredTransactions],
  )

  function handleExportCsv() {
    const csv = makeCsv(exportRows)
    if (!csv) return
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `credits-ledger-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleAdminCreditAction(event) {
    event.preventDefault()
    if (!isAdmin) return
    if (!adminActionClientId) {
      setError('Select a client before applying a credit action.')
      return
    }
    if (!Number.isFinite(Number(adminActionAmount)) || Number(adminActionAmount) <= 0) {
      setError('Amount must be a positive number.')
      return
    }
    if (!adminActionReason.trim()) {
      setError('Reason is required for admin credit action.')
      return
    }

    setAdminActionBusy(true)
    setError('')
    setNotice('')
    try {
      await adminService.adjustClientCredits({
        clientId: adminActionClientId,
        amount: Number(adminActionAmount),
        mode: adminActionMode,
        reason: adminActionReason.trim(),
        createdBy: user?.uid || 'admin',
      })
      setNotice('Credit action applied successfully.')
      setAdminActionReason('')
    } catch (actionError) {
      console.error('[Credits] Failed admin credit action:', actionError)
      setError(actionError?.message || 'Failed to apply admin credit action.')
    } finally {
      setAdminActionBusy(false)
    }
  }

  async function handleLoadMoreAdminTransactions() {
    if (!isAdmin || !adminHasMore || adminLoadingMore) return
    await loadAdminTransactions({ mode: 'append', cursorMillis: adminCursorMillis })
  }

  function openTransactionDetails(entry) {
    setSelectedTransaction(entry)
  }

  function closeTransactionDetails() {
    setSelectedTransaction(null)
  }

  function openExtraCreditsCheckout() {
    setCheckoutType('extra_credits')
    setCheckoutTier(String(clientData?.subscription?.tier || 'starter'))
    setIsBuyModalOpen(true)
  }

  function openSubscriptionCheckout() {
    setCheckoutType('subscription')
    setCheckoutTier(String(clientData?.subscription?.tier || 'starter'))
    setIsBuyModalOpen(true)
  }

  const usagePercent = useMemo(() => {
    const used = Number(clientData?.subscription?.creditsUsed || 0)
    const monthly = Number(clientData?.subscription?.creditsPerMonth || 0)
    if (monthly <= 0) return 0
    return Math.min(100, Math.round((used / monthly) * 100))
  }, [clientData?.subscription?.creditsPerMonth, clientData?.subscription?.creditsUsed])

  if (!isClient && !isAdmin) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Credits</h1>
        <p className="mt-2 text-sm text-muted-foreground">Credit Center is available for client and admin accounts.</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Credits</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading credit center...</p>
      </main>
    )
  }

  return (
    <main className="space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Credits Center</h1>
          {isClient ? (
            <p className="text-sm text-muted-foreground">
              Tier: {getTierLabel(clientData?.subscription?.tier)} · Monthly allocation: {Number(clientData?.subscription?.creditsPerMonth || 0)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Global credit ledger across all clients.</p>
          )}
        </div>
        {isClient ? (
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={openSubscriptionCheckout}>
              Subscribe / upgrade
            </button>
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={openExtraCreditsCheckout}>
              Buy extra credits
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      {isClient ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Total credits</p>
              <p className="text-2xl font-semibold">{Number(creditBalance?.totalCredits || 0)}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Subscription credits</p>
              <p className="text-2xl font-semibold">{Number(creditBalance?.subscriptionCredits || 0)}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Extra credits</p>
              <p className="text-2xl font-semibold">{Number(creditBalance?.extraCredits || 0)}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Usage this cycle</p>
              <p className="text-2xl font-semibold">{usagePercent}%</p>
            </div>
          </section>

          <section className="rounded border border-border p-4">
            <h2 className="text-base font-semibold">Expiring extra packs (next 7 days)</h2>
            <div className="mt-3 space-y-2 text-sm">
              {expiringPacks.length > 0 ? (
                expiringPacks.map((pack, index) => (
                  <div key={pack.packId || `pack-${index}`} className="rounded border border-border p-2">
                    <p className="font-medium">{Number(pack.creditsRemaining || 0)} credits remaining</p>
                    <p className="text-muted-foreground">Expires in {pack.daysLeft} day(s) · Pack {pack.packId || 'n/a'}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No packs expiring within 7 days.</p>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Total records</p>
            <p className="text-2xl font-semibold">{transactions.length}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Allocations</p>
            <p className="text-2xl font-semibold">{transactions.filter((entry) => entry.type === 'allocation').length}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Deductions</p>
            <p className="text-2xl font-semibold">{transactions.filter((entry) => entry.type === 'deduction').length}</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Extra pack purchases</p>
            <p className="text-2xl font-semibold">{transactions.filter((entry) => entry.type === 'extra_pack_purchase').length}</p>
          </div>
        </section>
      )}

      {isAdmin ? (
        <section className="rounded border border-border p-4">
          <h2 className="text-base font-semibold">Admin credit actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Apply add/deduct adjustments with required reason and audit trail.</p>
          <form className="mt-3 grid gap-2 md:grid-cols-6" onSubmit={handleAdminCreditAction}>
            <select
              value={adminActionClientId}
              onChange={(event) => setAdminActionClientId(event.target.value)}
              className="rounded border border-border px-2 py-1 text-sm md:col-span-2"
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName || client.id}
                </option>
              ))}
            </select>
            <select
              value={adminActionMode}
              onChange={(event) => setAdminActionMode(event.target.value)}
              className="rounded border border-border px-2 py-1 text-sm"
            >
              <option value="add">Add credits</option>
              <option value="deduct">Deduct credits</option>
            </select>
            <input
              type="number"
              min="1"
              step="1"
              value={adminActionAmount}
              onChange={(event) => setAdminActionAmount(Number(event.target.value))}
              className="rounded border border-border px-2 py-1 text-sm"
            />
            <input
              value={adminActionReason}
              onChange={(event) => setAdminActionReason(event.target.value)}
              placeholder="Reason"
              className="rounded border border-border px-2 py-1 text-sm md:col-span-2"
            />
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <button
                className="rounded border border-border px-3 py-1.5 text-sm"
                type="submit"
                disabled={adminActionBusy}
              >
                {adminActionBusy ? 'Applying...' : 'Apply action'}
              </button>
              <button
                className="rounded border border-border px-3 py-1.5 text-sm"
                type="button"
                disabled={adminActionBusy}
                onClick={() => {
                  setAdminActionMode('add')
                  setAdminActionReason('Refund: payment issue adjustment')
                }}
              >
                Quick refund template
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Credit transactions</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Showing {filteredTransactions.length} of {transactions.length}</p>
            <button
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search description/source/project"
            className="rounded border border-border px-2 py-1 text-sm md:col-span-2"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          >
            <option value="all">All types</option>
            <option value="deduction">Deduction</option>
            <option value="allocation">Allocation</option>
            <option value="extra_pack_purchase">Extra pack purchase</option>
            <option value="expiry">Expiry</option>
            <option value="admin_adjustment">Admin adjustment</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          >
            <option value="all">All sources</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          {isAdmin ? (
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="rounded border border-border px-2 py-1 text-sm"
            >
              <option value="all">All clients</option>
              {clientOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          ) : null}
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          />
        </div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2">Date</th>
                {isAdmin ? <th className="px-2 py-2">Client</th> : null}
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Credits</th>
                <th className="px-2 py-2">Balance</th>
                <th className="px-2 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {pagedTransactions.length > 0 ? (
                pagedTransactions.map((entry) => (
                  <tr
                    key={entry.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                    onClick={() => openTransactionDetails(entry)}
                  >
                    <td className="px-2 py-2">{formatDateTime(entry.createdAt)}</td>
                    {isAdmin ? <td className="px-2 py-2">{entry.clientId || '-'}</td> : null}
                    <td className="px-2 py-2">{entry.type || '-'}</td>
                    <td className="px-2 py-2">{entry.source || '-'}</td>
                    <td className="px-2 py-2">{Number(entry.creditsAmount || 0)}</td>
                    <td className="px-2 py-2">
                      {Number(entry.balanceBefore || 0)} → {Number(entry.balanceAfter || 0)}
                    </td>
                    <td className="px-2 py-2">{entry.description || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-2 py-4 text-muted-foreground">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Showing {filteredTransactions.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-border px-2 py-1"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </button>
            <span>Page {safePage}/{totalPages}</span>
            <button
              className="rounded border border-border px-2 py-1"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </button>
            {isAdmin ? (
              <button
                className="rounded border border-border px-2 py-1"
                onClick={handleLoadMoreAdminTransactions}
                disabled={!adminHasMore || adminLoadingMore}
              >
                {adminLoadingMore ? 'Loading...' : adminHasMore ? 'Load more from server' : 'All loaded'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {isClient && isBuyModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4">
          <div className="mx-auto mt-8 max-w-3xl">
            <UnifiedPaymentForm
              tier={checkoutTier}
              paymentType={checkoutType}
              clientId={clientId}
              onSuccess={() => setIsBuyModalOpen(false)}
              onCancel={() => setIsBuyModalOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {selectedTransaction ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Transaction details</h2>
                <p className="text-sm text-muted-foreground">{selectedTransaction.id}</p>
              </div>
              <button className="rounded border border-border px-2 py-1 text-sm" onClick={closeTransactionDetails}>
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <p><span className="font-medium">Date:</span> {formatDateTime(selectedTransaction.createdAt)}</p>
              <p><span className="font-medium">Type:</span> {selectedTransaction.type || '-'}</p>
              <p><span className="font-medium">Source:</span> {selectedTransaction.source || '-'}</p>
              <p><span className="font-medium">Client:</span> {selectedTransaction.clientId || '-'}</p>
              <p><span className="font-medium">Project:</span> {selectedTransaction.projectId || '-'}</p>
              <p><span className="font-medium">Credits:</span> {Number(selectedTransaction.creditsAmount || 0)}</p>
              <p className="md:col-span-2">
                <span className="font-medium">Balance:</span>{' '}
                {Number(selectedTransaction.balanceBefore || 0)} {'->'} {Number(selectedTransaction.balanceAfter || 0)}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Description:</span> {selectedTransaction.description || '-'}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedTransaction.projectId ? (
                <button
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => {
                    closeTransactionDetails()
                    navigate('/projects')
                  }}
                >
                  Open projects page
                </button>
              ) : null}
              {isAdmin && selectedTransaction.clientId ? (
                <button
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => {
                    closeTransactionDetails()
                    navigate('/dashboard')
                  }}
                >
                  Open admin dashboard
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default Credits
