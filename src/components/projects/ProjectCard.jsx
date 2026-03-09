import { formatDate } from '@/utils/timestamp'

const statusClassMap = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  review: 'bg-orange-100 text-orange-800',
  revision: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  ready_for_qc: 'bg-orange-100 text-orange-800',
  client_review: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  revision_requested: 'bg-red-100 text-red-800',
}


function getCreativeAvatar(project) {
  const source = project.assignedCreativeName || project.assignedCreativeEmail || ''
  if (!source) return 'NA'
  return source.slice(0, 2).toUpperCase()
}

function ProjectCard({ project, actions = [] }) {
  const status = project.workflowStatus || project.status || 'pending'
  const statusClass = statusClassMap[status] || 'bg-muted text-foreground'
  const briefOverview = project?.brief?.projectOverview || project?.instructions || project?.description || '-'
  const attachmentCount = (Array.isArray(project.inspirationFiles) ? project.inspirationFiles.length : 0) +
    (Array.isArray(project.brandAssets) ? project.brandAssets.length : (Array.isArray(project.brandAssetFiles) ? project.brandAssetFiles.length : 0))

  return (
    <article className="rounded border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{project.title}</h3>
          <p className="text-sm text-muted-foreground">{project.deliverableTitle || project.deliverableType}</p>
          <p className="text-xs text-muted-foreground">{project.categoryTitle || project.category || 'General'}</p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass}`}>{status.replaceAll('_', ' ')}</span>
      </div>

      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <p>Credits: {project.credits ?? project.actualCreditsUsed ?? project.confirmedCredits ?? project.estimatedCredits ?? 0}</p>
        <p>Deadline: {formatDate(project.deadline)}</p>
        <p>Attachments: {attachmentCount}</p>
        <p className="line-clamp-2">Instructions: {briefOverview}</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {getCreativeAvatar(project)}
          </span>
          <span>Assigned creative: {project.assignedCreativeName || project.assignedCreativeEmail || 'Not assigned'}</span>
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export default ProjectCard
