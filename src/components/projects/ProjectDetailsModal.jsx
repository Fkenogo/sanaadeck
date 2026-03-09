import { format } from 'date-fns'
import { normalizeTimestamp } from '@/utils/timestamp'

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = normalizeTimestamp(timestamp)
  if (!date) return 'Unknown'
  return format(date, 'PPP p')
}

function ProjectDetailsModal({ open, project, onClose }) {
  if (!open || !project) return null
  const briefOverview = project?.brief?.projectOverview || project?.legacyBriefText || project?.description || 'No brief provided.'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Project Details</h3>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p><span className="font-semibold">Title:</span> {project.title}</p>
          <p><span className="font-semibold">Category:</span> {project.categoryTitle || project.category || '-'}</p>
          <p><span className="font-semibold">Deliverable:</span> {project.deliverableTitle || project.deliverableType}</p>
          <p><span className="font-semibold">Status:</span> {project.workflowStatus || project.status}</p>
          <p><span className="font-semibold">Estimated credits:</span> {project.credits ?? project.estimatedCredits ?? 0}</p>
          <p><span className="font-semibold">Confirmed credits:</span> {project.confirmedCredits ?? 0}</p>
          <p><span className="font-semibold">Actual credits used:</span> {project.actualCreditsUsed ?? 'N/A'}</p>
          <p><span className="font-semibold">Created:</span> {formatDate(project.createdAt)}</p>
          <p><span className="font-semibold">Deadline:</span> {formatDate(project.deadline)}</p>
          <p><span className="font-semibold">Assigned creative:</span> {project.assignedCreativeName || project.assignedCreativeEmail || 'Not assigned'}</p>
        </div>

        <div className="mt-4 rounded border border-border p-3">
          <p className="mb-1 text-sm font-semibold">Brief</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{briefOverview}</p>
        </div>
      </div>
    </div>
  )
}

export default ProjectDetailsModal
