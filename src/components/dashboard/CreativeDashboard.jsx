import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import EarningsCard from '@/components/creative/EarningsCard'
import PerformanceScoreCard from '@/components/creative/PerformanceScoreCard'
import PerformanceReview from '@/components/creative/PerformanceReview'
import RatingSummaryCard from '@/components/creative/RatingSummaryCard'
import ProjectWorkspace from '@/components/creative/ProjectWorkspace'
import WorkloadTracker from '@/components/creative/WorkloadTracker'
import BonusExplainer from '@/components/creative/BonusExplainer'
import TemplateContributionsCard from '@/components/creative/TemplateContributionsCard'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import NotificationsPanel from '@/components/notifications/NotificationsPanel'
import NotificationSummaryCard from '@/components/notifications/NotificationSummaryCard'
import ProjectCard from '@/components/projects/ProjectCard'
import { useNotifications } from '@/hooks/useNotifications'
import { db } from '@/services/firebase'
import projectService from '@/services/projectService'
import creativeService from '@/services/creativeService'
import notificationService from '@/services/notificationService'

const CREATIVE_MODULES = [
  { key: 'overview', label: 'Overview' },
  { key: 'projects', label: 'Projects' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'templates', label: 'Template contributions' },
  { key: 'notifications', label: 'Notifications' },
]

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return date.getTime()
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function getDeadlineCountdown(deadline, nowMs) {
  if (!deadline) return 'No deadline'
  const deadlineMs = toMillis(deadline)
  if (!deadlineMs) return 'No deadline'

  const diff = deadlineMs - nowMs
  if (diff <= 0) return 'Overdue'

  const hours = Math.ceil(diff / (1000 * 60 * 60))
  if (hours < 24) return `${hours}h left`
  const days = Math.ceil(hours / 24)
  return `${days}d left`
}

function formatCreativeTier(value) {
  const tier = String(value || 'mid').toLowerCase()
  if (tier === 'junior') return 'Junior'
  if (tier === 'senior') return 'Senior'
  return 'Mid'
}

function CreativeDashboard() {
  const { user, userProfile, signOut } = useAuth()
  const [creativeData, setCreativeData] = useState(null)
  const [assignedProjects, setAssignedProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientNamesById, setClientNamesById] = useState({})
  const [autoMarkNotificationsOnOpen, setAutoMarkNotificationsOnOpen] = useState(() => localStorage.getItem('creative_auto_mark_notifications') !== 'false')
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [notificationPreferences, setNotificationPreferences] = useState({
    inAppEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
  })
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [projectsViewMode, setProjectsViewMode] = useState('card')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [activeModule, setActiveModule] = useState('overview')
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState('overview')

  const creativeId = user?.uid

  const {
    notifications,
    unreadCount: unreadNotificationsCount,
    busy: notificationsBusy,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsRead,
  } = useNotifications(creativeId, {
    enabled: Boolean(creativeId),
    type: notificationFilter,
    autoMarkOnOpen: activeModule === 'notifications' && autoMarkNotificationsOnOpen,
  })

  useEffect(() => {
    if (!creativeId) {
      return
    }

    const unsubscribeCreative = onSnapshot(
      doc(db, 'creatives', creativeId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('Creative profile not found. Please sign in again.')
          setLoading(false)
          return
        }

        setCreativeData(snapshot.data())
        setLoading(false)
      },
      (nextError) => {
        console.error('[CreativeDashboard] Failed to load creative profile:', nextError)
        setError('Failed to load creative profile.')
        setLoading(false)
      },
    )

    const unsubscribeProjects = projectService.subscribeToCreativeProjects(
      creativeId,
      (projects) => {
        setAssignedProjects(projects)
      },
      (nextError) => {
        console.error('[CreativeDashboard] Failed to load assigned projects:', nextError)
        setError('Failed to load assigned projects.')
      },
    )

    return () => {
      unsubscribeCreative()
      unsubscribeProjects()
    }
  }, [creativeId])

  const creditsCompletedThisMonth = useMemo(
    () =>
      assignedProjects
        .filter((project) => ['ready_for_qc', 'client_review', 'approved'].includes(project.status))
        .reduce((sum, project) => sum + Number(project.actualCreditsUsed || project.confirmedCredits || 0), 0),
    [assignedProjects],
  )

  const activeProjects = useMemo(
    () => assignedProjects.filter((project) => ['confirmed', 'in_progress', 'revision_requested'].includes(project.status)),
    [assignedProjects],
  )

  const projectsSortedForDisplay = useMemo(() => {
    return [...assignedProjects].sort((a, b) => {
      const aDeadline = toMillis(a.deadline)
      const bDeadline = toMillis(b.deadline)
      if (aDeadline !== bDeadline) return aDeadline - bDeadline
      return toMillis(b.createdAt) - toMillis(a.createdAt)
    })
  }, [assignedProjects])

  const selectedProject = useMemo(
    () => assignedProjects.find((project) => project.id === selectedProjectId) || null,
    [assignedProjects, selectedProjectId],
  )

  useEffect(() => {
    localStorage.setItem('creative_auto_mark_notifications', String(autoMarkNotificationsOnOpen))
  }, [autoMarkNotificationsOnOpen])

  useEffect(() => {
    if (!creativeId) return
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await notificationService.getPreferences(creativeId)
        if (cancelled || !prefs) return
        setNotificationPreferences({
          inAppEnabled: prefs.inAppEnabled !== false,
          emailEnabled: Boolean(prefs.emailEnabled),
          smsEnabled: Boolean(prefs.smsEnabled),
        })
      } catch (prefsError) {
        console.error('[CreativeDashboard] Failed to load notification preferences:', prefsError)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [creativeId])

  const ratedProjects = useMemo(
    () => assignedProjects.filter((project) => Number(project.clientRating?.rating || 0) > 0),
    [assignedProjects],
  )

  const derivedAvgRating = useMemo(() => {
    if (ratedProjects.length === 0) return Number(creativeData?.performance?.avgRating || 0)
    const total = ratedProjects.reduce((sum, project) => sum + Number(project.clientRating?.rating || 0), 0)
    return total / ratedProjects.length
  }, [ratedProjects, creativeData?.performance?.avgRating])

  const mergedPerformance = useMemo(
    () => ({
      ...(creativeData?.performance || {}),
      avgRating: derivedAvgRating,
    }),
    [creativeData?.performance, derivedAvgRating],
  )

  const ratingSummary = useMemo(() => {
    if (ratedProjects.length === 0) {
      return { average: Number(creativeData?.performance?.avgRating || 0), count: 0, trend: 0, latest: null }
    }

    const sortedByTime = [...ratedProjects].sort((a, b) => toMillis(b.clientRating?.createdAt) - toMillis(a.clientRating?.createdAt))
    const latest = sortedByTime[0]

    const recent = sortedByTime.slice(0, 3)
    const older = sortedByTime.slice(3)
    const recentAvg = recent.reduce((sum, project) => sum + Number(project.clientRating?.rating || 0), 0) / recent.length
    const olderAvg = older.length > 0
      ? older.reduce((sum, project) => sum + Number(project.clientRating?.rating || 0), 0) / older.length
      : recentAvg

    return {
      average: derivedAvgRating,
      count: ratedProjects.length,
      trend: recentAvg - olderAvg,
      latest: {
        projectId: latest.id,
        projectTitle: latest.title,
        rating: Number(latest.clientRating?.rating || 0),
        feedback: latest.clientRating?.feedback || '',
        createdAt: latest.clientRating?.createdAt || null,
      },
    }
  }, [ratedProjects, derivedAvgRating, creativeData?.performance?.avgRating])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const clientIds = [...new Set(assignedProjects.map((project) => project.clientId).filter(Boolean))]
    if (clientIds.length === 0) return

    let cancelled = false

    async function loadClientNames() {
      const entries = await Promise.all(
        clientIds.map(async (clientId) => {
          const snap = await getDoc(doc(db, 'clients', clientId))
          return [clientId, snap.exists() ? snap.data().businessName || 'Unknown client' : 'Unknown client']
        }),
      )

      if (cancelled) return

      setClientNamesById((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }))
    }

    loadClientNames().catch((clientError) => {
      console.error('[CreativeDashboard] Failed to load client names:', clientError)
    })

    return () => {
      cancelled = true
    }
  }, [assignedProjects])

  async function handleStart(projectId) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.startProject(projectId, { uid: user.uid, role: userProfile?.role || 'creative' })
    } catch (startError) {
      console.error('[CreativeDashboard] Failed to start project:', startError)
      setError('Unable to start project.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveWorkspace(projectId, payload) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.updateProjectWorkspace(projectId, payload, {
        uid: user.uid,
        role: userProfile?.role || 'creative',
        displayName: creativeData?.displayName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
    } catch (saveError) {
      console.error('[CreativeDashboard] Failed to save project workspace:', saveError)
      setError('Unable to save project workspace.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitQC(projectId, payload) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.submitProjectForQC(projectId, payload, {
        uid: user.uid,
        role: userProfile?.role || 'creative',
        displayName: creativeData?.displayName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
      setSelectedProjectId('')
    } catch (submitError) {
      console.error('[CreativeDashboard] Failed to submit project for QC:', submitError)
      setError('Unable to submit project for QC.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDeliverableLink(projectId, link, note = '') {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.addDeliverableLink(projectId, link, note, {
        uid: user.uid,
        role: userProfile?.role || 'creative',
        displayName: creativeData?.displayName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
    } catch (uploadError) {
      console.error('[CreativeDashboard] Failed to add deliverable link:', uploadError)
      setError('Unable to add deliverable link.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddComment(projectId, comment) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.addProjectComment(projectId, {
        ...comment,
        authorId: user.uid,
        authorRole: userProfile?.role || 'creative',
        authorDisplayName: creativeData?.displayName || userProfile?.displayName || null,
        authorEmail: userProfile?.email || user?.email || null,
      })
    } catch (commentError) {
      console.error('[CreativeDashboard] Failed to add comment:', commentError)
      setError('Unable to add comment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateCommentStatus(projectId, commentId, status) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await projectService.updateCommentStatus(projectId, commentId, status, {
        uid: user.uid,
        role: userProfile?.role || 'creative',
        displayName: creativeData?.displayName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
    } catch (statusError) {
      console.error('[CreativeDashboard] Failed to update comment status:', statusError)
      setError('Unable to update comment status.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvailabilityChange(value) {
    if (!creativeId) return
    setError('')
    try {
      await creativeService.updateAvailability(creativeId, value)
    } catch (availabilityError) {
      console.error('[CreativeDashboard] Failed to update availability:', availabilityError)
      setError('Unable to update availability.')
    }
  }

  async function handleUploadTemplate(payload) {
    if (!creativeId) return
    setSaving(true)
    setError('')
    try {
      await creativeService.addTemplateContribution(creativeId, payload)
    } catch (uploadError) {
      console.error('[CreativeDashboard] Failed to upload template contribution:', uploadError)
      setError('Unable to upload template contribution.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkNotificationRead(notificationId) {
    setError('')
    try {
      await markNotificationRead(notificationId)
    } catch (nextError) {
      console.error('[CreativeDashboard] Failed to mark notification as read:', nextError)
      setError('Unable to mark notification as read.')
    }
  }

  async function handleMarkAllNotificationsRead() {
    setError('')
    try {
      await markAllNotificationsRead()
    } catch (nextError) {
      console.error('[CreativeDashboard] Failed to mark all notifications as read:', nextError)
      setError('Unable to mark all notifications as read.')
    }
  }

  async function handleSavePreferences(nextPreferences) {
    setPreferencesSaving(true)
    setError('')
    try {
      await notificationService.upsertPreferences(creativeId, nextPreferences)
      setNotificationPreferences({
        inAppEnabled: nextPreferences.inAppEnabled !== false,
        emailEnabled: Boolean(nextPreferences.emailEnabled),
        smsEnabled: Boolean(nextPreferences.smsEnabled),
      })
    } catch (prefsError) {
      console.error('[CreativeDashboard] Failed to save notification preferences:', prefsError)
      setError('Unable to save notification preferences.')
    } finally {
      setPreferencesSaving(false)
    }
  }

  function openWorkspace(projectId, tab = 'overview') {
    setSelectedProjectId(projectId)
    setWorkspaceInitialTab(tab)
    setActiveModule('workspace')
  }

  function renderProjects() {
    return (
      <section className="rounded border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Assigned Projects</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Active projects: {activeProjects.length}</p>
            <div className="flex rounded border border-border p-1 text-xs">
              <button
                className={`rounded px-2 py-1 ${projectsViewMode === 'card' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setProjectsViewMode('card')}
              >
                Card view
              </button>
              <button
                className={`rounded px-2 py-1 ${projectsViewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setProjectsViewMode('table')}
              >
                Table view
              </button>
            </div>
          </div>
        </div>

        {projectsViewMode === 'card' ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projectsSortedForDisplay.length > 0 ? (
              projectsSortedForDisplay.map((project) => {
                const actions = [{ label: 'Open workspace', onClick: () => openWorkspace(project.id, 'overview') }]
                actions.unshift({
                  label: 'Upload',
                  disabled: saving,
                  onClick: () => openWorkspace(project.id, 'production'),
                })

                if (project.status === 'confirmed') {
                  actions.unshift({
                    label: 'Start',
                    disabled: saving,
                    onClick: () => handleStart(project.id),
                  })
                }

                if (['in_progress', 'revision_requested'].includes(project.status)) {
                  actions.unshift({
                    label: 'Submit for QC',
                    disabled: saving,
                    onClick: () =>
                      handleSubmitQC(project.id, {
                        actualCreditsUsed: Number(project.actualCreditsUsed || project.confirmedCredits || 0),
                        workspaceNotes: project.workspaceNotes || '',
                      }),
                  })
                }

                return (
                  <div key={project.id} className="space-y-2">
                    <ProjectCard
                      project={{
                        ...project,
                        assignedCreativeName: creativeData?.displayName || project.assignedCreativeName || null,
                        deliverableType: `${project.deliverableType} · ${clientNamesById[project.clientId] || 'Unknown client'}`,
                      }}
                      actions={actions}
                    />
                    <p className="text-xs text-muted-foreground">Deadline countdown: {getDeadlineCountdown(project.deadline, nowMs)}</p>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">No assigned projects yet.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Deliverable</th>
                  <th className="py-2 pr-3 font-medium">Credits</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 pr-3 font-medium">Deadline</th>
                  <th className="py-2 pr-3 font-medium">Countdown</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectsSortedForDisplay.length > 0 ? (
                  projectsSortedForDisplay.map((project) => (
                    <tr key={project.id} className="border-b border-border">
                      <td className="py-2 pr-3 font-medium">{project.title}</td>
                      <td className="py-2 pr-3">{clientNamesById[project.clientId] || 'Unknown client'}</td>
                      <td className="py-2 pr-3">{project.deliverableType || 'Unknown'}</td>
                      <td className="py-2 pr-3">{Number(project.actualCreditsUsed || project.confirmedCredits || project.estimatedCredits || 0)}</td>
                      <td className="py-2 pr-3">{formatDate(project.createdAt)}</td>
                      <td className="py-2 pr-3">{formatDate(project.deadline)}</td>
                      <td className="py-2 pr-3">{getDeadlineCountdown(project.deadline, nowMs)}</td>
                      <td className="py-2 pr-3">{project.status?.replaceAll('_', ' ') || 'unknown'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded border border-border px-2 py-1 text-xs"
                            onClick={() => openWorkspace(project.id, 'overview')}
                          >
                            Open
                          </button>
                          <button
                            className="rounded border border-border px-2 py-1 text-xs"
                            onClick={() => openWorkspace(project.id, 'production')}
                          >
                            Upload
                          </button>
                          {project.status === 'confirmed' ? (
                            <button
                              className="rounded border border-border px-2 py-1 text-xs"
                              onClick={() => handleStart(project.id)}
                              disabled={saving}
                            >
                              Start
                            </button>
                          ) : null}
                          {['in_progress', 'revision_requested'].includes(project.status) ? (
                            <button
                              className="rounded border border-border px-2 py-1 text-xs"
                              onClick={() =>
                                handleSubmitQC(project.id, {
                                  actualCreditsUsed: Number(project.actualCreditsUsed || project.confirmedCredits || 0),
                                  workspaceNotes: project.workspaceNotes || '',
                                })
                              }
                              disabled={saving}
                            >
                              Submit for QC
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={9}>
                      No assigned projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  function renderWorkspace() {
    if (selectedProject) {
      return (
        <ProjectWorkspace
          project={selectedProject}
          currentUser={user}
          workspaceRole={userProfile?.role || 'creative'}
          onClose={() => setSelectedProjectId('')}
          initialTab={workspaceInitialTab}
          onStart={handleStart}
          onSave={handleSaveWorkspace}
          onSubmitQC={handleSubmitQC}
          onAddDeliverableLink={handleAddDeliverableLink}
          onAddComment={handleAddComment}
          onUpdateCommentStatus={handleUpdateCommentStatus}
          saving={saving}
        />
      )
    }

    return (
      <section className="rounded border border-border p-4">
        <h2 className="text-base font-semibold">Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a project to open your collaborative workspace.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {projectsSortedForDisplay.map((project) => (
            <button
              key={project.id}
              onClick={() => openWorkspace(project.id, 'overview')}
              className="rounded border border-border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <p className="font-medium">{project.title}</p>
              <p className="text-xs text-muted-foreground">{project.status?.replaceAll('_', ' ') || 'unknown'}</p>
            </button>
          ))}
        </div>
      </section>
    )
  }

  function renderModule() {
    if (activeModule === 'overview') {
      return (
        <div className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <EarningsCard
              earnings={creativeData?.earnings}
              payoutRate={creativeData?.payoutRate}
              creditsCompletedThisMonth={creditsCompletedThisMonth}
              projects={assignedProjects}
              bonuses={creativeData?.bonuses}
            />
            <PerformanceScoreCard performance={mergedPerformance} />
            <RatingSummaryCard summary={ratingSummary} />
            <WorkloadTracker
              completedCredits={creditsCompletedThisMonth}
              maxCredits={120}
              availability={creativeData?.availability || 'available'}
              onAvailabilityChange={handleAvailabilityChange}
            />
            <NotificationSummaryCard
              unreadCount={unreadNotificationsCount}
              onOpen={() => setActiveModule('notifications')}
              onMarkAllRead={handleMarkAllNotificationsRead}
              busy={notificationsBusy}
            />
          </section>
          <BonusExplainer
            bonuses={creativeData?.bonuses}
            performance={mergedPerformance}
            completedCredits={creditsCompletedThisMonth}
          />
          <PerformanceReview creativeId={creativeId} />
        </div>
      )
    }

    if (activeModule === 'projects') {
      return renderProjects()
    }

    if (activeModule === 'workspace') {
      return renderWorkspace()
    }

    if (activeModule === 'templates') {
      return (
        <TemplateContributionsCard
          contributions={creativeData?.templateContributions || []}
          onUploadTemplate={handleUploadTemplate}
          uploading={saving}
          creativeId={creativeId}
        />
      )
    }

    return (
      <NotificationsPanel
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        busy={notificationsBusy}
        autoMarkOnOpen={autoMarkNotificationsOnOpen}
        onToggleAutoMark={setAutoMarkNotificationsOnOpen}
        filter={notificationFilter}
        onFilterChange={setNotificationFilter}
        preferences={notificationPreferences}
        onSavePreferences={handleSavePreferences}
        preferencesSaving={preferencesSaving}
      />
    )
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Loading creative dashboard...</p>
      </main>
    )
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <h1 className="text-xl font-semibold">Creative Console</h1>
        <p className="mt-1 text-xs text-muted-foreground">{creativeData?.displayName || userProfile?.displayName || 'Creative'}</p>
        <p className="mt-1 text-xs text-muted-foreground">Tier: {creativeData?.tier || 'mid'}</p>

        <nav className="mt-4 space-y-1">
          {CREATIVE_MODULES.map((module) => (
            <button
              key={module.key}
              onClick={() => setActiveModule(module.key)}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${activeModule === module.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{module.label}</span>
                {module.key === 'notifications' && unreadNotificationsCount > 0 ? (
                  <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">{unreadNotificationsCount}</span>
                ) : null}
              </span>
            </button>
          ))}
        </nav>

        <button className="mt-6 w-full rounded border border-border px-3 py-2 text-sm" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <section className="flex-1 overflow-auto p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Creative Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Welcome, {creativeData?.displayName || userProfile?.displayName || 'Creative'}.
            </p>
            <p className="text-sm text-muted-foreground">
              Active projects: {activeProjects.length} · Credits this month: {creditsCompletedThisMonth} · Rating:{' '}
              {Number(mergedPerformance?.avgRating || 0).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-border px-2 py-1 text-xs font-semibold">
              Tier: {formatCreativeTier(creativeData?.tier)}
            </span>
            <NotificationCenter userId={creativeId} onOpenNotificationsPage={() => setActiveModule('notifications')} />
          </div>
        </header>

        {error ? <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {renderModule()}
      </section>
    </main>
  )
}

export default CreativeDashboard
