import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import CreditBalanceCard from '@/components/credits/CreditBalanceCard'
import NewProjectModal from '@/components/projects/NewProjectModal'
import ProjectCard from '@/components/projects/ProjectCard'
import UnifiedPaymentForm from '@/components/payments/UnifiedPaymentForm'
import ProjectWorkspace from '@/components/creative/ProjectWorkspace'
import QuickActionsPanel from '@/components/client/QuickActionsPanel'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import NotificationsPanel from '@/components/notifications/NotificationsPanel'
import NotificationSummaryCard from '@/components/notifications/NotificationSummaryCard'
import { useNotifications } from '@/hooks/useNotifications'
import creditService from '@/services/creditService'
import projectService from '@/services/projectService'
import notificationService from '@/services/notificationService'
import { db } from '@/services/firebase'
import { ACTIVE_PROJECT_STATUSES, CLIENT_ACTIVE_REQUEST_LIMITS } from '@/utils/constants'

const CLIENT_MODULES = [
  { key: 'overview', label: 'Overview' },
  { key: 'projects', label: 'Projects' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'actions', label: 'Quick actions' },
  { key: 'notifications', label: 'Notifications' },
]

const CLIENT_LINKS = [
  { key: 'templates', label: 'Briefing Templates', to: '/templates' },
  { key: 'billing', label: 'Billing', to: '/billing' },
]

function ClientDashboard() {
  const { user, userProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [clientData, setClientData] = useState(null)
  const [creditBalance, setCreditBalance] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTab, setSelectedTab] = useState('active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutType, setCheckoutType] = useState('extra_credits')
  const [checkoutTier, setCheckoutTier] = useState('starter')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectActionBusyId, setProjectActionBusyId] = useState('')
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [autoMarkNotificationsOnOpen, setAutoMarkNotificationsOnOpen] = useState(() => localStorage.getItem('client_auto_mark_notifications') !== 'false')
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [notificationPreferences, setNotificationPreferences] = useState({
    inAppEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
  })
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [activeModule, setActiveModule] = useState('overview')

  const clientId = user?.uid

  const {
    notifications,
    unreadCount: unreadNotificationsCount,
    busy: notificationsBusy,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsRead,
  } = useNotifications(clientId, {
    enabled: Boolean(clientId),
    type: notificationFilter,
    autoMarkOnOpen: activeModule === 'notifications' && autoMarkNotificationsOnOpen,
  })

  useEffect(() => {
    if (!clientId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const unsubscribeClient = onSnapshot(
      doc(db, 'clients', clientId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setError('Client profile not found. Please sign in again.')
          setLoading(false)
          return
        }

        const data = snapshot.data()
        setClientData(data)

        try {
          const balance = await creditService.getCreditBalance(clientId)
          setCreditBalance(balance)
        } catch (balanceError) {
          console.error('[ClientDashboard] Failed to calculate credit balance:', balanceError)
          setError('Unable to load credit balance.')
        } finally {
          setLoading(false)
        }
      },
      (clientError) => {
        console.error('[ClientDashboard] Failed to read client profile:', clientError)
        setError('Failed to load client profile.')
        setLoading(false)
      },
    )

    const unsubscribeProjects = projectService.subscribeToClientProjects(
      clientId,
      (nextProjects) => {
        setProjects(nextProjects)
      },
      (projectsError) => {
        console.error('[ClientDashboard] Failed to load projects:', projectsError)
        setError('Failed to load projects.')
      },
    )

    return () => {
      unsubscribeClient()
      unsubscribeProjects()
    }
  }, [clientId])

  const tier = clientData?.subscription?.tier || 'starter'
  const creditsPerMonth = Number(clientData?.subscription?.creditsPerMonth || 0)
  const creditsUsed = Number(clientData?.subscription?.creditsUsed || 0)

  const activeLimit = CLIENT_ACTIVE_REQUEST_LIMITS[tier] || 1
  const activeProjects = useMemo(
    () => projects.filter((project) => ACTIVE_PROJECT_STATUSES.includes(project.status)),
    [projects],
  )
  const activeCount = activeProjects.length
  const atLimit = activeCount >= activeLimit
  useEffect(() => {
    localStorage.setItem('client_auto_mark_notifications', String(autoMarkNotificationsOnOpen))
  }, [autoMarkNotificationsOnOpen])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await notificationService.getPreferences(clientId)
        if (cancelled || !prefs) return
        setNotificationPreferences({
          inAppEnabled: prefs.inAppEnabled !== false,
          emailEnabled: Boolean(prefs.emailEnabled),
          smsEnabled: Boolean(prefs.smsEnabled),
        })
      } catch (prefsError) {
        console.error('[ClientDashboard] Failed to load notification preferences:', prefsError)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const filteredProjects = useMemo(() => {
    if (selectedTab === 'all') return projects
    if (selectedTab === 'active') return activeProjects
    if (selectedTab === 'pending_confirmation') {
      return projects.filter((project) => ['pending_confirmation', 'client_review'].includes(project.status))
    }
    if (selectedTab === 'completed') return projects.filter((project) => project.status === 'approved')
    return projects
  }, [activeProjects, projects, selectedTab])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  )

  async function handleApproveProject(projectId) {
    setProjectActionBusyId(projectId)
    setError('')
    try {
      await projectService.approveProject(projectId, 'client', {
        uid: user?.uid,
        role: userProfile?.role || 'client',
        displayName: clientData?.businessName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
    } catch (actionError) {
      console.error('[ClientDashboard] Failed to approve project:', actionError)
      setError(actionError?.message || 'Failed to approve project.')
    } finally {
      setProjectActionBusyId('')
    }
  }

  async function handleRequestRevision(projectId) {
    setProjectActionBusyId(projectId)
    setError('')
    try {
      await projectService.requestProjectRevision(projectId, 'client', {
        uid: user?.uid,
        role: userProfile?.role || 'client',
        displayName: clientData?.businessName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
      setSelectedTab('active')
    } catch (actionError) {
      console.error('[ClientDashboard] Failed to request revision:', actionError)
      setError(actionError?.message || 'Failed to request revision.')
    } finally {
      setProjectActionBusyId('')
    }
  }

  async function handleAddComment(projectId, comment) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.addProjectComment(projectId, {
        ...comment,
        authorId: user?.uid,
        authorRole: userProfile?.role || 'client',
        authorDisplayName: clientData?.businessName || userProfile?.displayName || null,
        authorEmail: userProfile?.email || user?.email || null,
      })
    } catch (commentError) {
      console.error('[ClientDashboard] Failed to add workspace comment:', commentError)
      setError(commentError?.message || 'Failed to add comment.')
    } finally {
      setWorkspaceSaving(false)
    }
  }

  async function handleUpdateCommentStatus(projectId, commentId, status) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.updateCommentStatus(projectId, commentId, status, {
        uid: user?.uid,
        role: userProfile?.role || 'client',
        displayName: clientData?.businessName || userProfile?.displayName || null,
        email: userProfile?.email || user?.email || null,
      })
    } catch (statusError) {
      console.error('[ClientDashboard] Failed to update comment status:', statusError)
      setError(statusError?.message || 'Failed to update comment status.')
    } finally {
      setWorkspaceSaving(false)
    }
  }

  async function handleSubmitRating(projectId, payload) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.submitClientCreativeRating(
        projectId,
        payload,
        {
          uid: user?.uid,
          role: userProfile?.role || 'client',
          displayName: clientData?.businessName || userProfile?.displayName || null,
          email: userProfile?.email || user?.email || null,
        },
      )
    } catch (ratingError) {
      console.error('[ClientDashboard] Failed to submit creative rating:', ratingError)
      setError(ratingError?.message || 'Failed to submit rating.')
    } finally {
      setWorkspaceSaving(false)
    }
  }

  async function handleMarkNotificationRead(notificationId) {
    setError('')
    try {
      await markNotificationRead(notificationId)
    } catch (nextError) {
      console.error('[ClientDashboard] Failed to mark notification as read:', nextError)
      setError('Failed to mark notification as read.')
    }
  }

  async function handleMarkAllNotificationsRead() {
    setError('')
    try {
      await markAllNotificationsRead()
    } catch (nextError) {
      console.error('[ClientDashboard] Failed to mark all notifications as read:', nextError)
      setError('Failed to mark all notifications as read.')
    }
  }

  async function handleSavePreferences(nextPreferences) {
    setPreferencesSaving(true)
    setError('')
    try {
      await notificationService.upsertPreferences(clientId, nextPreferences)
      setNotificationPreferences({
        inAppEnabled: nextPreferences.inAppEnabled !== false,
        emailEnabled: Boolean(nextPreferences.emailEnabled),
        smsEnabled: Boolean(nextPreferences.smsEnabled),
      })
    } catch (prefsError) {
      console.error('[ClientDashboard] Failed to save notification preferences:', prefsError)
      setError('Failed to save notification preferences.')
    } finally {
      setPreferencesSaving(false)
    }
  }

  function openWorkspace(projectId) {
    setSelectedProjectId(projectId)
    setActiveModule('workspace')
  }

  function openExtraCreditsCheckout() {
    setCheckoutType('extra_credits')
    setCheckoutTier(tier)
    setCheckoutOpen(true)
  }

  function openSubscriptionCheckout(nextTier) {
    setCheckoutType('subscription')
    setCheckoutTier(nextTier || tier)
    setCheckoutOpen(true)
  }

  function renderProjects() {
    return (
      <section className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Projects</h2>
          <p className="text-sm text-zinc-500">
            Active requests: {activeCount} of {activeLimit}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'active', label: 'Active' },
            { key: 'pending_confirmation', label: 'Pending confirmation' },
            { key: 'completed', label: 'Completed' },
            { key: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`rounded-xl px-3 py-1 text-sm ${selectedTab === tab.key ? 'bg-[#C9A227] text-black font-semibold' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => {
              const actions = [
                {
                  label: 'View',
                  onClick: () => openWorkspace(project.id),
                },
              ]

              if (project.status === 'client_review') {
                actions.push({
                  label: 'Approve',
                  disabled: projectActionBusyId === project.id,
                  onClick: () => handleApproveProject(project.id),
                })
                actions.push({
                  label: 'Request Revision',
                  disabled: projectActionBusyId === project.id,
                  onClick: () => handleRequestRevision(project.id),
                })
              }

              if (project.status === 'ready_for_qc') {
                actions.push({
                  label: 'Waiting for project admin QC',
                  disabled: true,
                  onClick: () => {},
                })
              }

              return <ProjectCard key={project.id} project={project} actions={actions} />
            })
          ) : (
            <p className="text-sm text-muted-foreground">No projects in this tab yet.</p>
          )}
        </div>
      </section>
    )
  }

  function renderWorkspace() {
    if (selectedProject) {
      return (
        <ProjectWorkspace
          project={selectedProject}
          currentUser={user}
          workspaceRole="client"
          onClose={() => setSelectedProjectId('')}
          onApproveProject={handleApproveProject}
          onRequestRevision={handleRequestRevision}
          onAddComment={handleAddComment}
          onUpdateCommentStatus={handleUpdateCommentStatus}
          onSubmitRating={handleSubmitRating}
          saving={workspaceSaving || Boolean(projectActionBusyId)}
        />
      )
    }

    return (
      <section className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-5">
        <h2 className="text-base font-semibold text-white">Workspace</h2>
        <p className="mt-1 text-sm text-zinc-500">Select a project to open the shared collaborative workspace.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => openWorkspace(project.id)}
              className="flex items-center justify-between rounded-xl bg-[#1F1F1F] border border-white/5 px-4 py-3 text-left text-sm hover:border-white/10 transition-all"
            >
              <p className="font-medium text-white">{project.title}</p>
              <p className="text-xs text-zinc-500">{project.status?.replaceAll('_', ' ') || 'unknown'}</p>
            </button>
          ))}
        </div>
      </section>
    )
  }

  function renderModule() {
    if (activeModule === 'overview') {
      return (
        <section className="space-y-4">
          <CreditBalanceCard
            balance={creditBalance}
            tier={tier}
            creditsPerMonth={creditsPerMonth}
            creditsUsed={creditsUsed}
            activeCount={activeCount}
            activeLimit={activeLimit}
            onBuyExtraCredits={openExtraCreditsCheckout}
          />
          <div className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-4 text-sm text-zinc-500">
            Total projects: {projects.length} · Credits remaining: {Number(creditBalance?.totalCredits || 0)} · Active requests: {activeCount}
          </div>
          <section className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Active requests</h3>
              <p className="text-xs text-zinc-500">{activeCount} of {activeLimit}</p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {activeProjects.length > 0 ? (
                activeProjects.slice(0, 3).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    actions={[{ label: 'View', onClick: () => openWorkspace(project.id) }]}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active requests yet.</p>
              )}
            </div>
          </section>
          <NotificationSummaryCard
            unreadCount={unreadNotificationsCount}
            onOpen={() => setActiveModule('notifications')}
            onMarkAllRead={handleMarkAllNotificationsRead}
            busy={notificationsBusy}
          />
        </section>
      )
    }

    if (activeModule === 'projects') {
      return renderProjects()
    }

    if (activeModule === 'workspace') {
      return renderWorkspace()
    }

    if (activeModule === 'notifications') {
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

    return (
      <QuickActionsPanel
        clientId={clientId}
        currentTier={tier}
        brandAssets={clientData?.brandAssets}
        onBuyExtraCredits={openExtraCreditsCheckout}
        onCheckoutSubscription={openSubscriptionCheckout}
      />
    )
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Loading client dashboard...</p>
      </main>
    )
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#0F0F0F]">
      <aside className="w-56 shrink-0 border-r border-white/5 bg-[#111111] p-5 flex flex-col">
        <h1 className="text-lg font-bold text-white tracking-tight">Client Console</h1>
        <p className="mt-0.5 text-xs text-[#C9A227]">{clientData?.businessName || userProfile?.displayName || 'Client'}</p>

        <nav className="mt-4 space-y-1">
          {CLIENT_MODULES.map((module) => (
            <button
              key={module.key}
              onClick={() => setActiveModule(module.key)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-all ${activeModule === module.key ? 'bg-[#1F1F1F] text-[#C9A227] border-l-2 border-[#C9A227] font-medium' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{module.label}</span>
                {module.key === 'notifications' && unreadNotificationsCount > 0 ? (
                  <span className="rounded-full bg-[#C9A227] px-1.5 py-0.5 text-[10px] text-black font-bold">{unreadNotificationsCount}</span>
                ) : null}
              </span>
            </button>
          ))}

          <div className="my-2 border-t border-white/5" />

          {CLIENT_LINKS.map((link) => (
            <button
              key={link.key}
              onClick={() => navigate(link.to)}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:text-white hover:bg-white/5"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <button className="mt-auto rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-all" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <section className="flex-1 overflow-auto bg-[#0F0F0F] p-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Client Dashboard</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Welcome, {clientData?.businessName || userProfile?.displayName || 'Client'}.</p>
            <p className="text-sm text-zinc-500">
              Total projects: {projects.length} · Credits remaining: {Number(creditBalance?.totalCredits || 0)} · Active requests: {activeCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#C9A227]/10 border border-[#C9A227]/20 px-2.5 py-0.5 text-xs font-semibold uppercase text-[#C9A227]">
              {tier}
            </span>
            <NotificationCenter userId={clientId} onOpenNotificationsPage={() => setActiveModule('notifications')} />
            <button
              className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E3C96E] disabled:opacity-50"
              onClick={() => setIsModalOpen(true)}
              disabled={atLimit}
              title={atLimit ? `Active request limit reached (${activeCount}/${activeLimit})` : 'Create new request'}
            >
              New request
            </button>
          </div>
        </header>

        {error ? <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</p> : null}

        {renderModule()}
      </section>

      <NewProjectModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientId={clientId}
        createdBy={user?.uid}
        availableCredits={Number(creditBalance?.totalCredits || 0)}
        onProjectCreated={() => {
          setSelectedTab('active')
          setActiveModule('projects')
        }}
      />

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4">
          <div className="mx-auto mt-8 max-w-3xl">
            <UnifiedPaymentForm
              tier={checkoutTier}
              paymentType={checkoutType}
              clientId={clientId}
              onSuccess={() => {
                setCheckoutOpen(false)
              }}
              onCancel={() => setCheckoutOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default ClientDashboard
