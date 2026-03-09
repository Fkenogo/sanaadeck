import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toMillis, formatDate } from '@/utils/timestamp'
import { recommendCreativesForProject } from '@/utils/assignmentEngine'

const tooltipStyle = {
  background: '#1C1C1C',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F4F4F5',
  fontSize: '12px',
}
const labelStyle = { color: '#A1A1AA' }
const cursorStyle = { fill: 'rgba(255,255,255,0.03)' }
const axisProps = {
  tick: { fill: '#71717A', fontSize: 11 },
  axisLine: { stroke: 'rgba(255,255,255,0.05)' },
  tickLine: false,
}
const gridProps = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '4 4' }
const PIE_COLORS = ['#C9A227', '#10B981', '#A78BFA', '#F59E0B', '#6B7280', '#64748b']


function ProjectOversightPanel({ projects, creatives, onAssignProject, onApproveQC, onRequestRevision, onOpenWorkspace, onAdjustProjectEstimate }) {
  const [selectedCreativeByProject, setSelectedCreativeByProject] = useState({})
  const [nowMs] = useState(() => Date.now())

  const statusCounts = useMemo(() => {
    const counts = projects.reduce((acc, project) => {
      const status = project.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts).map(([status, count]) => ({ status, count }))
  }, [projects])

  const bottlenecks = useMemo(() => {
    const blockedStatuses = new Set(['pending_confirmation', 'confirmed', 'in_progress', 'ready_for_qc', 'revision_requested'])
    const now = nowMs
    return projects.filter((project) => {
      const updatedMs = toMillis(project.updatedAt || project.createdAt)
      if (!updatedMs) return false
      const ageHours = (now - updatedMs) / (1000 * 60 * 60)
      return blockedStatuses.has(project.status) && ageHours > 48
    })
  }, [projects, nowMs])

  const unassigned = useMemo(
    () => projects.filter((project) => {
      if (project.assignedCreativeId) return false
      if (project.status === 'approved') return false
      const wf = String(project.workflowStatus || '').toLowerCase()
      return ['ready_for_assignment', 'pending', 'assigned', 'in_progress', 'review', 'revision', 'completed'].includes(wf)
        ? wf === 'ready_for_assignment'
        : project.status === 'pending_confirmation'
    }),
    [projects],
  )

  const recommendationsByProject = useMemo(() => {
    const map = {}
    unassigned.forEach((project) => {
      map[project.id] = recommendCreativesForProject({
        project,
        creatives,
        projects,
        maxCandidates: 3,
        loadThreshold: 90,
      })
    })
    return map
  }, [unassigned, creatives, projects])

  const qcQueue = useMemo(
    () => projects.filter((project) => project.status === 'ready_for_qc'),
    [projects],
  )

  const nearingDeadline = useMemo(() => {
    const now = nowMs
    const threshold = now + 48 * 60 * 60 * 1000
    return projects.filter((project) => {
      const deadline = toMillis(project.deadline)
      return deadline > now && deadline <= threshold && !['approved'].includes(project.status)
    })
  }, [projects, nowMs])

  const overdue = useMemo(() => {
    const now = nowMs
    return projects.filter((project) => {
      const deadline = toMillis(project.deadline)
      return deadline > 0 && deadline < now && project.status !== 'approved'
    })
  }, [projects, nowMs])

  const averageTurnaroundHours = useMemo(() => {
    const completed = projects.filter((project) => project.status === 'approved' && toMillis(project.createdAt) && toMillis(project.updatedAt))
    if (!completed.length) return 0
    const totalMs = completed.reduce((sum, project) => sum + (toMillis(project.updatedAt) - toMillis(project.createdAt)), 0)
    return totalMs / completed.length / (1000 * 60 * 60)
  }, [projects])

  function updateSelectedCreative(projectId, creativeId) {
    setSelectedCreativeByProject((prev) => ({ ...prev, [projectId]: creativeId }))
  }

  function assignBestMatch(project) {
    const recommendation = recommendationsByProject[project.id]
    const best = recommendation?.bestMatch
    if (!best) return
    onAssignProject(project.id, best.creativeId, {
      assignmentStatus: 'assigned',
      assignmentScore: best.score,
      assignmentReason: best.reason,
      assignmentBreakdown: best.assignmentBreakdown || null,
      assignmentRecommendations: recommendation?.candidates || [],
    })
  }

  const btnCls = "rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all"

  return (
    <section className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
      <h2 className="text-base font-semibold text-white">Project Oversight</h2>

      <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">Bottlenecks (&gt;48h)</p>
          <p className="font-semibold text-white">{bottlenecks.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">QC queue</p>
          <p className="font-semibold text-white">{qcQueue.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">Nearing deadline</p>
          <p className="font-semibold text-white">{nearingDeadline.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">Overdue</p>
          <p className="font-semibold text-red-400">{overdue.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">Avg turnaround</p>
          <p className="font-semibold text-white">{averageTurnaroundHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#141414] p-3 text-sm">
          <p className="text-zinc-500">Unassigned</p>
          <p className="font-semibold text-white">{unassigned.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <h3 className="text-sm font-semibold text-white">Projects by status</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusCounts} dataKey="count" nameKey="status" outerRadius={90} label>
                  {statusCounts.map((entry, index) => (
                    <Cell key={`${entry.status}-${entry.count}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <h3 className="text-sm font-semibold text-white">Status comparison</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="status" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={cursorStyle} />
                <Bar dataKey="count" fill="#C9A227" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
          <h3 className="text-sm font-semibold text-white">Bottlenecks (&gt;48h)</h3>
          <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
            {bottlenecks.length > 0 ? (
              bottlenecks.map((project) => (
                <p key={project.id} className="text-zinc-300">
                  {project.title} · <span className="text-zinc-500">{project.status}</span>
                </p>
              ))
            ) : (
              <p className="text-zinc-500">No bottlenecks detected.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
          <h3 className="text-sm font-semibold text-white">Assignment Recommendations</h3>
          <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
            {unassigned.length > 0 ? (
              unassigned.map((project) => (
                <div key={project.id} className="rounded-lg border border-white/5 bg-[#141414] p-2">
                  <p className="font-medium text-white">{project.title}</p>
                  <p className="text-xs text-zinc-500">
                    Required skills: {Array.isArray(project.requiredSkills) && project.requiredSkills.length > 0 ? project.requiredSkills.join(', ') : 'none'}
                  </p>
                  {Array.isArray(recommendationsByProject[project.id]?.candidates) && recommendationsByProject[project.id].candidates.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {recommendationsByProject[project.id].candidates.map((candidate, index) => (
                        <div key={`${project.id}-${candidate.creativeId}`} className="rounded border border-white/5 bg-[#1A1A1A] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-zinc-200">
                              {index + 1}. {candidate.creativeName}
                            </p>
                            <p className="text-xs font-semibold text-[#C9A227]">Score {candidate.score.toFixed(1)}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">{candidate.reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-amber-400">No eligible creatives (availability/load constraints).</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedCreativeByProject[project.id] || recommendationsByProject[project.id]?.bestMatch?.creativeId || ''}
                      onChange={(event) => updateSelectedCreative(project.id, event.target.value)}
                      className="rounded-lg border border-white/10 bg-[#262626] px-2 py-1 text-xs text-white"
                    >
                      <option value="">Select creative</option>
                      {creatives.map((creative) => (
                        <option key={creative.id} value={creative.id}>
                          {creative.displayName || creative.email || 'Unknown creative'}
                        </option>
                      ))}
                    </select>
                    <button
                      className={btnCls}
                      onClick={() => {
                        const selectedCreativeId = selectedCreativeByProject[project.id] || recommendationsByProject[project.id]?.bestMatch?.creativeId || ''
                        if (!selectedCreativeId) return
                        const selectedRecommendation = recommendationsByProject[project.id]?.candidates?.find((entry) => entry.creativeId === selectedCreativeId) || null
                        onAssignProject(project.id, selectedCreativeId, {
                          assignmentStatus: 'assigned',
                          assignmentScore: selectedRecommendation?.score || null,
                          assignmentReason: selectedRecommendation?.reason || 'Assigned manually by admin',
                          assignmentBreakdown: selectedRecommendation?.assignmentBreakdown || null,
                          assignmentRecommendations: recommendationsByProject[project.id]?.candidates || [],
                        })
                      }}
                    >
                      Assign
                    </button>
                    <button
                      className={btnCls}
                      onClick={() => assignBestMatch(project)}
                      disabled={!recommendationsByProject[project.id]?.bestMatch}
                    >
                      Assign best match
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500">No unassigned projects.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
          <h3 className="text-sm font-semibold text-white">Nearing deadline (&lt;48h)</h3>
          <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
            {nearingDeadline.length > 0 ? (
              nearingDeadline.map((project) => (
                <p key={project.id} className="text-zinc-300">{project.title} · due {formatDate(project.deadline)}</p>
              ))
            ) : (
              <p className="text-zinc-500">No projects nearing deadline.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
          <h3 className="text-sm font-semibold text-white">Overdue projects</h3>
          <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
            {overdue.length > 0 ? (
              overdue.map((project) => (
                <p key={project.id} className="text-red-400">{project.title} · due {formatDate(project.deadline)}</p>
              ))
            ) : (
              <p className="text-zinc-500">No overdue projects.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
        <h3 className="text-sm font-semibold text-white">QC Queue</h3>
        <div className="mt-2 space-y-2 text-sm">
          {qcQueue.length > 0 ? (
            qcQueue.map((project) => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#141414] p-3">
                <p className="text-white">{project.title}</p>
                <div className="flex flex-wrap gap-2">
                  <button className={btnCls} onClick={() => onApproveQC(project.id)}>
                    Approve for client review
                  </button>
                  <button className={btnCls} onClick={() => onRequestRevision(project.id)}>
                    Request revision
                  </button>
                  <button className={btnCls} onClick={() => onOpenWorkspace(project.id)}>
                    Open workspace
                  </button>
                  <button
                    className={btnCls}
                    onClick={() => {
                      const next = window.prompt('Set new confirmed credits', String(project.confirmedCredits || 1))
                      const parsed = Number(next)
                      if (!Number.isFinite(parsed) || parsed <= 0) return
                      onAdjustProjectEstimate?.(project.id, parsed)
                    }}
                  >
                    Adjust credits
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-zinc-500">No projects waiting for QC.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProjectOversightPanel
