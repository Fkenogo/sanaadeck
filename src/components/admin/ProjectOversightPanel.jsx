import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return date.getTime()
}

function formatDate(value) {
  const ms = toMillis(value)
  if (!ms) return 'Unknown'
  return new Date(ms).toLocaleDateString()
}

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
    () => projects.filter((project) => !project.assignedCreativeId && project.status !== 'approved'),
    [projects],
  )

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

  const colors = ['#0f766e', '#2563eb', '#7c3aed', '#ea580c', '#dc2626', '#64748b']

  function updateSelectedCreative(projectId, creativeId) {
    setSelectedCreativeByProject((prev) => ({ ...prev, [projectId]: creativeId }))
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Project Oversight</h2>

      <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">Bottlenecks (&gt;48h)</p>
          <p className="font-semibold">{bottlenecks.length}</p>
        </div>
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">QC queue</p>
          <p className="font-semibold">{qcQueue.length}</p>
        </div>
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">Nearing deadline</p>
          <p className="font-semibold">{nearingDeadline.length}</p>
        </div>
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">Overdue</p>
          <p className="font-semibold text-red-700">{overdue.length}</p>
        </div>
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">Avg turnaround</p>
          <p className="font-semibold">{averageTurnaroundHours.toFixed(1)}h</p>
        </div>
        <div className="rounded border border-border p-2 text-sm">
          <p className="text-muted-foreground">Unassigned</p>
          <p className="font-semibold">{unassigned.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Projects by status</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusCounts} dataKey="count" nameKey="status" outerRadius={90} label>
                  {statusCounts.map((entry, index) => (
                    <Cell key={`${entry.status}-${entry.count}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Status comparison</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Bottlenecks (&gt;48h)</h3>
          <div className="mt-2 space-y-2 text-sm max-h-52 overflow-auto">
            {bottlenecks.length > 0 ? (
              bottlenecks.map((project) => (
                <p key={project.id}>
                  {project.title} · <span className="text-muted-foreground">{project.status}</span>
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No bottlenecks detected.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Manual Assignment</h3>
          <div className="mt-2 space-y-2 text-sm max-h-52 overflow-auto">
            {unassigned.length > 0 ? (
              unassigned.map((project) => (
                <div key={project.id} className="rounded border border-border p-2">
                  <p className="font-medium">{project.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedCreativeByProject[project.id] || ''}
                      onChange={(event) => updateSelectedCreative(project.id, event.target.value)}
                      className="rounded border border-border px-2 py-1"
                    >
                      <option value="">Select creative</option>
                      {creatives.map((creative) => (
                        <option key={creative.id} value={creative.id}>
                          {creative.displayName || creative.email || 'Unknown creative'}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border border-border px-2 py-1"
                      onClick={() => onAssignProject(project.id, selectedCreativeByProject[project.id] || '')}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No unassigned projects.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Nearing deadline (&lt;48h)</h3>
          <div className="mt-2 space-y-2 text-sm max-h-52 overflow-auto">
            {nearingDeadline.length > 0 ? (
              nearingDeadline.map((project) => (
                <p key={project.id}>{project.title} · due {formatDate(project.deadline)}</p>
              ))
            ) : (
              <p className="text-muted-foreground">No projects nearing deadline.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Overdue projects</h3>
          <div className="mt-2 space-y-2 text-sm max-h-52 overflow-auto">
            {overdue.length > 0 ? (
              overdue.map((project) => (
                <p key={project.id} className="text-red-700">{project.title} · due {formatDate(project.deadline)}</p>
              ))
            ) : (
              <p className="text-muted-foreground">No overdue projects.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-border p-3">
        <h3 className="text-sm font-semibold">QC Queue</h3>
        <div className="mt-2 space-y-2 text-sm">
          {qcQueue.length > 0 ? (
            qcQueue.map((project) => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
                <p>{project.title}</p>
                <div className="flex gap-2">
                  <button className="rounded border border-border px-2 py-1" onClick={() => onApproveQC(project.id)}>
                    Approve for client review
                  </button>
                  <button className="rounded border border-border px-2 py-1" onClick={() => onRequestRevision(project.id)}>
                    Request revision
                  </button>
                  <button className="rounded border border-border px-2 py-1" onClick={() => onOpenWorkspace(project.id)}>
                    Open workspace
                  </button>
                  <button
                    className="rounded border border-border px-2 py-1"
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
            <p className="text-muted-foreground">No projects waiting for QC.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProjectOversightPanel
