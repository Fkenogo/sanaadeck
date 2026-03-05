import { useMemo, useState } from 'react'

const PAGE_SIZE = 50

function cpsClass(score) {
  if (score >= 90) return 'text-green-700'
  if (score >= 70) return 'text-blue-700'
  if (score >= 50) return 'text-amber-700'
  return 'text-red-700'
}

function CreativeManagementTable({
  creatives,
  projectsByCreative,
  onWarnCreative,
  onSuspendCreative,
  onViewCreative,
}) {
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [performanceFilter, setPerformanceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('cps_desc')
  const [page, setPage] = useState(1)

  const specialties = useMemo(() => Array.from(new Set(creatives.map((entry) => entry.specialty).filter(Boolean))).sort(), [creatives])

  const filteredCreatives = useMemo(() => {
    const term = search.trim().toLowerCase()

    const rows = creatives.filter((creative) => {
      const cps = Number(creative.performance?.cpsScore || 0)
      const status = cps >= 90 ? 'excellent' : cps >= 70 ? 'good' : cps >= 50 ? 'needs_improvement' : 'warning'

      const matchesSearch =
        term.length === 0 ||
        String(creative.displayName || '').toLowerCase().includes(term) ||
        String(creative.specialty || '').toLowerCase().includes(term)

      return (
        matchesSearch &&
        (specialtyFilter === 'all' || creative.specialty === specialtyFilter) &&
        (tierFilter === 'all' || String(creative.tier || '').toLowerCase() === tierFilter) &&
        (performanceFilter === 'all' || status === performanceFilter)
      )
    })

    rows.sort((a, b) => {
      const cpsA = Number(a.performance?.cpsScore || 0)
      const cpsB = Number(b.performance?.cpsScore || 0)
      const projectsA = Number(projectsByCreative[a.id] || 0)
      const projectsB = Number(projectsByCreative[b.id] || 0)
      const creditsA = Number(a.earnings?.thisMonthCredits || a.stats?.creditsThisMonth || 0)
      const creditsB = Number(b.earnings?.thisMonthCredits || b.stats?.creditsThisMonth || 0)

      if (sortBy === 'cps_desc') return cpsB - cpsA
      if (sortBy === 'cps_asc') return cpsA - cpsB
      if (sortBy === 'active_projects_desc') return projectsB - projectsA
      if (sortBy === 'active_projects_asc') return projectsA - projectsB
      if (sortBy === 'credits_desc') return creditsB - creditsA
      if (sortBy === 'credits_asc') return creditsA - creditsB
      return String(a.displayName || '').localeCompare(String(b.displayName || ''))
    })

    return rows
  }, [creatives, search, specialtyFilter, tierFilter, performanceFilter, sortBy, projectsByCreative])

  const totalPages = Math.max(1, Math.ceil(filteredCreatives.length / PAGE_SIZE))
  const pagedCreatives = filteredCreatives.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Creative Management</h2>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creatives" className="rounded border border-border px-2 py-1 text-sm" />
          <select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All specialties</option>
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty}>{specialty}</option>
            ))}
          </select>
          <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All tiers</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
          <select value={performanceFilter} onChange={(event) => setPerformanceFilter(event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="all">All performance</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_improvement">Needs improvement</option>
            <option value="warning">Warning</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="cps_desc">Sort: CPS high-low</option>
            <option value="cps_asc">Sort: CPS low-high</option>
            <option value="active_projects_desc">Sort: Active projects high-low</option>
            <option value="active_projects_asc">Sort: Active projects low-high</option>
            <option value="credits_desc">Sort: Credits month high-low</option>
            <option value="credits_asc">Sort: Credits month low-high</option>
            <option value="name_asc">Sort: Name A-Z</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Specialty</th>
              <th className="px-2 py-2">Tier</th>
              <th className="px-2 py-2">CPS</th>
              <th className="px-2 py-2">Active projects</th>
              <th className="px-2 py-2">Credits this month</th>
              <th className="px-2 py-2">Utilization</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedCreatives.length > 0 ? (
              pagedCreatives.map((creative) => {
                const cps = Number(creative.performance?.cpsScore || 0)
                const creditsThisMonth = Number(creative.earnings?.thisMonthCredits || creative.stats?.creditsThisMonth || 0)
                const utilization = Math.min(100, ((creditsThisMonth || 0) / 120) * 100)
                const activeProjects = projectsByCreative[creative.id] || 0

                return (
                  <tr key={creative.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{creative.displayName || creative.email || 'Unknown creative'}</td>
                    <td className="px-2 py-2">{creative.specialty || 'n/a'}</td>
                    <td className="px-2 py-2">{creative.tier || 'mid'}</td>
                    <td className={`px-2 py-2 font-semibold ${cpsClass(cps)}`}>{cps}</td>
                    <td className="px-2 py-2">{activeProjects}</td>
                    <td className="px-2 py-2">{creditsThisMonth}</td>
                    <td className="px-2 py-2">{utilization.toFixed(1)}%</td>
                    <td className="px-2 py-2">{creative.status || 'active'}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onViewCreative?.(creative.id)}>View</button>
                        <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onWarnCreative?.(creative.id)}>Warn</button>
                        <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onSuspendCreative?.(creative.id, creative.status !== 'suspended')}>
                          {creative.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="px-2 py-4 text-muted-foreground" colSpan={9}>No creatives found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredCreatives.length)} of {filteredCreatives.length}</p>
        <div className="flex gap-2">
          <button className="rounded border border-border px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className="rounded border border-border px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default CreativeManagementTable
