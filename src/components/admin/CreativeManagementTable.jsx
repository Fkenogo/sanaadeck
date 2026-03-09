import { useMemo, useState } from 'react'
import { CREATIVE_SKILL_LABELS } from '@/utils/creativeSkills'

const PAGE_SIZE = 50

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

  const filterCls = "rounded-xl border border-white/10 bg-[#262626] px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-[#C9A227]/40 focus:outline-none"
  const paginationBtnCls = "rounded-lg border border-white/10 px-3 py-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"

  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Creative Management</h2>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creatives" className={filterCls} />
          <select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)} className={filterCls}>
            <option value="all">All specialties</option>
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty}>{specialty}</option>
            ))}
          </select>
          <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} className={filterCls}>
            <option value="all">All tiers</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
          <select value={performanceFilter} onChange={(event) => setPerformanceFilter(event.target.value)} className={filterCls}>
            <option value="all">All performance</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_improvement">Needs improvement</option>
            <option value="warning">Warning</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={filterCls}>
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

      <div className="mt-3 space-y-2">
        {pagedCreatives.length > 0 ? (
          pagedCreatives.map((creative) => {
            const cps = Number(creative.performance?.cpsScore || 0)
            const creditsThisMonth = Number(creative.earnings?.thisMonthCredits || creative.stats?.creditsThisMonth || 0)
            const utilization = Math.min(100, ((creditsThisMonth || 0) / 120) * 100)
            const activeProjects = projectsByCreative[creative.id] || 0
            const initials = String(creative.displayName || creative.email || '?').slice(0, 2).toUpperCase()
            const isSuspended = creative.status === 'suspended'
            const availability = creative.availabilityStatus || creative.availability || 'available'
            const loadScore = Number(creative.currentLoadScore || utilization || 0)
            const experienceLevel = creative.experienceLevel || creative.tier || 'mid'
            const primarySkills = Array.isArray(creative.primarySkills) ? creative.primarySkills : []
            const primarySkillsLabel = primarySkills.length > 0
              ? primarySkills.slice(0, 3).map((skill) => CREATIVE_SKILL_LABELS[skill] || skill).join(', ')
              : 'Not set'

            return (
              <div key={creative.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#1F1F1F] p-4 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C9A227]/15 text-sm font-bold text-[#C9A227]">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{creative.displayName || creative.email || 'Unknown'}</p>
                    <p className="text-xs text-zinc-500">{creative.specialty || 'n/a'} · {experienceLevel}</p>
                    <p className="text-[11px] text-zinc-500">Primary skills: {primarySkillsLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">CPS</p>
                    <p className={`font-bold text-sm ${cps >= 90 ? 'text-emerald-400' : cps >= 70 ? 'text-[#C9A227]' : cps >= 50 ? 'text-amber-500' : 'text-red-400'}`}>{cps}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Projects</p>
                    <p className="font-semibold text-white">{activeProjects}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Credits</p>
                    <p className="font-semibold text-white">{creditsThisMonth}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Util.</p>
                    <p className="font-semibold text-white">{utilization.toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Load</p>
                    <p className="font-semibold text-white">{loadScore.toFixed(1)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${availability === 'available' ? 'bg-emerald-500/10 text-emerald-400' : availability === 'busy' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                    {availability}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isSuspended ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {creative.status || 'active'}
                  </span>
                  <div className="flex gap-1.5">
                    <button className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all" onClick={() => onViewCreative?.(creative.id)}>View</button>
                    <button className="rounded-lg border border-amber-500/20 px-2.5 py-1 text-xs text-amber-400 hover:border-amber-500/40 transition-all" onClick={() => onWarnCreative?.(creative.id)}>Warn</button>
                    <button className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${isSuspended ? 'border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40' : 'border-red-500/20 text-red-400 hover:border-red-500/40'}`} onClick={() => onSuspendCreative?.(creative.id, !isSuspended)}>
                      {isSuspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">No creatives found.</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredCreatives.length)} of {filteredCreatives.length}</p>
        <div className="flex gap-2">
          <button className={paginationBtnCls} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className={paginationBtnCls} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default CreativeManagementTable
