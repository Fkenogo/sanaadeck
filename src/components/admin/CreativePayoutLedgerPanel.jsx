import { useMemo, useState } from 'react'
import { formatDate } from '@/utils/timestamp'

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function CreativePayoutLedgerPanel({ records = [], creatives = [], projects = [] }) {
  const [search, setSearch] = useState('')

  const creativeNames = useMemo(() => {
    const map = {}
    creatives.forEach((creative) => {
      map[creative.id] = creative.displayName || creative.email || creative.id
    })
    return map
  }, [creatives])

  const projectNames = useMemo(() => {
    const map = {}
    projects.forEach((project) => {
      map[project.id] = project.title || project.id
    })
    return map
  }, [projects])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return records
    return records.filter((entry) => {
      const creativeName = String(creativeNames[entry.creativeId] || '').toLowerCase()
      const projectName = String(projectNames[entry.projectId] || entry.projectTitle || '').toLowerCase()
      return creativeName.includes(term) || projectName.includes(term) || String(entry.status || '').toLowerCase().includes(term)
    })
  }, [records, search, creativeNames, projectNames])

  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Creative Payout Ledger</h2>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by creative, project or status"
          className="rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {filtered.length > 0 ? (
          filtered.slice(0, 100).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/5 bg-[#141414] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{projectNames[entry.projectId] || entry.projectTitle || entry.projectId}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{entry.status || 'earned'}</span>
              </div>
              <div className="mt-1 grid gap-1 text-xs text-zinc-400 md:grid-cols-3">
                <p>Creative: {creativeNames[entry.creativeId] || entry.creativeId}</p>
                <p>Credits: {Number(entry.creditsDelivered || 0)}</p>
                <p>Rate: {formatMoney(entry.payoutPerCredit)}</p>
                <p>Total: {formatMoney(entry.totalPayout)}</p>
                <p>Created: {formatDate(entry.createdAt)}</p>
                <p>Updated: {formatDate(entry.updatedAt)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-zinc-500">No payout records yet.</p>
        )}
      </div>
    </section>
  )
}

export default CreativePayoutLedgerPanel
