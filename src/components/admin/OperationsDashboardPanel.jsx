import { useMemo, useState } from 'react'
import { formatDate, toMillis } from '@/utils/timestamp'

const WORKFLOW_ORDER = [
  'pending',
  'brief_needs_clarification',
  'ready_for_assignment',
  'assigned',
  'in_progress',
  'review',
  'revision',
  'completed',
]

function normalizeWorkflow(project = {}) {
  const wf = String(project.workflowStatus || '').trim().toLowerCase()
  if (WORKFLOW_ORDER.includes(wf)) return wf
  const status = String(project.status || '').trim().toLowerCase()
  if (status === 'pending_confirmation') return 'pending'
  if (status === 'confirmed') return 'assigned'
  if (status === 'in_progress') return 'in_progress'
  if (['ready_for_qc', 'client_review'].includes(status)) return 'review'
  if (status === 'revision_requested') return 'revision'
  if (status === 'approved') return 'completed'
  return 'pending'
}

function getActiveByClient(projects = []) {
  return projects.reduce((acc, project) => {
    const wf = normalizeWorkflow(project)
    if (!['pending', 'brief_needs_clarification', 'ready_for_assignment', 'assigned', 'in_progress', 'review', 'revision'].includes(wf)) return acc
    if (!project.clientId) return acc
    acc[project.clientId] = (acc[project.clientId] || 0) + 1
    return acc
  }, {})
}

function OperationsDashboardPanel({
  projects = [],
  creatives = [],
  clients = [],
  onAssignProject,
  onRequestRevision,
  onMoveStatus,
  onFlagDelay,
  onOpenWorkspace,
}) {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedCreativeByProject, setSelectedCreativeByProject] = useState({})
  const [selectedStatusByProject, setSelectedStatusByProject] = useState({})
  const [nowMs] = useState(() => Date.now())

  const queueByStatus = useMemo(() => {
    const grouped = {
      pending: [],
      brief_needs_clarification: [],
      ready_for_assignment: [],
      assigned: [],
      in_progress: [],
      review: [],
      revision: [],
      completed: [],
    }
    projects.forEach((project) => {
      grouped[normalizeWorkflow(project)].push(project)
    })
    return grouped
  }, [projects])

  const activeRequests = useMemo(
    () => projects.filter((project) => ['pending', 'brief_needs_clarification', 'ready_for_assignment', 'assigned', 'in_progress', 'review', 'revision'].includes(normalizeWorkflow(project))).length,
    [projects],
  )

  const overdueRequests = useMemo(
    () => projects.filter((project) => {
      const wf = normalizeWorkflow(project)
      if (wf === 'completed') return false
      const due = toMillis(project.deadline)
      return due > 0 && due < nowMs
    }).length,
    [projects, nowMs],
  )

  const unassignedRequests = useMemo(
    () => projects.filter((project) => !project.assignedCreativeId && normalizeWorkflow(project) !== 'completed').length,
    [projects],
  )

  const revisionHeavyRequests = useMemo(
    () => projects.filter((project) => Number(project.revisionCount || 0) > 3).length,
    [projects],
  )

  const averageTurnaround = useMemo(() => {
    const completed = projects.filter((project) => normalizeWorkflow(project) === 'completed' && toMillis(project.createdAt) && toMillis(project.updatedAt))
    if (!completed.length) return 0
    const totalMs = completed.reduce((sum, project) => sum + (toMillis(project.updatedAt) - toMillis(project.createdAt)), 0)
    return totalMs / completed.length / (1000 * 60 * 60)
  }, [projects])

  const loadByCreative = useMemo(() => {
    const count = {}
    projects.forEach((project) => {
      if (!project.assignedCreativeId) return
      if (!['assigned', 'in_progress', 'review', 'revision'].includes(normalizeWorkflow(project))) return
      count[project.assignedCreativeId] = (count[project.assignedCreativeId] || 0) + 1
    })

    return creatives.map((creative) => {
      const active = Number(count[creative.id] || 0)
      const max = Number(creative.maxActiveProjects || 3)
      const loadScore = Number.isFinite(Number(creative.currentLoadScore)) ? Number(creative.currentLoadScore) : (active / Math.max(1, max)) * 100
      return {
        id: creative.id,
        name: creative.displayName || creative.email || creative.id,
        active,
        max,
        loadScore,
        availability: creative.availabilityStatus || creative.availability || 'available',
      }
    }).sort((a, b) => b.loadScore - a.loadScore)
  }, [projects, creatives])

  const overloadedCreatives = useMemo(
    () => loadByCreative.filter((entry) => entry.loadScore >= 90 || entry.active >= entry.max),
    [loadByCreative],
  )

  const planLimitRisks = useMemo(() => {
    const activeByClient = getActiveByClient(projects)
    return clients
      .map((client) => {
        const tier = String(client.subscription?.tier || 'starter').toLowerCase()
        const limit = tier === 'pro' ? 3 : tier === 'growth' ? 2 : 1
        const active = Number(activeByClient[client.id] || 0)
        return {
          clientId: client.id,
          label: client.businessName || client.email || client.id,
          tier,
          active,
          limit,
        }
      })
      .filter((entry) => entry.active >= entry.limit)
  }, [clients, projects])

  const projectsAtRisk = useMemo(() => {
    const threshold = nowMs + 24 * 60 * 60 * 1000
    return projects.filter((project) => {
      const wf = normalizeWorkflow(project)
      if (wf === 'completed') return false
      const due = toMillis(project.deadline)
      const dueSoon = due > nowMs && due <= threshold
      const overdue = due > 0 && due < nowMs
      return dueSoon || overdue || Boolean(project.delayedFlag) || Boolean(project.delayRisk)
    })
  }, [projects, nowMs])

  const qcViews = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    return {
      readyForReview: projects.filter((project) => normalizeWorkflow(project) === 'review'),
      pendingQc: projects.filter((project) => String(project.status || '').toLowerCase() === 'ready_for_qc'),
      revisionReturned: projects.filter((project) => normalizeWorkflow(project) === 'revision'),
      completedToday: projects.filter((project) => normalizeWorkflow(project) === 'completed' && toMillis(project.updatedAt) >= todayMs),
    }
  }, [projects])

  const visibleQueue = queueByStatus[statusFilter] || []

  const actionBtn = 'rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:border-white/20'

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h2 className="text-base font-semibold text-white">Operations Dashboard</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-7 text-sm">
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Active requests</p><p className="font-semibold text-white">{activeRequests}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Overdue requests</p><p className="font-semibold text-red-400">{overdueRequests}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Unassigned requests</p><p className="font-semibold text-white">{unassignedRequests}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Revision-heavy</p><p className="font-semibold text-yellow-400">{revisionHeavyRequests}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Overload risk</p><p className="font-semibold text-amber-400">{overloadedCreatives.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Plan limit risk</p><p className="font-semibold text-amber-400">{planLimitRisks.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-zinc-500">Avg turnaround</p><p className="font-semibold text-white">{averageTurnaround.toFixed(1)}h</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Request Queue</h3>
          <div className="flex gap-2 text-xs">
            {WORKFLOW_ORDER.map((key) => (
              <button
                key={key}
                className={`rounded-lg border px-2 py-1 ${statusFilter === key ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10' : 'border-white/10 text-zinc-400 hover:text-white'}`}
                onClick={() => setStatusFilter(key)}
              >
                {key} ({queueByStatus[key]?.length || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {visibleQueue.length > 0 ? (
            visibleQueue.slice(0, 120).map((project) => (
              <div key={project.id} className="rounded-xl border border-white/5 bg-[#141414] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{project.title}</p>
                  <p className="text-xs text-zinc-500">{normalizeWorkflow(project)}</p>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-zinc-400 md:grid-cols-4">
                  <p>Deliverable: {project.deliverableTitle || project.deliverableType || '-'}</p>
                  <p>Assigned: {project.assignedCreativeId || 'Unassigned'}</p>
                  <p>Deadline: {formatDate(project.deadline)}</p>
                  <p>Status: {project.status || 'unknown'}</p>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-zinc-400 md:grid-cols-3">
                  <p>Revision count: {Number(project.revisionCount || 0)}</p>
                  <p>Revision rate: {Number(project.revisionRate || 0).toFixed(2)}</p>
                  <p className={project.delayRisk ? 'text-amber-400' : 'text-zinc-500'}>Delay risk: {project.delayRisk ? 'high' : 'normal'}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCreativeByProject[project.id] || ''}
                    onChange={(event) => setSelectedCreativeByProject((prev) => ({ ...prev, [project.id]: event.target.value }))}
                    className="rounded-lg border border-white/10 bg-[#262626] px-2 py-1 text-xs text-white"
                  >
                    <option value="">Select creative</option>
                    {creatives.map((creative) => (
                      <option key={creative.id} value={creative.id}>{creative.displayName || creative.email || creative.id}</option>
                    ))}
                  </select>
                  <button className={actionBtn} onClick={() => onAssignProject?.(project.id, selectedCreativeByProject[project.id] || '')}>Assign / Reassign</button>

                  <select
                    value={selectedStatusByProject[project.id] || normalizeWorkflow(project)}
                    onChange={(event) => setSelectedStatusByProject((prev) => ({ ...prev, [project.id]: event.target.value }))}
                    className="rounded-lg border border-white/10 bg-[#262626] px-2 py-1 text-xs text-white"
                  >
                    {WORKFLOW_ORDER.map((entry) => <option key={`${project.id}-${entry}`} value={entry}>{entry}</option>)}
                  </select>
                  <button className={actionBtn} onClick={() => onMoveStatus?.(project.id, selectedStatusByProject[project.id] || normalizeWorkflow(project))}>Move status</button>
                  <button className={actionBtn} onClick={() => onRequestRevision?.(project.id)}>Request revision</button>
                  <button
                    className={actionBtn}
                    onClick={() => {
                      const reason = window.prompt('Delay reason (optional)', String(project.delayedReason || ''))
                      onFlagDelay?.(project.id, reason || '')
                    }}
                  >
                    Flag delay
                  </button>
                  <button className={actionBtn} onClick={() => onOpenWorkspace?.(project.id)}>Open workspace</button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-zinc-500">No requests in this queue.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-white">QC Support</h3>
          <div className="mt-2 space-y-1 text-sm text-zinc-300">
            <p>Ready for review: {qcViews.readyForReview.length}</p>
            <p>Pending QC: {qcViews.pendingQc.length}</p>
            <p>Revision returned: {qcViews.revisionReturned.length}</p>
            <p>Completed today: {qcViews.completedToday.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-white">Creative Utilization</h3>
          <div className="mt-2 max-h-56 space-y-1 overflow-auto text-xs text-zinc-300">
            {loadByCreative.length > 0 ? loadByCreative.map((entry) => (
              <p key={entry.id}>{entry.name} · {entry.active}/{entry.max} · load {entry.loadScore.toFixed(0)}% · {entry.availability}</p>
            )) : <p className="text-zinc-500">No creative utilization data.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-white">Capacity Risks</h3>
          <div className="mt-2 space-y-2 text-xs text-zinc-300">
            <div>
              <p className="font-medium text-zinc-200">Overloaded creatives</p>
              {overloadedCreatives.length > 0 ? overloadedCreatives.map((entry) => <p key={`over-${entry.id}`}>{entry.name} · {entry.active}/{entry.max} · {entry.loadScore.toFixed(0)}%</p>) : <p className="text-zinc-500">None</p>}
            </div>
            <div>
              <p className="font-medium text-zinc-200">Plans at active limits</p>
              {planLimitRisks.length > 0 ? planLimitRisks.map((entry) => <p key={`plan-${entry.clientId}`}>{entry.label} ({entry.tier}) · {entry.active}/{entry.limit}</p>) : <p className="text-zinc-500">None</p>}
            </div>
            <div>
              <p className="font-medium text-zinc-200">Projects at risk of delay</p>
              {projectsAtRisk.length > 0 ? projectsAtRisk.slice(0, 8).map((entry) => <p key={`risk-${entry.id}`}>{entry.title} · due {formatDate(entry.deadline)} · rev {Number(entry.revisionCount || 0)}</p>) : <p className="text-zinc-500">None</p>}
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

export default OperationsDashboardPanel
