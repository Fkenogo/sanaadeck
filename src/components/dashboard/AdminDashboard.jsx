import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import ClientManagementTable from '@/components/admin/ClientManagementTable'
import CreativeManagementTable from '@/components/admin/CreativeManagementTable'
import CreativePerformancePanel from '@/components/admin/CreativePerformancePanel'
import CreditAdjustmentModal from '@/components/admin/CreditAdjustmentModal'
import PerformanceAlerts from '@/components/admin/PerformanceAlerts'
import PlatformKPIs from '@/components/admin/PlatformKPIs'
import ProjectOversightPanel from '@/components/admin/ProjectOversightPanel'
import AdminRoleManagement from '@/components/admin/AdminRoleManagement'
import ProjectWorkspace from '@/components/creative/ProjectWorkspace'
import RevenueChart from '@/components/admin/RevenueChart'
import CreditAnalyticsPanel from '@/components/admin/CreditAnalyticsPanel'
import PaymentMonitoringPanel from '@/components/admin/PaymentMonitoringPanel'
import PaymentsSubscriptionsManagementPanel from '@/components/admin/PaymentsSubscriptionsManagementPanel'
import ReportGenerator from '@/components/admin/ReportGenerator'
import UsersManagementPanel from '@/components/admin/UsersManagementPanel'
import CreditTransactionsManagementPanel from '@/components/admin/CreditTransactionsManagementPanel'
import NotificationsManagementPanel from '@/components/admin/NotificationsManagementPanel'
import TemplateAssetLibraryPanel from '@/components/admin/TemplateAssetLibraryPanel'
import SystemJobsPanel from '@/components/admin/SystemJobsPanel'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import NotificationSummaryCard from '@/components/notifications/NotificationSummaryCard'
import { useNotifications } from '@/hooks/useNotifications'
import adminService from '@/services/adminService'
import projectService from '@/services/projectService'
import { SUBSCRIPTION_TIERS, TIER_BY_KEY } from '@/utils/constants'

const ACTIVE_PROJECT_STATUSES = new Set(['pending_confirmation', 'confirmed', 'in_progress', 'ready_for_qc', 'revision_requested'])

const ALL_MODULES = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'clients', label: 'Clients' },
  { key: 'creatives', label: 'Creatives' },
  { key: 'projects', label: 'Projects' },
  { key: 'credit_transactions', label: 'Credit Tx' },
  { key: 'payments_subscriptions', label: 'Payments' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'template_assets', label: 'Template Library' },
  { key: 'reports', label: 'Reports' },
  { key: 'admins', label: 'Admins' },
]

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return date.getTime()
}

function monthLabel(offset) {
  const date = new Date()
  date.setMonth(date.getMonth() - offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function matchesMonth(value, label) {
  const ms = toMillis(value)
  if (!ms) return false
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === label
}

function AdminDashboard({ mode = 'super' }) {
  const { user, userProfile, signOut } = useAuth()

  const [clients, setClients] = useState([])
  const [creatives, setCreatives] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [creditTransactions, setCreditTransactions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [templateAssets, setTemplateAssets] = useState([])
  const [systemJobs, setSystemJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeModule, setActiveModule] = useState('overview')

  const [selectedClientForAdjustment, setSelectedClientForAdjustment] = useState(null)
  const [adjustingCredits, setAdjustingCredits] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [workspaceMigrationRunning, setWorkspaceMigrationRunning] = useState(false)
  const [workspaceMigrationResult, setWorkspaceMigrationResult] = useState(null)
  const [workspaceMigrationMaxProjects, setWorkspaceMigrationMaxProjects] = useState(500)
  const [workspaceMigrationCursor, setWorkspaceMigrationCursor] = useState('')
  const [digestRunning, setDigestRunning] = useState(false)
  const [digestResult, setDigestResult] = useState(null)
  const [expiryCleanupRunning, setExpiryCleanupRunning] = useState(false)
  const [expiryCleanupResult, setExpiryCleanupResult] = useState(null)
  const [monthlyAllocationRunning, setMonthlyAllocationRunning] = useState(false)
  const [monthlyAllocationResult, setMonthlyAllocationResult] = useState(null)
  const [monthlyCpsRunning, setMonthlyCpsRunning] = useState(false)
  const [monthlyCpsResult, setMonthlyCpsResult] = useState(null)
  const [nowMs] = useState(() => Date.now())

  const isSuperAdmin = userProfile?.role === 'super_admin'

  const canModule = useCallback((moduleKey) => {
    if (isSuperAdmin) return true
    return Boolean(userProfile?.adminPermissions?.modules?.[moduleKey])
  }, [isSuperAdmin, userProfile])

  const canAction = useCallback((actionKey) => {
    if (isSuperAdmin) return true
    return Boolean(userProfile?.adminPermissions?.actions?.[actionKey])
  }, [isSuperAdmin, userProfile])

  const visibleModules = useMemo(() => {
    let pool = ALL_MODULES
    if (mode === 'project') {
      pool = ALL_MODULES.filter((entry) => ['overview', 'projects', 'notifications', 'reports'].includes(entry.key))
    } else if (mode === 'app') {
      pool = ALL_MODULES.filter((entry) => entry.key !== 'projects')
    }

    return pool.filter((entry) => canModule(entry.key))
  }, [mode, canModule])

  useEffect(() => {
    if (visibleModules.length === 0) return
    if (!visibleModules.some((entry) => entry.key === activeModule)) {
      setActiveModule(visibleModules[0].key)
    }
  }, [visibleModules, activeModule])

  useEffect(() => {
    setLoading(true)
    setError('')

    const unsubClients = adminService.subscribeToCollection('clients', (records) => {
      setClients(records)
      setLoading(false)
    }, () => {
      setError('Failed to load client records.')
      setLoading(false)
    })

    const unsubCreatives = adminService.subscribeToCollection('creatives', setCreatives, () => {
      setError('Failed to load creative records.')
    })

    const unsubProjects = adminService.subscribeToCollection('projects', setProjects, () => {
      setError('Failed to load projects.')
    })

    const unsubUsers = adminService.subscribeToCollection('users', setUsers)
    const unsubPayments = adminService.subscribeToCollection('payments', setPayments)
    const unsubCreditTransactions = adminService.subscribeToCollection('creditTransactions', setCreditTransactions)
    const unsubNotifications = adminService.subscribeToCollection('notifications', setNotifications)
    const unsubTemplateAssets = adminService.subscribeToCollection('templateAssetLibrary', setTemplateAssets, () => setTemplateAssets([]))
    const unsubSystemJobs = adminService.subscribeToCollection('systemJobs', setSystemJobs, () => setSystemJobs([]))

    return () => {
      unsubClients()
      unsubCreatives()
      unsubProjects()
      unsubUsers()
      unsubPayments()
      unsubCreditTransactions()
      unsubNotifications()
      unsubTemplateAssets()
      unsubSystemJobs()
    }
  }, [])

  const projectsByCreative = useMemo(() => {
    return projects.reduce((acc, project) => {
      if (!project.assignedCreativeId) return acc
      acc[project.assignedCreativeId] = (acc[project.assignedCreativeId] || 0) + 1
      return acc
    }, {})
  }, [projects])

  const kpis = useMemo(() => {
    const activeClients = clients.filter((client) => client.subscription?.status === 'active')

    const byTier = {
      starter: activeClients.filter((client) => (client.subscription?.tier || 'starter') === 'starter').length,
      growth: activeClients.filter((client) => (client.subscription?.tier || 'starter') === 'growth').length,
      pro: activeClients.filter((client) => (client.subscription?.tier || 'starter') === 'pro').length,
    }

    const mrr = activeClients.reduce((sum, client) => {
      const tier = String(client.subscription?.tier || 'starter').toLowerCase()
      return sum + Number(TIER_BY_KEY[tier]?.priceUsd || 0)
    }, 0)

    const creditsIssued = activeClients.reduce((sum, client) => sum + Number(client.subscription?.creditsPerMonth || 0), 0)
    const creditsUsed = activeClients.reduce((sum, client) => sum + Number(client.subscription?.creditsUsed || 0), 0)
    const utilization = creditsIssued > 0 ? (creditsUsed / creditsIssued) * 100 : 0
    const activeProjects = projects.filter((project) => ACTIVE_PROJECT_STATUSES.has(project.status)).length
    const estimatedCreativePayout = creditsUsed * 9
    const grossMargin = mrr > 0 ? ((mrr - estimatedCreativePayout) / mrr) * 100 : 0

    return {
      mrr,
      arr: mrr * 12,
      activeSubscriptions: activeClients.length,
      creditsIssued,
      creditsUsed,
      utilization,
      activeProjects,
      grossMargin,
      byTier,
    }
  }, [clients, projects])

  const revenueAnalytics = useMemo(() => {
    const labels = [5, 4, 3, 2, 1, 0].map((offset) => monthLabel(offset))
    const trend = labels.map((label) => {
      const activeClientCount = clients.filter((client) => matchesMonth(client.createdAt || client.updatedAt, label)).length
      const avgPlanValue = (SUBSCRIPTION_TIERS.STARTER.priceUsd + SUBSCRIPTION_TIERS.GROWTH.priceUsd + SUBSCRIPTION_TIERS.PRO.priceUsd) / 3
      const subscriptionRevenue = activeClientCount * avgPlanValue
      const extraCreditsRevenue = payments
        .filter((payment) => matchesMonth(payment.createdAt, label))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

      return { month: label, subscriptionRevenue, extraCreditsRevenue, totalRevenue: subscriptionRevenue + extraCreditsRevenue }
    })

    const subscriptionBreakdown = [
      { tier: 'Starter', count: clients.filter((c) => (c.subscription?.tier || 'starter') === 'starter').length },
      { tier: 'Growth', count: clients.filter((c) => (c.subscription?.tier || 'starter') === 'growth').length },
      { tier: 'Pro', count: clients.filter((c) => (c.subscription?.tier || 'starter') === 'pro').length },
    ]

    const revenuePerCredit = [
      { tier: 'Starter', revenuePerCredit: Number((SUBSCRIPTION_TIERS.STARTER.priceUsd / SUBSCRIPTION_TIERS.STARTER.creditsPerMonth).toFixed(2)) },
      { tier: 'Growth', revenuePerCredit: Number((SUBSCRIPTION_TIERS.GROWTH.priceUsd / SUBSCRIPTION_TIERS.GROWTH.creditsPerMonth).toFixed(2)) },
      { tier: 'Pro', revenuePerCredit: Number((SUBSCRIPTION_TIERS.PRO.priceUsd / SUBSCRIPTION_TIERS.PRO.creditsPerMonth).toFixed(2)) },
    ]

    const extraCreditPackSales = payments.filter((payment) => payment.reason === 'extra_credits').length
    const churned = clients.filter((client) => client.subscription?.status === 'canceled').length
    const churnRate = clients.length > 0 ? (churned / clients.length) * 100 : 0

    return { trend, subscriptionBreakdown, revenuePerCredit, extraCreditPackSales, churnRate }
  }, [clients, payments])

  const creditAnalytics = useMemo(() => {
    const thisMonth = monthLabel(0)
    const issuedThisMonth = clients.reduce((sum, client) => sum + Number(client.subscription?.creditsPerMonth || 0), 0)
    const consumedThisMonth = creditTransactions
      .filter((entry) => entry.type === 'deduction' && matchesMonth(entry.createdAt, thisMonth))
      .reduce((sum, entry) => sum + Number(entry.creditsAmount || 0), 0)

    const expiringSoon = clients.reduce((sum, client) => {
      if (!Array.isArray(client.extraCredits)) return sum
      return sum + client.extraCredits.reduce((packSum, pack) => {
        const expiryMs = toMillis(pack.expiryDate)
        const days = (expiryMs - nowMs) / (1000 * 60 * 60 * 24)
        return days >= 0 && days <= 7 ? packSum + Number(pack.creditsRemaining || 0) : packSum
      }, 0)
    }, 0)

    const burnMap = {}
    projects.forEach((project) => {
      const key = project.deliverableType || 'unknown'
      burnMap[key] = (burnMap[key] || 0) + Number(project.actualCreditsUsed || project.confirmedCredits || 0)
    })

    const burnPattern = Object.entries(burnMap).map(([deliverableType, credits]) => ({ deliverableType, credits })).sort((a, b) => b.credits - a.credits).slice(0, 8)
    const averageCreditsPerProject = projects.length > 0
      ? projects.reduce((sum, project) => sum + Number(project.actualCreditsUsed || project.confirmedCredits || 0), 0) / projects.length
      : 0

    return {
      issuedThisMonth,
      consumedThisMonth,
      utilizationRate: issuedThisMonth > 0 ? (consumedThisMonth / issuedThisMonth) * 100 : 0,
      expiringSoon,
      averageCreditsPerProject,
      burnPattern,
      topBurnDeliverable: burnPattern[0]?.deliverableType || '',
    }
  }, [clients, creditTransactions, projects, nowMs])

  const selectedProject = useMemo(() => projects.find((entry) => entry.id === selectedProjectId) || null, [projects, selectedProjectId])
  const admins = useMemo(() => users.filter((entry) => ['admin', 'super_admin'].includes(entry.role)), [users])
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((entry) => !entry.read).length,
    [notifications],
  )
  const { unreadCount: inboxUnreadCount } = useNotifications(user?.uid, { enabled: Boolean(user?.uid) })

  async function guard(actionKey, fn) {
    if (!canAction(actionKey)) {
      setError('You do not have permission for this action.')
      return
    }
    await fn()
  }

  async function handleAssignProject(projectId, creativeId) {
    await guard('assign_project', async () => {
      await adminService.assignProject(projectId, creativeId, {
        uid: userProfile?.uid,
        role: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        displayName: userProfile?.displayName || null,
        email: userProfile?.email || null,
      })
    })
  }

  async function handleApproveQC(projectId) {
    await guard('approve_qc', async () => {
      await adminService.markProjectForClientReview(projectId, {
        uid: userProfile?.uid,
        role: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        displayName: userProfile?.displayName || null,
        email: userProfile?.email || null,
      })
    })
  }

  async function handleRequestRevision(projectId) {
    await guard('request_revision', async () => {
      await adminService.sendProjectBackToRevision(projectId, {
        uid: userProfile?.uid,
        role: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        displayName: userProfile?.displayName || null,
        email: userProfile?.email || null,
      })
    })
  }

  async function handleChangeTier(clientId, tierKey) {
    await guard('change_client_tier', async () => {
      await adminService.updateClientSubscriptionTier(clientId, tierKey)
    })
  }

  async function handleAdjustCredits(payload) {
    if (!canAction('adjust_client_credits')) {
      setError('You do not have permission for this action.')
      throw new Error('forbidden')
    }
    setAdjustingCredits(true)
    setError('')
    try {
      await adminService.adjustClientCredits({ ...payload, createdBy: userProfile?.uid || 'admin' })
    } finally {
      setAdjustingCredits(false)
    }
  }

  async function handleUpdateAdminType(userId, adminType) {
    await guard('manage_admins', async () => {
      await adminService.updateAdminType(userId, adminType)
    })
  }

  async function handleUpdateAdminPermissions(userId, adminType, adminPermissions) {
    await guard('manage_admins', async () => {
      await adminService.updateAdminPermissions(userId, adminType, adminPermissions)
    })
  }

  async function handleCreateAdmin(payload) {
    await guard('manage_admins', async () => {
      await adminService.createAdminAccount(payload, userProfile?.uid || 'super_admin')
    })
  }

  async function handleUpdateAdminStatus(userId, status) {
    await guard('manage_admins', async () => {
      await adminService.updateUserStatus(userId, status)
    })
  }

  async function handleDeleteAdmin(userId) {
    await guard('manage_admins', async () => {
      const ok = window.confirm('Delete this admin user record?')
      if (!ok) return
      await adminService.deleteUserRecord(userId)
    })
  }

  async function handleUpdateClientStatus(clientId, status) {
    await guard('change_subscription_status', async () => {
      await adminService.updateClientSubscriptionStatus(clientId, status)
    })
  }

  async function handleWarnCreative(creativeId) {
    await guard('warn_creative', async () => {
      await adminService.warnCreative(creativeId, 'Please review your recent performance metrics.', userProfile?.uid || 'admin')
    })
  }

  async function handleSuspendCreative(creativeId, suspended) {
    await guard('suspend_creative', async () => {
      await adminService.suspendCreative(creativeId, suspended)
    })
  }

  async function handleSendNotification(recipientId, title, message) {
    await guard('manage_notifications', async () => {
      await adminService.sendNotificationToUser(recipientId, title, message, userProfile?.uid || 'admin')
    })
  }

  async function handleDeleteNotification(notificationId) {
    await guard('manage_notifications', async () => {
      await adminService.deleteNotification(notificationId)
    })
  }

  async function handleTriggerDigest() {
    await guard('manage_notifications', async () => {
      setDigestRunning(true)
      setError('')
      try {
        const result = await adminService.triggerDailyNotificationDigest()
        setDigestResult(result)
      } finally {
        setDigestRunning(false)
      }
    })
  }

  async function handleRunWorkspaceMigration(pruneLegacy = false) {
    await guard('manage_admins', async () => {
      setWorkspaceMigrationRunning(true)
      setError('')
      try {
        const result = await adminService.runWorkspaceMigration({
          pruneLegacy,
          maxProjects: Number(workspaceMigrationMaxProjects) || 0,
          startAfterId: workspaceMigrationCursor,
        })
        setWorkspaceMigrationResult({
          ...result,
          pruneLegacy,
          finishedAt: new Date().toISOString(),
        })
        if (result?.nextCursor) {
          setWorkspaceMigrationCursor(result.nextCursor)
        }
      } finally {
        setWorkspaceMigrationRunning(false)
      }
    })
  }

  async function handleRunExpiredPackCleanup() {
    await guard('manage_admins', async () => {
      setExpiryCleanupRunning(true)
      setError('')
      try {
        const result = await adminService.triggerExpiredCreditPackCleanup()
        setExpiryCleanupResult({ ...result, finishedAt: new Date().toISOString() })
      } finally {
        setExpiryCleanupRunning(false)
      }
    })
  }

  async function handleRunMonthlyCreditAllocation() {
    await guard('manage_admins', async () => {
      setMonthlyAllocationRunning(true)
      setError('')
      try {
        const result = await adminService.triggerMonthlyCreditAllocationJob()
        setMonthlyAllocationResult({ ...result, finishedAt: new Date().toISOString() })
      } finally {
        setMonthlyAllocationRunning(false)
      }
    })
  }

  function handleUseMigrationCursor(cursor) {
    if (!cursor) return
    setWorkspaceMigrationCursor(cursor)
    setActiveModule('overview')
  }

  async function handleAdjustProjectEstimate(projectId, nextCredits) {
    await guard('adjust_project_credits', async () => {
      await adminService.updateProjectCreditsEstimate(projectId, nextCredits)
    })
  }

  async function handleUpdateUserRole(userId, role) {
    await guard('manage_users', async () => {
      await adminService.updateUserRole(userId, role)
    })
  }

  async function handleUpdateUserStatus(userId, status) {
    await guard('manage_users', async () => {
      await adminService.updateUserStatus(userId, status)
    })
  }

  async function handleAssignAdmin(userId) {
    await guard('manage_admins', async () => {
      const adminType = window.prompt('Assign admin type: project_admin or app_admin', 'project_admin')
      if (!adminType) return
      await adminService.assignAdminRole(userId, adminType)
    })
  }

  async function handleDeleteUser(userId) {
    await guard('manage_users', async () => {
      const ok = window.confirm('Delete this user record? This removes Firestore user metadata only.')
      if (!ok) return
      await adminService.deleteUserRecord(userId)
    })
  }

  async function handleUpdatePaymentStatus(paymentId, status) {
    await guard('change_subscription_status', async () => {
      await adminService.updatePaymentStatus(paymentId, status)
    })
  }

  async function handleCreateTemplateAsset(payload) {
    await guard('manage_template_assets', async () => {
      await adminService.createTemplateAsset(payload, userProfile?.uid || 'admin')
    })
  }

  async function handleDeleteTemplateAsset(assetId) {
    await guard('manage_template_assets', async () => {
      await adminService.deleteTemplateAsset(assetId)
    })
  }

  async function handleSaveWorkspace(projectId, payload) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.updateProjectWorkspace(projectId, payload, {
        uid: userProfile?.uid,
        role: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        displayName: userProfile?.displayName || null,
        email: userProfile?.email || null,
      })
    } finally {
      setWorkspaceSaving(false)
    }
  }

  async function handleAddComment(projectId, comment) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.addProjectComment(projectId, {
        ...comment,
        authorId: userProfile?.uid,
        authorRole: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        authorDisplayName: userProfile?.displayName || null,
        authorEmail: userProfile?.email || null,
      })
    } finally {
      setWorkspaceSaving(false)
    }
  }

  async function handleUpdateCommentStatus(projectId, commentId, status) {
    setWorkspaceSaving(true)
    setError('')
    try {
      await projectService.updateCommentStatus(projectId, commentId, status, {
        uid: userProfile?.uid,
        role: isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin',
        displayName: userProfile?.displayName || null,
        email: userProfile?.email || null,
      })
    } finally {
      setWorkspaceSaving(false)
    }
  }

  function handleViewClientWorkspace(clientId) {
    const project = projects.find((entry) => entry.clientId === clientId)
    if (!project) {
      setError('No projects found for this client yet.')
      return
    }
    setSelectedProjectId(project.id)
  }

  function handleViewCreativeWorkspace(creativeId) {
    const project = projects.find((entry) => entry.assignedCreativeId === creativeId)
    if (!project) {
      setError('No assigned projects found for this creative yet.')
      return
    }
    setSelectedProjectId(project.id)
  }

  function handleRefundCredits(client) {
    if (!client) return
    setSelectedClientForAdjustment({
      ...client,
      adjustmentPreset: {
        mode: 'add',
        reason: 'Client credit refund',
      },
    })
  }

  async function handleRunMonthlyCps() {
    await guard('manage_admins', async () => {
      setMonthlyCpsRunning(true)
      setError('')
      try {
        const result = await adminService.triggerMonthlyCPSCalculation()
        setMonthlyCpsResult(result)
      } finally {
        setMonthlyCpsRunning(false)
      }
    })
  }

  async function handleManualPerformanceOverride(payload) {
    await guard('manage_admins', async () => {
      await adminService.overrideCreativePerformanceReview(payload)
    })
  }

  function renderModule() {
    if (activeModule === 'overview') {
      return (
        <div className="space-y-6">
          <PlatformKPIs kpis={kpis} />
          <NotificationSummaryCard
            unreadCount={unreadNotificationsCount}
            onOpen={() => setActiveModule('notifications')}
          />
          <RevenueChart
            revenueTrend={revenueAnalytics.trend}
            subscriptionBreakdown={revenueAnalytics.subscriptionBreakdown}
            revenuePerCredit={revenueAnalytics.revenuePerCredit}
            extraCreditPackSales={revenueAnalytics.extraCreditPackSales}
            churnRate={revenueAnalytics.churnRate}
          />
          <CreditAnalyticsPanel analytics={creditAnalytics} />
          <PaymentMonitoringPanel payments={payments} clients={clients} />
          <PerformanceAlerts
            creatives={creatives}
            clients={clients}
            projects={projects}
            payments={payments}
            onViewCreative={handleViewCreativeWorkspace}
            onViewClient={handleViewClientWorkspace}
            onOpenProjectWorkspace={(projectId) => setSelectedProjectId(projectId)}
          />
          <SystemJobsPanel jobs={systemJobs} onResume={canAction('manage_admins') ? handleUseMigrationCursor : undefined} />
        </div>
      )
    }

    if (activeModule === 'users') {
      return (
        <UsersManagementPanel
          users={users}
          onUpdateRole={handleUpdateUserRole}
          onUpdateStatus={handleUpdateUserStatus}
          onDeleteUser={handleDeleteUser}
          onPromoteAdmin={handleAssignAdmin}
        />
      )
    }

    if (activeModule === 'clients') {
      return (
        <ClientManagementTable
          clients={clients}
          onAdjustCredits={setSelectedClientForAdjustment}
          onChangeTier={handleChangeTier}
          onUpdateStatus={handleUpdateClientStatus}
          onSendNotification={handleSendNotification}
          onViewClient={handleViewClientWorkspace}
          onRefundCredits={handleRefundCredits}
        />
      )
    }

    if (activeModule === 'creatives') {
      return (
        <div className="space-y-4">
          <CreativeManagementTable
            creatives={creatives}
            projectsByCreative={projectsByCreative}
            onWarnCreative={handleWarnCreative}
            onSuspendCreative={handleSuspendCreative}
            onViewCreative={handleViewCreativeWorkspace}
          />
          <CreativePerformancePanel
            creatives={creatives}
            onManualOverride={handleManualPerformanceOverride}
            onRunMonthlyCps={monthlyCpsRunning ? undefined : handleRunMonthlyCps}
          />
          {monthlyCpsResult ? (
            <p className="text-xs text-muted-foreground">
              CPS run result: processed {Number(monthlyCpsResult.processed || 0)}, warnings {Number(monthlyCpsResult.warningsIssued || 0)}, promotions {Number(monthlyCpsResult.promotions || 0)}.
            </p>
          ) : null}
          {monthlyCpsRunning ? <p className="text-xs text-muted-foreground">Running monthly CPS calculation...</p> : null}
        </div>
      )
    }

    if (activeModule === 'projects') {
      return (
        <ProjectOversightPanel
          projects={projects}
          creatives={creatives}
          onAssignProject={handleAssignProject}
          onApproveQC={handleApproveQC}
          onRequestRevision={handleRequestRevision}
          onOpenWorkspace={(projectId) => setSelectedProjectId(projectId)}
          onAdjustProjectEstimate={canAction('adjust_project_credits') ? handleAdjustProjectEstimate : undefined}
        />
      )
    }

    if (activeModule === 'credit_transactions') {
      return <CreditTransactionsManagementPanel transactions={creditTransactions} clients={clients} projects={projects} />
    }

    if (activeModule === 'payments_subscriptions') {
      return (
        <PaymentsSubscriptionsManagementPanel
          payments={payments}
          clients={clients}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
          onUpdateSubscriptionStatus={handleUpdateClientStatus}
        />
      )
    }

    if (activeModule === 'notifications') {
      return (
        <NotificationsManagementPanel
          notifications={notifications}
          users={users}
          clients={clients}
          creatives={creatives}
          onSendNotification={handleSendNotification}
          onDeleteNotification={handleDeleteNotification}
          onTriggerDigest={handleTriggerDigest}
          digestRunning={digestRunning}
          digestResult={digestResult}
        />
      )
    }

    if (activeModule === 'template_assets') {
      return (
        <TemplateAssetLibraryPanel
          assets={templateAssets}
          creatives={creatives}
          onCreateAsset={handleCreateTemplateAsset}
          onDeleteAsset={handleDeleteTemplateAsset}
        />
      )
    }

    if (activeModule === 'reports') {
      return <ReportGenerator clients={clients} creatives={creatives} projects={projects} creditTransactions={creditTransactions} />
    }

    return (
      <div className="space-y-3">
        {canAction('manage_admins') ? (
          <div className="rounded border border-border bg-white p-3">
            <p className="text-sm font-medium">Workspace migration tools</p>
            <p className="text-xs text-muted-foreground">Backfill legacy workspace arrays into subcollections from server-side admin action.</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Max projects this run (0 = full run)
                <input
                  type="number"
                  min="0"
                  value={workspaceMigrationMaxProjects}
                  onChange={(event) => setWorkspaceMigrationMaxProjects(Number(event.target.value))}
                  className="mt-1 w-full rounded border border-border px-2 py-1 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Resume after project ID (cursor)
                <input
                  type="text"
                  value={workspaceMigrationCursor}
                  onChange={(event) => setWorkspaceMigrationCursor(event.target.value)}
                  className="mt-1 w-full rounded border border-border px-2 py-1 text-sm text-foreground"
                  placeholder="optional project id cursor"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border border-border px-3 py-1.5 text-sm"
                onClick={() => handleRunWorkspaceMigration(false)}
                disabled={workspaceMigrationRunning}
              >
                {workspaceMigrationRunning ? 'Running migration...' : 'Run migrate'}
              </button>
              <button
                className="rounded border border-border px-3 py-1.5 text-sm"
                onClick={() => handleRunWorkspaceMigration(true)}
                disabled={workspaceMigrationRunning}
              >
                {workspaceMigrationRunning ? 'Running migration...' : 'Run migrate + prune'}
              </button>
            </div>
            {workspaceMigrationResult ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Last run: scanned {workspaceMigrationResult.scanned || 0}, migrated {workspaceMigrationResult.migratedProjects || 0}, writes {workspaceMigrationResult.totalInserted || 0}, prune {workspaceMigrationResult.pruneLegacy ? 'yes' : 'no'}, cursor {workspaceMigrationResult.nextCursor || 'none'}, job {workspaceMigrationResult.jobId || 'n/a'}.
              </p>
            ) : null}

            <div className="mt-3 rounded border border-border p-3">
              <p className="text-sm font-medium">Credit maintenance tools</p>
              <p className="text-xs text-muted-foreground">Run monthly allocation and expired-pack cleanup jobs on demand.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={handleRunMonthlyCreditAllocation}
                  disabled={monthlyAllocationRunning}
                >
                  {monthlyAllocationRunning ? 'Running allocation...' : 'Run monthly allocation'}
                </button>
                <button
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={handleRunExpiredPackCleanup}
                  disabled={expiryCleanupRunning}
                >
                  {expiryCleanupRunning ? 'Running cleanup...' : 'Run expired-pack cleanup'}
                </button>
              </div>
              {monthlyAllocationResult ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Allocation run: processed {monthlyAllocationResult.processedClients || 0}, allocated {monthlyAllocationResult.allocatedClients || 0}, total credits {monthlyAllocationResult.totalAllocatedCredits || 0}.
                </p>
              ) : null}
              {expiryCleanupResult ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cleanup run: clients updated {expiryCleanupResult.clientsUpdated || 0}, packs expired {expiryCleanupResult.packsExpired || 0}, credits expired {expiryCleanupResult.creditsExpired || 0}.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <AdminRoleManagement
          admins={admins}
          onUpdateAdminType={handleUpdateAdminType}
          onUpdateAdminPermissions={handleUpdateAdminPermissions}
          onCreateAdmin={handleCreateAdmin}
          onUpdateAdminStatus={handleUpdateAdminStatus}
          onDeleteAdmin={handleDeleteAdmin}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
      </main>
    )
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 shrink-0 border-r border-border p-4">
        <h1 className="text-xl font-semibold">Founder Console</h1>
        <p className="mt-1 text-xs text-muted-foreground">{userProfile?.displayName || 'Super Admin'}</p>

        <nav className="mt-4 space-y-1">
          {visibleModules.map((module) => (
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
            <h2 className="text-2xl font-semibold">{visibleModules.find((entry) => entry.key === activeModule)?.label || 'Overview'}</h2>
            <p className="text-sm text-muted-foreground">Operate the platform from focused modules with role-based controls.</p>
          </div>
          <NotificationCenter userId={user?.uid} onOpenNotificationsPage={() => setActiveModule('notifications')} />
        </header>
        {inboxUnreadCount > 0 ? (
          <p className="mb-3 text-xs text-muted-foreground">Your unread inbox notifications: {inboxUnreadCount}</p>
        ) : null}
        {error ? <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {renderModule()}
      </section>

      {selectedProject ? (
        <ProjectWorkspace
          project={selectedProject}
          currentUser={{
            uid: userProfile?.uid,
            email: userProfile?.email,
            displayName: userProfile?.displayName,
          }}
          workspaceRole={isSuperAdmin ? 'super_admin' : userProfile?.adminType || 'project_admin'}
          onClose={() => setSelectedProjectId('')}
          onSave={handleSaveWorkspace}
          onAddComment={handleAddComment}
          onUpdateCommentStatus={handleUpdateCommentStatus}
          onApproveForClientReview={handleApproveQC}
          onRequestRevision={handleRequestRevision}
          saving={workspaceSaving}
        />
      ) : null}

      {selectedClientForAdjustment ? (
        <CreditAdjustmentModal
          key={`${selectedClientForAdjustment.id}-${selectedClientForAdjustment.adjustmentPreset?.mode || 'add'}-${selectedClientForAdjustment.adjustmentPreset?.reason || ''}`}
          open={Boolean(selectedClientForAdjustment)}
          client={selectedClientForAdjustment}
          onClose={() => setSelectedClientForAdjustment(null)}
          onSubmit={handleAdjustCredits}
          submitting={adjustingCredits}
        />
      ) : null}
    </main>
  )
}

export default AdminDashboard
