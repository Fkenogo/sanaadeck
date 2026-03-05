import { useEffect, useMemo, useRef, useState } from 'react'
import projectService from '@/services/projectService'
import DeliverableUploader from '@/components/projects/DeliverableUploader'
import FileGallery from '@/components/projects/FileGallery'
import { db } from '@/services/firebase'
import { doc, getDoc } from 'firebase/firestore'

const PAGE_SIZE = 20

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return date.getTime()
}

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function shortenUrl(url = '', max = 96) {
  const text = String(url || '')
  if (text.length <= max) return text
  const head = Math.ceil((max - 3) / 2)
  const tail = Math.floor((max - 3) / 2)
  return `${text.slice(0, head)}...${text.slice(text.length - tail)}`
}

function labelFromUrl(url = '') {
  try {
    const parsed = new URL(url)
    const pathPart = decodeURIComponent(parsed.pathname.split('/').pop() || '')
    if (pathPart) return pathPart
  } catch {
    // no-op
  }
  return shortenUrl(url, 42)
}

function looksLikeImage(url = '') {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)
}

function toEmbedUrl(url = '') {
  if (!url) return ''
  if (url.includes('figma.com')) return `https://www.figma.com/embed?embed_host=sanaadeck&url=${encodeURIComponent(url)}`
  const driveMatch = url.match(/\/d\/([^/]+)/)
  if (url.includes('drive.google.com') && driveMatch?.[1]) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  return ''
}

function getTotalTrackedMinutes(project) {
  const entries = Array.isArray(project?.timeTrackingEntries) ? project.timeTrackingEntries : []
  const entryTotal = entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0)
  return Math.max(entryTotal, Number(project?.totalTrackedMinutes || 0))
}

function statusClasses(status) {
  const map = {
    pending_confirmation: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    ready_for_qc: 'bg-orange-100 text-orange-800',
    client_review: 'bg-indigo-100 text-indigo-800',
    approved: 'bg-green-100 text-green-800',
    revision_requested: 'bg-red-100 text-red-800',
    resolved: 'bg-green-100 text-green-800',
    needs_attention: 'bg-amber-100 text-amber-800',
  }
  return map[status] || 'bg-muted text-foreground'
}

function StatusPill({ status }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${statusClasses(status)}`}>{(status || 'unknown').replaceAll('_', ' ')}</span>
}

function PreviewPanel({ url, compact = false }) {
  if (!url) return <p className="text-sm text-muted-foreground">Select a reference file or version to preview.</p>

  const embedUrl = toEmbedUrl(url)
  const frameHeight = compact ? 'h-48' : 'h-[55vh]'
  return (
    <div className="space-y-2">
      <p className="truncate text-xs text-muted-foreground" title={url}>{shortenUrl(url, compact ? 80 : 120)}</p>
      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Open preview in new tab</a>
      {looksLikeImage(url) ? (
        <img src={url} alt="Design preview" className={`${compact ? 'max-h-48' : 'max-h-[55vh]'} w-full rounded border border-border object-contain`} />
      ) : embedUrl ? (
        <iframe title="Design preview" src={embedUrl} className={`${frameHeight} w-full rounded border border-border`} />
      ) : null}
    </div>
  )
}

function mergeById(first = [], second = []) {
  const map = new Map()
  ;[...second, ...first].forEach((entry) => map.set(entry.id, entry))
  return [...map.values()]
}

function displayIdentity(entry = {}, fallbackId = 'unknown') {
  return entry.displayName || entry.authorDisplayName || entry.actorDisplayName || entry.email || entry.authorEmail || entry.actorEmail || fallbackId
}

function normalizeWorkspaceFiles(files = []) {
  return files
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          id: `legacy-ref-${index}`,
          url: entry,
          fileName: entry.split('/').pop() || `reference-${index + 1}`,
          size: 0,
          type: '',
          source: 'external',
        }
      }
      return {
        id: entry.id || `ref-${index}`,
        url: entry.url || '',
        fileName: entry.fileName || entry.name || `reference-${index + 1}`,
        size: Number(entry.size || 0),
        type: entry.type || '',
        source: entry.source || 'storage',
      }
    })
    .filter((entry) => entry.url)
}

function CommentNode({
  comment,
  replies,
  onUpdateCommentStatus,
  onStartReply,
  onReplyTextChange,
  replyText,
  onSubmitReply,
  saving,
  projectId,
  anchorId,
  level = 0,
  getUserLabel,
}) {
  const authorLabel = getUserLabel?.(comment.authorId, comment.authorDisplayName, comment.authorEmail) || displayIdentity(comment, comment.authorId || 'unknown')
  return (
    <div id={anchorId} className={`rounded border border-border bg-white p-2 ${level > 0 ? 'ml-6 mt-2' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {comment.authorRole || 'user'} · {authorLabel} · {formatDateTime(comment.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          <StatusPill status={comment.status || 'needs_attention'} />
          <select
            value={comment.status || 'needs_attention'}
            onChange={(event) => onUpdateCommentStatus?.(projectId, comment.id, event.target.value)}
            className="rounded border border-border px-2 py-1 text-xs"
            disabled={saving || !onUpdateCommentStatus}
          >
            <option value="needs_attention">needs attention</option>
            <option value="resolved">resolved</option>
            <option value="approved">approved</option>
          </select>
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      <button className="mt-2 rounded border border-border px-2 py-1 text-xs" onClick={() => onStartReply(comment.id)}>Reply</button>
      {replyText !== undefined ? (
        <div className="mt-2 flex gap-2">
          <input value={replyText} onChange={(e) => onReplyTextChange(e.target.value)} placeholder="Reply with @mentions" className="w-full rounded border border-border px-2 py-1 text-sm" />
          <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onSubmitReply(comment.id)} disabled={saving}>Send</button>
        </div>
      ) : null}
      {replies.map((reply) => (
        <CommentNode
          key={reply.id}
          comment={reply}
          replies={[]}
          onUpdateCommentStatus={onUpdateCommentStatus}
          onStartReply={onStartReply}
          onReplyTextChange={onReplyTextChange}
          replyText={undefined}
          onSubmitReply={onSubmitReply}
          saving={saving}
          projectId={projectId}
          level={1}
          getUserLabel={getUserLabel}
        />
      ))}
    </div>
  )
}

function ProjectWorkspace({
  project,
  currentUser,
  workspaceRole = 'creative',
  initialTab = 'overview',
  onClose,
  onStart,
  onSave,
  onSubmitQC,
  onAddDeliverableLink,
  onAddComment,
  onUpdateCommentStatus,
  onSubmitRating,
  onApproveProject,
  onApproveForClientReview,
  onRequestRevision,
  saving,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview')
  const [actualCreditsUsed, setActualCreditsUsed] = useState(Number(project?.actualCreditsUsed || project?.confirmedCredits || 0))
  const [workspaceNotes, setWorkspaceNotes] = useState(project?.workspaceNotes || '')
  const [deliverableLink, setDeliverableLink] = useState('')
  const [deliverableNote, setDeliverableNote] = useState('')
  const [quickLinkTarget, setQuickLinkTarget] = useState('revisions')
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [replyText, setReplyText] = useState('')
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('')
  const [tracking, setTracking] = useState(false)
  const [trackedSeconds, setTrackedSeconds] = useState(0)
  const [showLargePreview, setShowLargePreview] = useState(false)
  const [commentFilter, setCommentFilter] = useState('all')
  const [ratingValue, setRatingValue] = useState(Number(project?.clientRating?.rating || 5))
  const [ratingFeedback, setRatingFeedback] = useState(project?.clientRating?.feedback || '')

  const [commentsFirstPage, setCommentsFirstPage] = useState([])
  const [commentsOlderPages, setCommentsOlderPages] = useState([])
  const [commentsCursor, setCommentsCursor] = useState(null)
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)

  const [versionsFirstPage, setVersionsFirstPage] = useState([])
  const [versionsOlderPages, setVersionsOlderPages] = useState([])
  const [versionsCursor, setVersionsCursor] = useState(null)
  const [versionsHasMore, setVersionsHasMore] = useState(false)
  const [versionsLoadingMore, setVersionsLoadingMore] = useState(false)

  const [notesFirstPage, setNotesFirstPage] = useState([])
  const [notesOlderPages, setNotesOlderPages] = useState([])
  const [notesCursor, setNotesCursor] = useState(null)
  const [notesHasMore, setNotesHasMore] = useState(false)
  const [notesLoadingMore, setNotesLoadingMore] = useState(false)

  const [activitiesFirstPage, setActivitiesFirstPage] = useState([])
  const [activitiesOlderPages, setActivitiesOlderPages] = useState([])
  const [activitiesCursor, setActivitiesCursor] = useState(null)
  const [activitiesHasMore, setActivitiesHasMore] = useState(false)
  const [activitiesLoadingMore, setActivitiesLoadingMore] = useState(false)
  const [projectMembers, setProjectMembers] = useState([])
  const [presenceMembers, setPresenceMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('project_collaborator')
  const [memberRoleDrafts, setMemberRoleDrafts] = useState({})
  const [transferOwnerUid, setTransferOwnerUid] = useState('')
  const [memberActionBusy, setMemberActionBusy] = useState(false)
  const [userDirectory, setUserDirectory] = useState({})
  const [noteReplyTextByNote, setNoteReplyTextByNote] = useState({})
  const backfillAttemptedProjectRef = useRef('')

  useEffect(() => {
    setActiveTab(initialTab || 'overview')
  }, [project.id, initialTab])

  useEffect(() => {
    setCommentsOlderPages([])
    setVersionsOlderPages([])
    setNotesOlderPages([])
    setActivitiesOlderPages([])
    setSelectedPreviewUrl('')
    setReplyTo('')
    setReplyText('')
  }, [project.id])

  useEffect(() => {
    let cancelled = false

    const candidateIds = new Set()
    projectMembers.forEach((entry) => entry?.uid && candidateIds.add(entry.uid))
    presenceMembers.forEach((entry) => entry?.uid && candidateIds.add(entry.uid))
    notesFirstPage.forEach((entry) => entry?.authorId && candidateIds.add(entry.authorId))
    notesOlderPages.forEach((entry) => entry?.authorId && candidateIds.add(entry.authorId))
    commentsFirstPage.forEach((entry) => entry?.authorId && candidateIds.add(entry.authorId))
    commentsOlderPages.forEach((entry) => entry?.authorId && candidateIds.add(entry.authorId))
    activitiesFirstPage.forEach((entry) => entry?.actorId && candidateIds.add(entry.actorId))
    activitiesOlderPages.forEach((entry) => entry?.actorId && candidateIds.add(entry.actorId))
    if (project?.clientId) candidateIds.add(project.clientId)
    if (project?.assignedCreativeId) candidateIds.add(project.assignedCreativeId)

    const unresolved = [...candidateIds].filter((uid) => uid && !userDirectory[uid])
    if (unresolved.length === 0) return undefined

    async function resolveDirectory() {
      const entries = await Promise.all(unresolved.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid))
          if (userSnap.exists()) {
            const user = userSnap.data() || {}
            return [uid, {
              displayName: user.displayName || null,
              email: user.email || null,
            }]
          }

          const [clientSnap, creativeSnap] = await Promise.all([
            getDoc(doc(db, 'clients', uid)),
            getDoc(doc(db, 'creatives', uid)),
          ])

          if (clientSnap.exists()) {
            const client = clientSnap.data() || {}
            return [uid, { displayName: client.businessName || null, email: client.email || null }]
          }
          if (creativeSnap.exists()) {
            const creative = creativeSnap.data() || {}
            return [uid, { displayName: creative.displayName || null, email: creative.email || null }]
          }
        } catch (error) {
          console.error('Failed to resolve workspace user label:', uid, error)
        }
        return [uid, { displayName: null, email: null }]
      }))

      if (cancelled) return
      setUserDirectory((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    }

    resolveDirectory()
    return () => {
      cancelled = true
    }
  }, [
    project?.clientId,
    project?.assignedCreativeId,
    projectMembers,
    presenceMembers,
    notesFirstPage,
    notesOlderPages,
    commentsFirstPage,
    commentsOlderPages,
    activitiesFirstPage,
    activitiesOlderPages,
    userDirectory,
  ])

  useEffect(() => {
    const nextDrafts = {}
    projectMembers.forEach((member) => {
      nextDrafts[member.uid] = member.role || 'project_collaborator'
    })
    setMemberRoleDrafts(nextDrafts)
  }, [projectMembers])

  useEffect(() => {
    const unsubscribe = projectService.subscribeToProjectMembers(
      project.id,
      (items) => setProjectMembers(items),
      (error) => console.error('Failed to load project members:', error),
    )
    return () => unsubscribe()
  }, [project.id])

  useEffect(() => {
    const unsubscribe = projectService.subscribeToWorkspacePresence(
      project.id,
      (items) => setPresenceMembers(items),
      (error) => console.error('Failed to load workspace presence:', error),
    )
    return () => unsubscribe()
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    if (!project?.id) return undefined
    if (backfillAttemptedProjectRef.current === project.id) return undefined
    backfillAttemptedProjectRef.current = project.id

    async function runBackfill() {
      try {
        await projectService.backfillWorkspaceDataForProject(project, {
          uid: currentUser?.uid,
          role: workspaceRole,
        })
      } catch (error) {
        if (!cancelled) {
          console.error('Workspace legacy data backfill failed:', error)
        }
      }
    }

    runBackfill()
    return () => {
      cancelled = true
    }
  }, [project, currentUser?.uid, workspaceRole])

  useEffect(() => {
    if (!project?.id || !currentUser?.uid) return undefined

    let cancelled = false

    async function heartbeat() {
      try {
        await projectService.upsertWorkspacePresence(project.id, {
          uid: currentUser.uid,
          role: workspaceRole,
          displayName: currentUser?.displayName,
          email: currentUser?.email,
          activeTab,
        })
      } catch (error) {
        if (!cancelled) console.error('Failed to update workspace presence:', error)
      }
    }

    heartbeat()
    const timer = setInterval(heartbeat, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
      projectService.clearWorkspacePresence(project.id, currentUser.uid).catch((error) => {
        console.error('Failed to clear workspace presence:', error)
      })
    }
  }, [project.id, currentUser?.uid, currentUser?.displayName, currentUser?.email, workspaceRole, activeTab])

  useEffect(() => {
    if (!project?.id || !currentUser?.uid) return
    projectService.markWorkspaceTabRead(project.id, currentUser.uid, activeTab).catch((error) => {
      console.error('Failed to mark workspace tab as read:', error)
    })
  }, [project.id, currentUser?.uid, activeTab])

  useEffect(() => {
    if (!tracking) return undefined
    const timer = setInterval(() => setTrackedSeconds((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [tracking])

  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) return false
      const tagName = String(target.tagName || '').toLowerCase()
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
    }

    function handleKeydown(event) {
      if (isTypingTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (showLargePreview) setShowLargePreview(false)
        else onClose?.()
        return
      }
      if (event.key === '1') setActiveTab('overview')
      if (event.key === '2') setActiveTab('production')
      if (event.key === '3') setActiveTab('review')
      if (event.key === '4') setActiveTab('activity')
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [showLargePreview, onClose])

  useEffect(() => {
    const unsubComments = projectService.subscribeToWorkspaceCollection(
      project.id,
      'comments',
      PAGE_SIZE,
      ({ items, cursor, hasMore }) => {
        setCommentsFirstPage(items)
        setCommentsCursor(cursor)
        setCommentsHasMore(hasMore)
      },
    )

    const unsubVersions = projectService.subscribeToWorkspaceCollection(
      project.id,
      'versions',
      PAGE_SIZE,
      ({ items, cursor, hasMore }) => {
        setVersionsFirstPage(items)
        setVersionsCursor(cursor)
        setVersionsHasMore(hasMore)
      },
    )

    const unsubNotes = projectService.subscribeToWorkspaceCollection(
      project.id,
      'notes',
      PAGE_SIZE,
      ({ items, cursor, hasMore }) => {
        setNotesFirstPage(items)
        setNotesCursor(cursor)
        setNotesHasMore(hasMore)
      },
    )

    const unsubActivities = projectService.subscribeToWorkspaceCollection(
      project.id,
      'activities',
      PAGE_SIZE,
      ({ items, cursor, hasMore }) => {
        setActivitiesFirstPage(items)
        setActivitiesCursor(cursor)
        setActivitiesHasMore(hasMore)
      },
    )

    return () => {
      unsubComments()
      unsubVersions()
      unsubNotes()
      unsubActivities()
    }
  }, [project.id])

  useEffect(() => {
    if (selectedPreviewUrl) return
    const firstVersionUrl = versionsFirstPage[0]?.url || versionsOlderPages[0]?.url
    const firstReferenceUrl = Array.isArray(project?.referenceFiles) ? normalizeWorkspaceFiles(project.referenceFiles)[0]?.url : ''
    const next = firstVersionUrl || firstReferenceUrl || ''
    if (next) setSelectedPreviewUrl(next)
  }, [selectedPreviewUrl, versionsFirstPage, versionsOlderPages, project?.referenceFiles])

  const isClient = workspaceRole === 'client'
  const isCreative = workspaceRole === 'creative'
  const isProjectAdmin = ['project_admin', 'app_admin', 'super_admin', 'admin'].includes(workspaceRole)
  const canEditProduction = isCreative || isProjectAdmin
  const canAdjustCreditsUsed = isProjectAdmin
  const canUploadDeliverables = isCreative
  const canRunTimeTracker = isCreative
  const canApproveClientReview = isClient
  const canApproveQC = isProjectAdmin
  const canSubmitForQC = canEditProduction && ['confirmed', 'in_progress', 'revision_requested'].includes(project.status)
  const waitingForReview = ['ready_for_qc', 'client_review'].includes(project.status)
  const submitQcReason = canSubmitForQC ? '' : `Submit for QC is available only for confirmed, in progress, or revision requested. Current: ${project.status || 'unknown'}.`
  const defaultUploaderTarget = useMemo(() => {
    if (project.status === 'in_progress') return 'wip'
    if (project.status === 'approved') return 'final'
    return 'revisions'
  }, [project.status])

  useEffect(() => {
    setQuickLinkTarget(defaultUploaderTarget)
  }, [defaultUploaderTarget])

  const comments = useMemo(
    () => mergeById(commentsFirstPage, commentsOlderPages).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)),
    [commentsFirstPage, commentsOlderPages],
  )

  const filteredComments = useMemo(
    () => {
      const scoped = comments.filter((entry) => !entry.noteId)
      return commentFilter === 'all'
        ? scoped
        : scoped.filter((entry) => (entry.status || 'needs_attention') === commentFilter)
    },
    [comments, commentFilter],
  )

  const rootComments = useMemo(() => filteredComments.filter((entry) => !entry.parentId), [filteredComments])
  const noteCommentsByNoteId = useMemo(() => {
    const map = {}
    comments.forEach((entry) => {
      if (!entry.noteId) return
      if (!map[entry.noteId]) map[entry.noteId] = []
      map[entry.noteId].push(entry)
    })
    Object.keys(map).forEach((noteId) => {
      map[noteId].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
    })
    return map
  }, [comments])
  const repliesByParent = useMemo(() => {
    const map = {}
    filteredComments.forEach((entry) => {
      if (!entry.parentId) return
      if (!map[entry.parentId]) map[entry.parentId] = []
      map[entry.parentId].push(entry)
    })
    return map
  }, [filteredComments])

  const commentsByStatus = useMemo(() => {
    const acc = { needs_attention: 0, resolved: 0, approved: 0 }
    rootComments.forEach((entry) => {
      const status = entry.status || 'needs_attention'
      if (acc[status] === undefined) acc[status] = 0
      acc[status] += 1
    })
    return acc
  }, [rootComments])

  const referenceFiles = useMemo(() => normalizeWorkspaceFiles(Array.isArray(project.referenceFiles) ? project.referenceFiles : []), [project.referenceFiles])
  const versions = useMemo(() => mergeById(versionsFirstPage, versionsOlderPages).sort((a, b) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0)), [versionsFirstPage, versionsOlderPages])
  const notes = useMemo(() => mergeById(notesFirstPage, notesOlderPages).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)), [notesFirstPage, notesOlderPages])
  const activities = useMemo(() => mergeById(activitiesFirstPage, activitiesOlderPages).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)), [activitiesFirstPage, activitiesOlderPages])

  const allPreviewItems = useMemo(() => {
    const refs = referenceFiles.map((entry, index) => ({ label: entry.fileName || `Reference ${index + 1}`, url: entry.url, kind: 'reference' }))
    const deliverables = versions.map((entry, index) => ({ label: entry.version || `v${index + 1}`, url: entry.url, kind: 'deliverable' }))
    return [...deliverables, ...refs]
  }, [referenceFiles, versions])

  const existingClientRating = project.clientRating || null
  const sessionMinutes = Math.floor(trackedSeconds / 60)
  const totalTrackedMinutes = getTotalTrackedMinutes(project)
  const roleOptions = ['project_admin', 'app_admin', 'project_collaborator', 'creative_lead']
  const currentOwnerUid = project?.clientId || ''
  const ownershipCandidates = useMemo(
    () => projectMembers.filter((member) => member.uid !== currentOwnerUid && (member.status || 'active') === 'active'),
    [projectMembers, currentOwnerUid],
  )
  const activePresence = useMemo(
    () => presenceMembers.filter((entry) => (entry.status || 'online') === 'online' && toMillis(entry.updatedAt) > Date.now() - 90_000),
    [presenceMembers],
  )

  useEffect(() => {
    if (ownershipCandidates.length === 0) {
      setTransferOwnerUid('')
      return
    }
    const valid = ownershipCandidates.some((member) => member.uid === transferOwnerUid)
    if (!valid) setTransferOwnerUid(ownershipCandidates[0].uid)
  }, [ownershipCandidates, transferOwnerUid])

  function commentAnchorId(commentId) {
    return `comment-${commentId}`
  }

  function noteCommentKey(noteId, parentId = null) {
    return parentId ? `note:${noteId}:reply:${parentId}` : `note:${noteId}:root`
  }

  function getUserLabel(uid, explicitDisplayName = null, explicitEmail = null) {
    if (explicitDisplayName) return explicitDisplayName
    if (explicitEmail) return explicitEmail
    const member = projectMembers.find((entry) => entry.uid === uid)
    if (member?.displayName) return member.displayName
    if (member?.email) return member.email
    const presence = presenceMembers.find((entry) => entry.uid === uid)
    if (presence?.displayName) return presence.displayName
    if (presence?.email) return presence.email
    const directory = userDirectory[uid]
    if (directory?.displayName) return directory.displayName
    if (directory?.email) return directory.email
    return uid || 'unknown'
  }

  function jumpToComment(commentId) {
    const node = document.getElementById(commentAnchorId(commentId))
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleLoadMoreComments() {
    if (!commentsHasMore || !commentsCursor || commentsLoadingMore) return
    setCommentsLoadingMore(true)
    try {
      const page = await projectService.fetchWorkspaceCollectionPage(project.id, 'comments', PAGE_SIZE, commentsCursor)
      setCommentsOlderPages((prev) => mergeById(page.items, prev))
      setCommentsCursor(page.cursor)
      setCommentsHasMore(page.hasMore)
    } finally {
      setCommentsLoadingMore(false)
    }
  }

  async function handleLoadMoreVersions() {
    if (!versionsHasMore || !versionsCursor || versionsLoadingMore) return
    setVersionsLoadingMore(true)
    try {
      const page = await projectService.fetchWorkspaceCollectionPage(project.id, 'versions', PAGE_SIZE, versionsCursor)
      setVersionsOlderPages((prev) => mergeById(page.items, prev))
      setVersionsCursor(page.cursor)
      setVersionsHasMore(page.hasMore)
    } finally {
      setVersionsLoadingMore(false)
    }
  }

  async function handleLoadMoreNotes() {
    if (!notesHasMore || !notesCursor || notesLoadingMore) return
    setNotesLoadingMore(true)
    try {
      const page = await projectService.fetchWorkspaceCollectionPage(project.id, 'notes', PAGE_SIZE, notesCursor)
      setNotesOlderPages((prev) => mergeById(page.items, prev))
      setNotesCursor(page.cursor)
      setNotesHasMore(page.hasMore)
    } finally {
      setNotesLoadingMore(false)
    }
  }

  async function handleLoadMoreActivities() {
    if (!activitiesHasMore || !activitiesCursor || activitiesLoadingMore) return
    setActivitiesLoadingMore(true)
    try {
      const page = await projectService.fetchWorkspaceCollectionPage(project.id, 'activities', PAGE_SIZE, activitiesCursor)
      setActivitiesOlderPages((prev) => mergeById(page.items, prev))
      setActivitiesCursor(page.cursor)
      setActivitiesHasMore(page.hasMore)
    } finally {
      setActivitiesLoadingMore(false)
    }
  }

  async function handleAddDeliverable() {
    if (!onAddDeliverableLink || !deliverableLink.trim()) return
    await onAddDeliverableLink(project.id, deliverableLink, {
      note: deliverableNote,
      targetFolder: quickLinkTarget,
    })
    setDeliverableLink('')
    setDeliverableNote('')
  }

  async function handlePublishDeliverableVersion(payload) {
    if (!onAddDeliverableLink) return
    const primary = payload?.files?.[0]?.url || ''
    if (!primary) return
    await onAddDeliverableLink(project.id, primary, payload)
  }

  async function handleAddWorkspaceComment() {
    if (!onAddComment || !commentText.trim()) return
    await onAddComment(project.id, {
      content: commentText,
      authorId: currentUser?.uid,
      authorRole: workspaceRole,
      parentId: null,
      status: 'needs_attention',
    })
    setCommentText('')
  }

  async function handleSubmitReply(parentId) {
    if (!onAddComment || !replyText.trim()) return
    await onAddComment(project.id, {
      content: replyText,
      authorId: currentUser?.uid,
      authorRole: workspaceRole,
      parentId,
      status: 'needs_attention',
    })
    setReplyTo('')
    setReplyText('')
  }

  async function handleSubmitNoteComment(noteId, parentId = null) {
    if (!onAddComment || !noteId) return
    const key = noteCommentKey(noteId, parentId)
    const content = String(noteReplyTextByNote[key] || '').trim()
    if (!content) return

    await onAddComment(project.id, {
      content,
      authorId: currentUser?.uid,
      authorRole: workspaceRole,
      parentId,
      noteId,
      status: 'needs_attention',
    })

    setNoteReplyTextByNote((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleStopTimerAndLog() {
    if (!onSave || !tracking) return
    setTracking(false)
    if (sessionMinutes > 0) {
      await onSave(project.id, { trackedMinutes: sessionMinutes })
      setTrackedSeconds(0)
    }
  }

  async function handleSaveNotes() {
    if (!onSave) return
    const hasNoteContent = workspaceNotes.trim().length > 0
    await onSave(project.id, {
      actualCreditsUsed,
      workspaceNotes,
      workspaceNoteEntry: hasNoteContent
        ? {
            content: workspaceNotes,
            authorId: currentUser?.uid,
            authorRole: workspaceRole,
          }
        : null,
    })
    setWorkspaceNotes('')
  }

  function handleOpenFullscreen() {
    const candidate = selectedPreviewUrl || allPreviewItems[0]?.url || ''
    if (!candidate) return
    if (!selectedPreviewUrl) setSelectedPreviewUrl(candidate)
    setShowLargePreview(true)
  }

  async function handleSubmitRating() {
    if (!onSubmitRating) return
    await onSubmitRating(project.id, { rating: ratingValue, feedback: ratingFeedback })
  }

  async function handleAddMember() {
    if (!isProjectAdmin || !memberEmail.trim()) return
    setMemberActionBusy(true)
    try {
      await projectService.addProjectMemberByEmail(
        project.id,
        { email: memberEmail, role: memberRole, status: 'active' },
        { uid: currentUser?.uid, role: workspaceRole },
      )
      setMemberEmail('')
    } catch (error) {
      console.error('Failed to add project member:', error)
    } finally {
      setMemberActionBusy(false)
    }
  }

  async function handleSetMemberStatus(memberUid, status) {
    if (!isProjectAdmin || !memberUid) return
    setMemberActionBusy(true)
    try {
      await projectService.updateProjectMemberStatus(
        project.id,
        memberUid,
        status,
        { uid: currentUser?.uid, role: workspaceRole },
      )
    } catch (error) {
      console.error('Failed to update project member status:', error)
    } finally {
      setMemberActionBusy(false)
    }
  }

  async function handleSetMemberRole(memberUid) {
    if (!isProjectAdmin || !memberUid) return
    const nextRole = memberRoleDrafts[memberUid]
    if (!nextRole) return

    setMemberActionBusy(true)
    try {
      await projectService.updateProjectMemberRole(
        project.id,
        memberUid,
        nextRole,
        { uid: currentUser?.uid, role: workspaceRole },
      )
    } catch (error) {
      console.error('Failed to update project member role:', error)
    } finally {
      setMemberActionBusy(false)
    }
  }

  async function handleRemoveMember(memberUid) {
    if (!isProjectAdmin || !memberUid) return
    setMemberActionBusy(true)
    try {
      await projectService.removeProjectMember(
        project.id,
        memberUid,
        { uid: currentUser?.uid, role: workspaceRole },
      )
    } catch (error) {
      console.error('Failed to remove project member:', error)
    } finally {
      setMemberActionBusy(false)
    }
  }

  async function handleTransferOwnership() {
    if (!isProjectAdmin || !transferOwnerUid) return
    const target = projectMembers.find((member) => member.uid === transferOwnerUid)
    const targetLabel = getUserLabel(target?.uid, target?.displayName, target?.email)
    const confirmed = window.confirm(`Transfer project ownership to ${targetLabel}?`)
    if (!confirmed) return

    setMemberActionBusy(true)
    try {
      await projectService.transferProjectOwnership(
        project.id,
        transferOwnerUid,
        { uid: currentUser?.uid, role: workspaceRole },
      )
    } catch (error) {
      console.error('Failed to transfer project ownership:', error)
    } finally {
      setMemberActionBusy(false)
    }
  }

  function renderProductionActions() {
    return (
      <div className="flex flex-wrap gap-2">
        {canEditProduction && project.status === 'confirmed' ? (
          <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => onStart?.(project.id)} disabled={saving || !onStart}>Start project</button>
        ) : null}
        {canEditProduction ? (
          <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleSaveNotes} disabled={saving || !onSave}>Save notes</button>
        ) : null}
        {canEditProduction ? (
          <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => onSubmitQC?.(project.id, { actualCreditsUsed, workspaceNotes })} disabled={saving || !canSubmitForQC || !onSubmitQC}>
            {saving ? 'Submitting...' : 'Submit for QC'}
          </button>
        ) : null}
        {canApproveQC && project.status === 'ready_for_qc' ? (
          <>
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => onApproveForClientReview?.(project.id)} disabled={saving || !onApproveForClientReview}>Approve for client review</button>
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => onRequestRevision?.(project.id)} disabled={saving || !onRequestRevision}>Request revision</button>
          </>
        ) : null}
        {canApproveClientReview && project.status === 'client_review' ? (
          <>
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => onApproveProject?.(project.id)} disabled={saving || !onApproveProject}>Approve project</button>
            <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => onRequestRevision?.(project.id)} disabled={saving || !onRequestRevision}>Request revision</button>
          </>
        ) : null}
      </div>
    )
  }

  function renderStickyBar() {
    const shortcuts = [
      { key: 'overview', label: '1 Overview' },
      { key: 'production', label: '2 Production' },
      { key: 'review', label: '3 Review' },
      { key: 'activity', label: '4 Activity' },
    ]
    return (
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {shortcuts.map((entry) => (
            <button
              key={`shortcut-${entry.key}`}
              className={`rounded px-2 py-1 ${activeTab === entry.key ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => setActiveTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
          <button className="rounded bg-muted px-2 py-1" onClick={() => onClose?.()}>Esc Close</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border border-border px-3 py-1.5 text-xs" onClick={() => setActiveTab('review')}>Go to comments</button>
          <button className="rounded border border-border px-3 py-1.5 text-xs" onClick={() => setActiveTab('production')} disabled={!canEditProduction}>Go to production</button>
          {canEditProduction ? <button className="rounded border border-border px-3 py-1.5 text-xs" onClick={handleSaveNotes} disabled={saving || !onSave}>Save</button> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[1px]">
      <div className="h-[94vh] w-full max-w-[1400px] overflow-hidden rounded-xl border border-border bg-slate-50 shadow-2xl">
        <header className="border-b border-border bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Project Workspace</h2>
              <p className="text-sm text-muted-foreground">{project.title} · {project.deliverableType}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active now: {activePresence.length > 0
                  ? activePresence.map((entry) => getUserLabel(entry.uid, entry.displayName, entry.email)).join(', ')
                  : 'No active collaborators'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={project.status} />
              <button className="rounded border border-border px-3 py-2 text-sm" onClick={onClose}>Close</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'production', label: 'Production' },
              { key: 'review', label: 'Review & comments' },
              { key: 'activity', label: 'Activity' },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`rounded px-3 py-1.5 text-sm ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="h-[calc(94vh-126px)] overflow-auto p-5">
          {activeTab === 'overview' ? (
            <div className="grid gap-4 xl:grid-cols-5">
              <section className="rounded border border-border bg-white p-4 text-sm xl:col-span-2">
                <h3 className="mb-3 font-semibold">Project brief</h3>
                <p><span className="font-medium">Title:</span> {project.title}</p>
                <p><span className="font-medium">Deliverable:</span> {project.deliverableType}</p>
                <p><span className="font-medium">Created:</span> {formatDateTime(project.createdAt)}</p>
                <p><span className="font-medium">Deadline:</span> {formatDateTime(project.deadline)}</p>
                {waitingForReview ? <p className="mt-3 rounded bg-muted p-2 text-xs text-muted-foreground">Work submitted. Waiting for quality control or client review.</p> : null}
                <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{project.brief || project.description || 'No brief provided.'}</p>
                <div className="mt-4 rounded border border-border p-3">
                  <p className="font-semibold">Time tracking</p>
                  <p className="mt-1 text-xs text-muted-foreground">Session tracked: {sessionMinutes} min</p>
                  <p className="text-xs text-muted-foreground">Total tracked: {totalTrackedMinutes} min</p>
                  {canRunTimeTracker ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => setTracking(true)} disabled={saving || tracking}>
                        Start timer
                      </button>
                      <button className="rounded border border-border px-2 py-1 text-xs" onClick={handleStopTimerAndLog} disabled={saving || !tracking}>
                        Stop and log
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">View-only for your role.</p>
                  )}
                </div>
                <div className="mt-4 rounded border border-border p-3">
                  <p className="font-semibold">Workspace members</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {projectMembers.length > 0 ? projectMembers.map((member) => (
                      <div key={member.uid} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
                        <div>
                          <p className="font-medium">{getUserLabel(member.uid, member.displayName, member.email)}</p>
                          <p className="text-muted-foreground">
                            {member.role || 'unknown'} · {member.status || 'active'}
                            {member.uid === currentOwnerUid ? ' · owner' : ''}
                          </p>
                        </div>
                        {isProjectAdmin && member.uid !== currentUser?.uid ? (
                          <div className="flex flex-wrap gap-1">
                            <select
                              value={memberRoleDrafts[member.uid] || member.role || 'project_collaborator'}
                              onChange={(event) => setMemberRoleDrafts((prev) => ({ ...prev, [member.uid]: event.target.value }))}
                              className="rounded border border-border px-2 py-1"
                              disabled={memberActionBusy}
                            >
                              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <button
                              className="rounded border border-border px-2 py-1"
                              onClick={() => handleSetMemberRole(member.uid)}
                              disabled={memberActionBusy || (memberRoleDrafts[member.uid] || member.role) === member.role}
                            >
                              Update role
                            </button>
                            <button
                              className="rounded border border-border px-2 py-1"
                              onClick={() => handleSetMemberStatus(member.uid, 'active')}
                              disabled={memberActionBusy || member.status === 'active'}
                            >
                              Activate
                            </button>
                            <button
                              className="rounded border border-border px-2 py-1"
                              onClick={() => handleSetMemberStatus(member.uid, 'inactive')}
                              disabled={memberActionBusy || member.status === 'inactive'}
                            >
                              Deactivate
                            </button>
                            <button
                              className="rounded border border-border px-2 py-1"
                              onClick={() => handleRemoveMember(member.uid)}
                              disabled={memberActionBusy || member.uid === currentOwnerUid || member.role === 'client_owner'}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <p className="text-muted-foreground">No explicit members yet.</p>
                    )}
                  </div>
                  {isProjectAdmin ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-[11px] text-muted-foreground">Transfer project ownership</p>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={transferOwnerUid}
                          onChange={(event) => setTransferOwnerUid(event.target.value)}
                          className="rounded border border-border px-2 py-1.5 text-xs"
                          disabled={memberActionBusy || ownershipCandidates.length === 0}
                        >
                          {ownershipCandidates.length === 0 ? (
                            <option value="">No active candidates</option>
                          ) : ownershipCandidates.map((member) => (
                            <option key={`owner-${member.uid}`} value={member.uid}>
                              {getUserLabel(member.uid, member.displayName, member.email)}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded border border-border px-2 py-1.5 text-xs"
                          onClick={handleTransferOwnership}
                          disabled={memberActionBusy || !transferOwnerUid}
                        >
                          Transfer ownership
                        </button>
                      </div>

                      <p className="pt-1 text-[11px] text-muted-foreground">Add member</p>
                      <input
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="Add member by email"
                        className="w-full rounded border border-border px-2 py-1.5 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={memberRole}
                          onChange={(event) => setMemberRole(event.target.value)}
                          className="rounded border border-border px-2 py-1.5 text-xs"
                        >
                          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <button
                          className="rounded border border-border px-2 py-1.5 text-xs"
                          onClick={handleAddMember}
                          disabled={memberActionBusy}
                        >
                          Add member
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded border border-border bg-white p-4 text-sm xl:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Large preview stage</h3>
                  <button className="rounded border border-border px-3 py-1 text-xs" onClick={handleOpenFullscreen}>Open fullscreen</button>
                </div>
                <PreviewPanel url={selectedPreviewUrl} />
                <div className="mt-4">
                  <h4 className="font-medium">Assets and versions</h4>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {allPreviewItems.length > 0 ? allPreviewItems.map((item, index) => (
                      <button key={`${item.url}-${index}`} className="rounded border border-border p-2 text-left text-xs hover:bg-muted" onClick={() => setSelectedPreviewUrl(item.url)}>
                        <p className="font-semibold">{item.label || labelFromUrl(item.url)}</p>
                        <p className="text-[11px] uppercase text-muted-foreground">{item.kind}</p>
                        <p className="mt-1 truncate text-muted-foreground" title={item.url}>{shortenUrl(item.url, 84)}</p>
                      </button>
                    )) : <p className="text-xs text-muted-foreground">No files or versions uploaded yet.</p>}
                  </div>
                </div>
                <div className="mt-4 rounded border border-border p-3">
                  <h4 className="text-sm font-semibold">Reference files gallery</h4>
                  <div className="mt-2">
                    <FileGallery files={referenceFiles} />
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'production' ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded border border-border bg-white p-4 text-sm xl:col-span-2">
                <h3 className="font-semibold">Production notes</h3>
                <label className="mb-1 mt-3 block">Actual credits used</label>
                <input type="number" min="0" step="1" value={actualCreditsUsed} onChange={(e) => setActualCreditsUsed(Number(e.target.value))} className="w-full rounded border border-border px-3 py-2" disabled={!canAdjustCreditsUsed} />
                <label className="mb-1 mt-3 block">Workspace notes</label>
                <textarea rows={8} value={workspaceNotes} onChange={(e) => setWorkspaceNotes(e.target.value)} className="w-full rounded border border-border px-3 py-2" disabled={!canEditProduction} />
                <div className="mt-4">{renderProductionActions()}</div>
                {!canSubmitForQC ? <p className="mt-2 text-xs text-muted-foreground">{submitQcReason}</p> : null}
              </section>

              <section className="rounded border border-border bg-white p-4 text-sm">
                <h3 className="font-semibold">Deliverable upload</h3>
                {canUploadDeliverables ? (
                  <div className="mt-2 space-y-3">
                    <DeliverableUploader
                      clientId={project.clientId}
                      projectId={project.id}
                      onUploadVersion={handlePublishDeliverableVersion}
                      uploading={saving}
                      initialTarget={defaultUploaderTarget}
                      allowFinal={isProjectAdmin || project.status === 'approved'}
                    />
                    <div className="rounded border border-border p-2">
                      <p className="mb-1 text-xs text-muted-foreground">Quick link upload</p>
                      <div className="space-y-2">
                        <select
                          value={quickLinkTarget}
                          onChange={(e) => setQuickLinkTarget(e.target.value)}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        >
                          <option value="wip">wip</option>
                          <option value="revisions">revisions</option>
                          {isProjectAdmin || project.status === 'approved' ? <option value="final">final</option> : null}
                        </select>
                        <input value={deliverableLink} onChange={(e) => setDeliverableLink(e.target.value)} placeholder="https://drive.google.com/... or https://figma.com/..." className="w-full rounded border border-border px-3 py-2" />
                        <input value={deliverableNote} onChange={(e) => setDeliverableNote(e.target.value)} placeholder="Version notes" className="w-full rounded border border-border px-3 py-2" />
                        <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleAddDeliverable} disabled={saving}>Upload version link</button>
                      </div>
                    </div>
                  </div>
                ) : <p className="mt-2 text-xs text-muted-foreground">Upload is limited to assigned creative roles.</p>}
                <div className="mt-4 space-y-2 text-xs">
                  {versions.length > 0 ? versions.map((entry) => (
                    <div key={entry.id} className="rounded border border-border p-2">
                      <p className="font-semibold">{entry.version || `v${entry.versionNumber || 1}`}</p>
                      {entry.note ? <p className="text-muted-foreground">{entry.note}</p> : null}
                      <button className="w-full truncate text-left text-blue-700 underline" onClick={() => setSelectedPreviewUrl(entry.url)} title={entry.url}>
                        {shortenUrl(entry.url, 88)}
                      </button>
                    </div>
                  )) : <p className="text-muted-foreground">No deliverable versions yet.</p>}
                </div>
                {versionsHasMore ? <button className="mt-2 rounded border border-border px-2 py-1 text-xs" onClick={handleLoadMoreVersions} disabled={versionsLoadingMore}>{versionsLoadingMore ? 'Loading...' : 'Load more versions'}</button> : null}
              </section>

              <section className="rounded border border-border bg-white p-4 text-sm">
                <h3 className="font-semibold">Notes timeline</h3>
                <p className="mt-1 text-xs text-muted-foreground">Saved notes with author and timestamp.</p>
                <div className="mt-3 max-h-[38vh] space-y-2 overflow-auto pr-1">
                  {notes.length > 0 ? notes.map((entry) => (
                    <div key={entry.id} className="rounded border border-border p-2">
                      <p className="text-xs text-muted-foreground">{entry.authorRole || 'user'} · {getUserLabel(entry.authorId, entry.authorDisplayName, entry.authorEmail)} · {formatDateTime(entry.createdAt)}</p>
                      <p className="mt-1 whitespace-pre-wrap">{entry.content || '-'}</p>
                      <div className="mt-2 space-y-2 rounded border border-border bg-muted/30 p-2">
                        {(noteCommentsByNoteId[entry.id] || []).filter((comment) => !comment.parentId).map((comment) => (
                          <div key={`note-comment-${entry.id}-${comment.id}`} className="rounded border border-border bg-white p-2">
                            <p className="text-xs text-muted-foreground">
                              {comment.authorRole || 'user'} · {getUserLabel(comment.authorId, comment.authorDisplayName, comment.authorEmail)} · {formatDateTime(comment.createdAt)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
                            <div className="mt-2 ml-2 space-y-2">
                              {(noteCommentsByNoteId[entry.id] || []).filter((reply) => reply.parentId === comment.id).map((reply) => (
                                <div key={`note-reply-${entry.id}-${reply.id}`} className="rounded border border-border bg-white p-2">
                                  <p className="text-xs text-muted-foreground">
                                    {reply.authorRole || 'user'} · {getUserLabel(reply.authorId, reply.authorDisplayName, reply.authorEmail)} · {formatDateTime(reply.createdAt)}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{reply.content}</p>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  value={noteReplyTextByNote[noteCommentKey(entry.id, comment.id)] || ''}
                                  onChange={(event) => setNoteReplyTextByNote((prev) => ({ ...prev, [noteCommentKey(entry.id, comment.id)]: event.target.value }))}
                                  placeholder="Reply to note comment"
                                  className="w-full rounded border border-border px-2 py-1 text-xs"
                                />
                                <button
                                  className="rounded border border-border px-2 py-1 text-xs"
                                  onClick={() => handleSubmitNoteComment(entry.id, comment.id)}
                                  disabled={saving}
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            value={noteReplyTextByNote[noteCommentKey(entry.id)] || ''}
                            onChange={(event) => setNoteReplyTextByNote((prev) => ({ ...prev, [noteCommentKey(entry.id)]: event.target.value }))}
                            placeholder="Comment on this note"
                            className="w-full rounded border border-border px-2 py-1 text-xs"
                          />
                          <button
                            className="rounded border border-border px-2 py-1 text-xs"
                            onClick={() => handleSubmitNoteComment(entry.id)}
                            disabled={saving}
                          >
                            Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-xs text-muted-foreground">No saved note entries yet.</p>}
                </div>
                {notesHasMore ? <button className="mt-2 rounded border border-border px-2 py-1 text-xs" onClick={handleLoadMoreNotes} disabled={notesLoadingMore}>{notesLoadingMore ? 'Loading...' : 'Load more notes'}</button> : null}
              </section>
            </div>
          ) : null}

          {activeTab === 'review' ? (
            <div className="grid gap-4 xl:grid-cols-12">
              <section className="rounded border border-border bg-white p-4 text-sm xl:col-span-4">
                <h3 className="font-semibold">Comment anchors</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">needs attention: {commentsByStatus.needs_attention || 0}</span>
                  <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">resolved: {commentsByStatus.resolved || 0}</span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">approved: {commentsByStatus.approved || 0}</span>
                </div>
                <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                  {rootComments.length > 0 ? rootComments.map((entry) => (
                    <button key={`anchor-${entry.id}`} className="w-full rounded border border-border p-2 text-left text-xs hover:bg-muted" onClick={() => jumpToComment(entry.id)}>
                      <StatusPill status={entry.status || 'needs_attention'} />
                      <p className="mt-1 text-muted-foreground">{String(entry.content || '').slice(0, 80)}</p>
                    </button>
                  )) : <p className="text-xs text-muted-foreground">No comments yet.</p>}
                </div>
                {commentsHasMore ? <button className="mt-2 rounded border border-border px-2 py-1 text-xs" onClick={handleLoadMoreComments} disabled={commentsLoadingMore}>{commentsLoadingMore ? 'Loading...' : 'Load more comments'}</button> : null}
              </section>

              <section className="rounded border border-border bg-white p-4 text-sm xl:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Comments (threaded)</h3>
                  <select value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-xs">
                    <option value="all">All statuses</option>
                    <option value="needs_attention">Needs attention</option>
                    <option value="resolved">Resolved</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
                <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto pr-1">
                  {rootComments.length > 0 ? rootComments.map((entry) => (
                    <CommentNode
                      key={entry.id}
                      anchorId={`comment-${entry.id}`}
                      comment={entry}
                      replies={repliesByParent[entry.id] || []}
                      onUpdateCommentStatus={onUpdateCommentStatus}
                      onStartReply={(id) => setReplyTo(id)}
                      onReplyTextChange={setReplyText}
                      replyText={replyTo === entry.id ? replyText : undefined}
                      onSubmitReply={handleSubmitReply}
                      saving={saving}
                      projectId={project.id}
                      getUserLabel={getUserLabel}
                    />
                  )) : <p className="text-xs text-muted-foreground">No comments in this filter.</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add comment with @mention" className="w-full rounded border border-border px-3 py-2" />
                  <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleAddWorkspaceComment} disabled={saving}>Comment</button>
                </div>
                {workspaceRole === 'client' && project.status === 'approved' ? (
                  <div className="mt-4 rounded border border-border p-3">
                    <h4 className="font-semibold">Rate creative</h4>
                    <div className="mt-2 grid gap-2 md:grid-cols-[140px_1fr]">
                      <select value={ratingValue} onChange={(e) => setRatingValue(Number(e.target.value))} className="rounded border border-border px-2 py-1 text-sm" disabled={saving}>
                        <option value={5}>5 - Excellent</option>
                        <option value={4}>4 - Good</option>
                        <option value={3}>3 - Average</option>
                        <option value={2}>2 - Needs work</option>
                        <option value={1}>1 - Poor</option>
                      </select>
                      <input value={ratingFeedback} onChange={(e) => setRatingFeedback(e.target.value)} className="rounded border border-border px-3 py-2 text-sm" placeholder="Optional feedback" disabled={saving} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button className="rounded border border-border px-3 py-1.5 text-sm" onClick={handleSubmitRating} disabled={saving || !onSubmitRating}>
                        {existingClientRating ? 'Update rating' : 'Submit rating'}
                      </button>
                      {existingClientRating ? <p className="text-xs text-muted-foreground">Current: {Number(existingClientRating.rating || 0)}/5 · {formatDateTime(existingClientRating.createdAt)}</p> : null}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <section className="rounded border border-border bg-white p-4 text-sm">
              <h3 className="font-semibold">Activity feed (real-time)</h3>
              <div className="mt-3 max-h-[62vh] space-y-2 overflow-auto">
                {activities.length > 0 ? activities.map((entry) => (
                  <div key={entry.id} className="rounded border border-border p-3">
                    <p className="font-medium">{entry.message || entry.type || 'Update'}</p>
                    <p className="text-xs text-muted-foreground">{entry.actorRole || 'system'} · {getUserLabel(entry.actorId, entry.actorDisplayName, entry.actorEmail)} · {formatDateTime(entry.createdAt)}</p>
                  </div>
                )) : <p className="text-muted-foreground">No activity yet.</p>}
              </div>
              {activitiesHasMore ? <button className="mt-3 rounded border border-border px-3 py-1.5 text-xs" onClick={handleLoadMoreActivities} disabled={activitiesLoadingMore}>{activitiesLoadingMore ? 'Loading...' : 'Load more activity'}</button> : null}
            </section>
          ) : null}

          {renderStickyBar()}
        </div>
      </div>

      {showLargePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-6xl rounded-xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Large preview</h3>
              <button className="rounded border border-border px-3 py-1 text-sm" onClick={() => setShowLargePreview(false)}>Close preview</button>
            </div>
            <PreviewPanel url={selectedPreviewUrl} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ProjectWorkspace
