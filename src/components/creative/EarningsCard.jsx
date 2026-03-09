import { useMemo } from 'react'
import { formatDate } from '@/utils/timestamp'

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function statusTone(status) {
  if (status === 'paid') return 'text-emerald-400 bg-emerald-500/10'
  if (status === 'failed') return 'text-red-400 bg-red-500/10'
  if (status === 'queued') return 'text-blue-400 bg-blue-500/10'
  return 'text-yellow-400 bg-yellow-500/10'
}

function EarningsCard({ summary, records = [] }) {
  const recent = useMemo(() => records.slice(0, 6), [records])

  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <h3 className="text-base font-semibold text-white">Earnings Ledger</h3>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <p className="text-zinc-300">Total earned: <span className="font-semibold text-white">{formatMoney(summary?.totalEarned)}</span></p>
        <p className="text-zinc-300">Pending payout: <span className="font-semibold text-white">{formatMoney(summary?.pending)}</span></p>
        <p className="text-zinc-300">Paid out: <span className="font-semibold text-white">{formatMoney(summary?.paidOut)}</span></p>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {recent.length > 0 ? (
          recent.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/5 bg-[#141414] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{entry.projectTitle || entry.projectId}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(entry.status)}`}>{entry.status}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400">
                <p>Credits: {Number(entry.creditsDelivered || 0)}</p>
                <p>Rate: {formatMoney(entry.payoutPerCredit)}</p>
                <p>Total: {formatMoney(entry.totalPayout)}</p>
                <p>Updated: {formatDate(entry.updatedAt)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-zinc-500">No earnings records yet.</p>
        )}
      </div>
    </section>
  )
}

export default EarningsCard
