import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { deleteApp, initializeApp } from 'firebase/app'
import { db, firebaseConfig, functions } from './firebase'
import { ADMIN_ACTION_KEYS, ADMIN_MODULE_KEYS, ADMIN_PERMISSION_PRESETS, TIER_BY_KEY } from '@/utils/constants'
import { toMillis } from '../utils/timestamp'

function normalizeAdminPermissions(adminType, provided = {}) {
  const preset = ADMIN_PERMISSION_PRESETS[adminType] || ADMIN_PERMISSION_PRESETS.project_admin
  const modules = {}
  const actions = {}

  ADMIN_MODULE_KEYS.forEach((key) => {
    modules[key] = typeof provided.modules?.[key] === 'boolean' ? provided.modules[key] : Boolean(preset.modules[key])
  })

  ADMIN_ACTION_KEYS.forEach((key) => {
    actions[key] = typeof provided.actions?.[key] === 'boolean' ? provided.actions[key] : Boolean(preset.actions[key])
  })

  return { modules, actions }
}

function toWorkflowStatus(status) {
  const map = {
    pending_confirmation: 'pending',
    confirmed: 'assigned',
    in_progress: 'in_progress',
    ready_for_qc: 'review',
    client_review: 'review',
    revision_requested: 'revision',
    approved: 'completed',
  }
  return map[status] || status || 'pending'
}

function normalizeAssignmentBreakdown(raw = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const keys = ['skillMatchScore', 'workloadScore', 'qualityScore', 'experienceScore', 'availabilityScore']
  const normalized = {}
  let hasAny = false
  keys.forEach((key) => {
    const value = Number(raw[key])
    if (!Number.isFinite(value)) return
    hasAny = true
    normalized[key] = Number(value.toFixed(2))
  })
  return hasAny ? normalized : null
}

function creditAmount(entry = {}) {
  const value = Number(entry.creditsAmount ?? entry.amount ?? 0)
  return Number.isFinite(value) ? value : 0
}

function normalizeRevisionCount(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed)
}

function computeRevisionRate(revisionCount) {
  return Number((normalizeRevisionCount(revisionCount) / 3).toFixed(2))
}

function computeDelayRisk({ status, deadline, revisionCount }) {
  const normalizedStatus = String(status || '').toLowerCase()
  const deadlineMs = toMillis(deadline)
  const now = Date.now()
  const nearThreshold = now + (48 * 60 * 60 * 1000)
  const deadlineNear = deadlineMs > 0 && deadlineMs <= nearThreshold
  const notStarted = ['pending_confirmation', 'confirmed'].includes(normalizedStatus)
  const multipleRevisions = normalizeRevisionCount(revisionCount) >= 2
  return (deadlineNear && notStarted) || (deadlineNear && multipleRevisions) || (notStarted && multipleRevisions)
}

function resolveRevenuePerCredit(tier) {
  const tierKey = String(tier || 'starter').toLowerCase()
  const config = TIER_BY_KEY[tierKey] || TIER_BY_KEY.starter
  const credits = Number(config?.creditsPerMonth || 0)
  const price = Number(config?.priceUsd || 0)
  if (!Number.isFinite(credits) || credits <= 0) return 0
  return price / credits
}

const ACTIVE_ASSIGNED_PROJECT_STATUSES = new Set([
  'confirmed',
  'in_progress',
  'ready_for_qc',
  'client_review',
  'revision_requested',
])

function normalizeRecommendationList(recommendations = []) {
  if (!Array.isArray(recommendations)) return []
  return recommendations.slice(0, 8).map((entry) => ({
    creativeId: String(entry?.creativeId || '').trim(),
    creativeName: String(entry?.creativeName || '').trim() || null,
    score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : null,
    reason: String(entry?.reason || '').trim() || null,
    assignmentBreakdown: normalizeAssignmentBreakdown(entry?.assignmentBreakdown),
  })).filter((entry) => entry.creativeId)
}

async function recomputeCreativePerformanceProfile(creativeId) {
  if (!creativeId) return
  const snapshot = await getDocs(query(collection(db, 'projects'), where('assignedCreativeId', '==', creativeId)))
  const projects = snapshot.docs.map((entry) => entry.data())
  if (projects.length === 0) return

  const revisionRates = projects.map((project) => {
    const explicit = Number(project?.revisionRate)
    if (Number.isFinite(explicit)) return explicit
    return computeRevisionRate(project?.revisionCount)
  })
  const avgRevisionRate = revisionRates.length > 0
    ? Number((revisionRates.reduce((sum, value) => sum + value, 0) / revisionRates.length).toFixed(2))
    : 0

  const ratings = projects
    .map((project) => Number(project?.clientRating?.rating))
    .filter((value) => Number.isFinite(value) && value > 0)
  const avgClientRating = ratings.length > 0
    ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
    : 0

  const completedDurations = projects
    .filter((project) => String(project?.status || '').toLowerCase() === 'approved')
    .map((project) => {
      const createdAtMs = toMillis(project?.createdAt)
      const completedAtMs = toMillis(project?.approvedAt || project?.updatedAt)
      if (!createdAtMs || !completedAtMs || completedAtMs < createdAtMs) return 0
      return (completedAtMs - createdAtMs) / (1000 * 60 * 60)
    })
    .filter((value) => Number.isFinite(value) && value > 0)
  const completionSpeed = completedDurations.length > 0
    ? Number((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length).toFixed(2))
    : 0

  await updateDoc(doc(db, 'creatives', creativeId), {
    'performance.avgRevisionRate': avgRevisionRate,
    'performance.avgClientRating': avgClientRating,
    'performance.completionSpeed': completionSpeed,
    updatedAt: serverTimestamp(),
  })
}


class AdminService {
  constructor() {
    this.runWorkspaceMigrationCallable = httpsCallable(functions, 'runWorkspaceMigration')
    this.triggerDailyNotificationDigestCallable = httpsCallable(functions, 'triggerDailyNotificationDigest')
    this.triggerExpiredCreditPackCleanupCallable = httpsCallable(functions, 'triggerExpiredCreditPackCleanup')
    this.triggerMonthlyCreditAllocationJobCallable = httpsCallable(functions, 'triggerMonthlyCreditAllocationJob')
    this.triggerMonthlyCPSCalculationCallable = httpsCallable(functions, 'triggerMonthlyCPSCalculation')
    this.overrideCreativePerformanceReviewCallable = httpsCallable(functions, 'overrideCreativePerformanceReview')
    this.getCreditTransactionsPageCallable = httpsCallable(functions, 'getCreditTransactionsPage')
  }

  subscribeToCollection(collectionName, onData, onError) {
    return onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        const records = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        onData(records)
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async assignProject(projectId, creativeId, actor = null, assignmentMeta = {}) {
    if (!projectId) throw new Error('projectId is required')
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()
    const briefScore = Number(data?.briefScore || 0)
    const minimumBriefScore = Number.isFinite(Number(assignmentMeta?.minimumBriefScore))
      ? Number(assignmentMeta.minimumBriefScore)
      : 50

    if (briefScore < minimumBriefScore) {
      await updateDoc(projectRef, {
        workflowStatus: 'brief_needs_clarification',
        assignmentStatus: 'unassigned',
        updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, 'notifications'), {
        recipientId: data.clientId,
        projectId,
        type: 'project_update',
        title: 'Brief needs clarification',
        message: 'Your request needs more detail before creative assignment. Please improve your brief and attachments.',
        channels: { inApp: true, email: true, sms: false },
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      throw new Error(`Brief quality below threshold (${briefScore}/${minimumBriefScore}).`)
    }

    if (String(data.workflowStatus || '').toLowerCase() !== 'ready_for_assignment') {
      await updateDoc(projectRef, {
        workflowStatus: 'ready_for_assignment',
        updatedAt: serverTimestamp(),
      })
    }

    if (creativeId) {
      const creativeSnap = await getDoc(doc(db, 'creatives', creativeId))
      const creativeData = creativeSnap.exists() ? creativeSnap.data() : {}
      const availability = String(creativeData?.availabilityStatus || creativeData?.availability || 'available').toLowerCase()
      if (availability === 'unavailable') {
        throw new Error('Selected creative is unavailable.')
      }

      const maxActiveProjects = Number(creativeData?.maxActiveProjects || 3)
      const currentLoadScore = Number(creativeData?.currentLoadScore || 0)
      const activeAssignedSnap = await getDocs(
        query(
          collection(db, 'projects'),
          where('assignedCreativeId', '==', creativeId),
          where('status', 'in', [...ACTIVE_ASSIGNED_PROJECT_STATUSES]),
        ),
      )
      const activeProjects = activeAssignedSnap.size
      if (activeProjects >= maxActiveProjects || currentLoadScore >= 90) {
        throw new Error('Selected creative is at capacity. Choose the next recommended creative.')
      }
    }

    const previousAssigned = data.assignedCreativeId || null
    const previousAssignedIds = Array.isArray(data.assignedCreativeIds) ? data.assignedCreativeIds : []
    const nextAssignedIds = creativeId
      ? Array.from(new Set([...previousAssignedIds.filter(Boolean), creativeId]))
      : previousAssignedIds.filter((entry) => entry && entry !== previousAssigned)

    const nextAssignmentStatus = creativeId
      ? (previousAssigned && previousAssigned !== creativeId ? 'reassigned' : 'assigned')
      : (assignmentMeta.assignmentStatus || 'unassigned')

    const assignmentReason = String(assignmentMeta.assignmentReason || '').trim()
    const assignmentScoreRaw = Number(assignmentMeta.assignmentScore)
    const assignmentScore = Number.isFinite(assignmentScoreRaw) ? assignmentScoreRaw : null
    const assignmentBreakdown = normalizeAssignmentBreakdown(assignmentMeta.assignmentBreakdown)
    const assignmentRecommendations = normalizeRecommendationList(assignmentMeta.assignmentRecommendations)

    await updateDoc(projectRef, {
      assignedCreativeId: creativeId || null,
      assignedCreativeIds: nextAssignedIds,
      status: creativeId ? 'confirmed' : 'pending_confirmation',
      workflowStatus: creativeId ? 'assigned' : 'ready_for_assignment',
      assignmentStatus: nextAssignmentStatus,
      assignmentScore,
      assignmentReason,
      assignmentBreakdown,
      assignmentRecommendations,
      updatedAt: serverTimestamp(),
    })

    if (creativeId) {
      const creativeUserSnap = await getDoc(doc(db, 'users', creativeId))
      const creativeUser = creativeUserSnap.exists() ? creativeUserSnap.data() : {}
      await setDoc(
        doc(db, 'projects', projectId, 'members', creativeId),
        {
          uid: creativeId,
          role: 'creative_lead',
          status: 'active',
          displayName: creativeUser.displayName || null,
          email: creativeUser.email || null,
          addedBy: actor?.uid || 'admin',
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      await addDoc(collection(db, 'notifications'), {
        recipientId: creativeId,
        projectId,
        type: 'project_update',
        title: 'New project assigned',
        message: `${data.title || 'A project'} has been assigned to you.`,
        channels: {
          inApp: true,
          email: true,
          sms: false,
        },
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    if (actor?.uid) {
      const actorUserSnap = await getDoc(doc(db, 'users', actor.uid))
      const actorUser = actorUserSnap.exists() ? actorUserSnap.data() : {}
      await setDoc(
        doc(db, 'projects', projectId, 'members', actor.uid),
        {
          uid: actor.uid,
          role: actor.role || 'project_admin',
          status: 'active',
          displayName: actorUser.displayName || null,
          email: actorUser.email || null,
          addedBy: actor.uid,
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
  }

  async updateClientSubscriptionTier(clientId, tierKey) {
    if (!clientId) throw new Error('clientId is required')

    const tier = TIER_BY_KEY[tierKey]
    if (!tier) {
      throw new Error('Invalid tier key')
    }

    const clientRef = doc(db, 'clients', clientId)

    await runTransaction(db, async (tx) => {
      const clientSnap = await tx.get(clientRef)
      if (!clientSnap.exists()) throw new Error('Client not found')

      const data = clientSnap.data()
      const used = Number(data?.subscription?.creditsUsed || 0)
      const nextRemaining = Math.max(0, tier.creditsPerMonth - used)

      tx.update(clientRef, {
        'subscription.tier': tier.key,
        'subscription.creditsPerMonth': tier.creditsPerMonth,
        'subscription.creditsRemaining': nextRemaining,
        updatedAt: serverTimestamp(),
      })
    })
  }

  async markProjectForClientReview(projectId, actor = null) {
    await updateDoc(doc(db, 'projects', projectId), {
      status: 'client_review',
      workflowStatus: toWorkflowStatus('client_review'),
      updatedAt: serverTimestamp(),
    })

    if (actor?.uid) {
      await setDoc(
        doc(db, 'projects', projectId, 'members', actor.uid),
        {
          uid: actor.uid,
          role: actor.role || 'project_admin',
          status: 'active',
          addedBy: actor.uid,
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
  }

  async sendProjectBackToRevision(projectId, actor = null) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data() || {}
    const revisionCount = normalizeRevisionCount(data.revisionCount) + 1
    const revisionRate = computeRevisionRate(revisionCount)

    await updateDoc(projectRef, {
      status: 'revision_requested',
      workflowStatus: toWorkflowStatus('revision_requested'),
      revisionRequestedBy: 'admin',
      revisionCount,
      revisionRate,
      revisionFlag: revisionCount > 3,
      delayRisk: computeDelayRisk({
        status: 'revision_requested',
        deadline: data.deadline,
        revisionCount,
      }),
      updatedAt: serverTimestamp(),
    })

    if (data.assignedCreativeId) {
      await recomputeCreativePerformanceProfile(data.assignedCreativeId).catch((error) => {
        console.error('[AdminService] Failed to update creative performance after revision:', error)
      })
    }

    if (actor?.uid) {
      await setDoc(
        doc(db, 'projects', projectId, 'members', actor.uid),
        {
          uid: actor.uid,
          role: actor.role || 'project_admin',
          status: 'active',
          addedBy: actor.uid,
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
  }

  async updateAdminType(userId, adminType) {
    if (!userId) throw new Error('userId is required')
    if (!['project_admin', 'app_admin'].includes(adminType)) {
      throw new Error('Invalid adminType')
    }

    await updateDoc(doc(db, 'users', userId), {
      adminType,
      adminPermissions: normalizeAdminPermissions(adminType),
      updatedAt: serverTimestamp(),
    })
  }

  async adjustClientCredits({ clientId, amount, mode, reason, createdBy = 'admin' }) {
    if (!clientId) throw new Error('clientId is required')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be a positive number')
    if (!['add', 'deduct'].includes(mode)) throw new Error('mode must be add or deduct')

    const clientRef = doc(db, 'clients', clientId)

    await runTransaction(db, async (transaction) => {
      const clientSnap = await transaction.get(clientRef)
      if (!clientSnap.exists()) throw new Error('Client not found')

      const clientData = clientSnap.data()
      const currentRemaining = Number(clientData?.subscription?.creditsRemaining || 0)
      const currentUsed = Number(clientData?.subscription?.creditsUsed || 0)

      const nextRemaining = mode === 'add' ? currentRemaining + amount : currentRemaining - amount
      if (nextRemaining < 0) {
        throw new Error('Cannot deduct more credits than available')
      }

      transaction.update(clientRef, {
        'subscription.creditsRemaining': nextRemaining,
        // Deduction counts as administrative usage adjustment to preserve accounting.
        'subscription.creditsUsed': mode === 'deduct' ? currentUsed + amount : currentUsed,
        updatedAt: serverTimestamp(),
      })

      const txRef = doc(collection(db, 'creditTransactions'))
      transaction.set(txRef, {
        clientId,
        projectId: null,
        type: 'admin_adjustment',
        source: 'admin',
        direction: mode,
        amount,
        creditsAmount: amount,
        balanceBefore: currentRemaining,
        balanceAfter: nextRemaining,
        description: reason || `Admin ${mode} credit adjustment`,
        createdAt: Timestamp.now(),
        createdBy,
      })
    })
  }

  async updateClientSubscriptionStatus(clientId, status) {
    if (!clientId) throw new Error('clientId is required')
    if (!['active', 'paused', 'canceled', 'past_due'].includes(status)) {
      throw new Error('Invalid subscription status')
    }

    await updateDoc(doc(db, 'clients', clientId), {
      'subscription.status': status,
      updatedAt: serverTimestamp(),
    })
  }

  async warnCreative(creativeId, note, createdBy = 'admin') {
    if (!creativeId) throw new Error('creativeId is required')

    await updateDoc(doc(db, 'creatives', creativeId), {
      lastWarningAt: serverTimestamp(),
      lastWarningNote: note || 'Performance warning issued',
      updatedAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'notifications'), {
      recipientId: creativeId,
      title: 'Performance Review Alert',
      message: note || 'A performance warning was issued by admin.',
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      read: false,
      type: 'performance_alert',
      channels: {
        inApp: true,
        email: true,
        sms: false,
      },
    })
  }

  async suspendCreative(creativeId, suspended = true) {
    if (!creativeId) throw new Error('creativeId is required')
    await updateDoc(doc(db, 'creatives', creativeId), {
      status: suspended ? 'suspended' : 'active',
      updatedAt: serverTimestamp(),
    })
  }

  async sendNotificationToUser(recipientId, title, message, createdBy = 'admin') {
    if (!recipientId) throw new Error('recipientId is required')
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      title,
      message,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      read: false,
      type: 'system',
      channels: {
        inApp: true,
        email: false,
        sms: false,
      },
    })
  }

  async updateProjectCreditsEstimate(projectId, confirmedCredits) {
    if (!projectId) throw new Error('projectId is required')
    if (!Number.isFinite(confirmedCredits) || confirmedCredits <= 0) {
      throw new Error('confirmedCredits must be a positive number')
    }

    await updateDoc(doc(db, 'projects', projectId), {
      confirmedCredits: Number(confirmedCredits),
      updatedAt: serverTimestamp(),
    })
  }

  async updateUserRole(userId, role) {
    if (!userId) throw new Error('userId is required')
    if (!['client', 'creative', 'admin', 'super_admin'].includes(role)) {
      throw new Error('Invalid user role')
    }
    await updateDoc(doc(db, 'users', userId), {
      role,
      updatedAt: serverTimestamp(),
    })
  }

  async updateUserStatus(userId, status) {
    if (!userId) throw new Error('userId is required')
    if (!['active', 'suspended', 'disabled'].includes(status)) {
      throw new Error('Invalid user status')
    }
    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  async assignAdminRole(userId, adminType = 'project_admin') {
    if (!userId) throw new Error('userId is required')
    if (!['project_admin', 'app_admin'].includes(adminType)) {
      throw new Error('Invalid adminType')
    }
    await updateDoc(doc(db, 'users', userId), {
      role: 'admin',
      adminType,
      adminPermissions: normalizeAdminPermissions(adminType),
      updatedAt: serverTimestamp(),
    })
  }

  async updateAdminPermissions(userId, adminType, adminPermissions) {
    if (!userId) throw new Error('userId is required')
    if (!['project_admin', 'app_admin'].includes(adminType)) {
      throw new Error('Invalid adminType')
    }

    await updateDoc(doc(db, 'users', userId), {
      role: 'admin',
      adminType,
      adminPermissions: normalizeAdminPermissions(adminType, adminPermissions),
      updatedAt: serverTimestamp(),
    })
  }

  async createAdminAccount({ email, password, displayName, adminType = 'project_admin', adminPermissions }, createdBy = 'super_admin') {
    if (!email || !password || !displayName) {
      throw new Error('email, password and displayName are required')
    }
    if (!['project_admin', 'app_admin'].includes(adminType)) {
      throw new Error('Invalid adminType')
    }

    const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`)
    const secondaryAuth = getAuth(secondaryApp)

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const uid = credential.user.uid

      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        displayName,
        role: 'admin',
        adminType,
        adminPermissions: normalizeAdminPermissions(adminType, adminPermissions),
        createdBy,
        createdAt: serverTimestamp(),
        lastLoginAt: null,
        status: 'active',
        emailVerified: false,
        phoneVerified: false,
      })

      return { uid, email }
    } finally {
      await deleteApp(secondaryApp).catch(() => {})
    }
  }

  async deleteUserRecord(userId) {
    if (!userId) throw new Error('userId is required')
    await deleteDoc(doc(db, 'users', userId))
  }

  async updatePaymentStatus(paymentId, status) {
    if (!paymentId) throw new Error('paymentId is required')
    if (!['pending', 'processing', 'completed', 'failed', 'canceled'].includes(status)) {
      throw new Error('Invalid payment status')
    }
    await updateDoc(doc(db, 'payments', paymentId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  async updateCreativeEarningStatus(recordId, status) {
    if (!recordId) throw new Error('recordId is required')
    if (!['earned', 'pending', 'queued', 'paid', 'failed'].includes(status)) {
      throw new Error('Invalid payout status')
    }

    await updateDoc(doc(db, 'creativeEarnings', recordId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  calculateCreditBurnMetrics(creditTransactions = [], clients = []) {
    const safeTransactions = Array.isArray(creditTransactions) ? creditTransactions : []
    const now = Date.now()
    const monthStart = new Date()
    monthStart.setHours(0, 0, 0, 0)
    monthStart.setDate(1)
    const monthStartMs = monthStart.getTime()
    const thirtyDaysAgoMs = now - (30 * 24 * 60 * 60 * 1000)

    const deductionEntries = safeTransactions.filter((entry) => String(entry?.type || '').toLowerCase() === 'deduction')

    const creditsConsumedLast30Days = deductionEntries.reduce((sum, entry) => {
      const createdAtMs = toMillis(entry?.createdAt)
      if (!createdAtMs || createdAtMs < thirtyDaysAgoMs || createdAtMs > now) return sum
      return sum + creditAmount(entry)
    }, 0)

    const creditsConsumedThisMonth = deductionEntries.reduce((sum, entry) => {
      const createdAtMs = toMillis(entry?.createdAt)
      if (!createdAtMs || createdAtMs < monthStartMs || createdAtMs > now) return sum
      return sum + creditAmount(entry)
    }, 0)

    const uniqueClients = new Set(
      (Array.isArray(clients) ? clients : [])
        .map((client) => String(client?.id || '').trim())
        .filter(Boolean),
    )

    const avgCreditsPerClient = uniqueClients.size > 0
      ? Number((creditsConsumedLast30Days / uniqueClients.size).toFixed(2))
      : 0

    return {
      creditsConsumedLast30Days: Number(creditsConsumedLast30Days.toFixed(2)),
      creditsConsumedThisMonth: Number(creditsConsumedThisMonth.toFixed(2)),
      avgCreditsPerClient,
    }
  }

  async updateProjectWorkflowStatus(projectId, workflowStatus) {
    if (!projectId) throw new Error('projectId is required')
    const map = {
      pending: 'pending_confirmation',
      brief_needs_clarification: 'pending_confirmation',
      ready_for_assignment: 'pending_confirmation',
      assigned: 'confirmed',
      in_progress: 'in_progress',
      review: 'ready_for_qc',
      revision: 'revision_requested',
      completed: 'approved',
    }
    const nextStatus = map[workflowStatus]
    if (!nextStatus) throw new Error('Invalid workflow status')
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data() || {}
    if (workflowStatus === 'ready_for_assignment') {
      const briefScore = Number(data?.briefScore || 0)
      const threshold = 50
      if (briefScore < threshold) {
        await updateDoc(projectRef, {
          workflowStatus: 'brief_needs_clarification',
          assignmentStatus: 'unassigned',
          updatedAt: serverTimestamp(),
        })
        await addDoc(collection(db, 'notifications'), {
          recipientId: data.clientId,
          projectId,
          type: 'project_update',
          title: 'Brief needs clarification',
          message: 'Please improve your brief details before we can assign a creative.',
          channels: { inApp: true, email: true, sms: false },
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        throw new Error(`Brief score below minimum threshold (${briefScore}/${threshold}).`)
      }
    }
    const currentRevisionCount = normalizeRevisionCount(data.revisionCount)
    const revisionCount = workflowStatus === 'revision' ? currentRevisionCount + 1 : currentRevisionCount
    const revisionRate = computeRevisionRate(revisionCount)

    const payload = {
      status: nextStatus,
      workflowStatus,
      revisionCount,
      revisionRate,
      revisionFlag: revisionCount > 3,
      delayRisk: computeDelayRisk({
        status: nextStatus,
        deadline: data.deadline,
        revisionCount,
      }),
      updatedAt: serverTimestamp(),
    }
    if (workflowStatus === 'revision') payload.revisionRequestedBy = 'operations'
    if (workflowStatus === 'completed') {
      const creditsConsumed = Number(data.actualCreditsUsed || data.confirmedCredits || data.estimatedCredits || data.creditsConsumed || 0)
      const clientRevenue = Number((creditsConsumed * resolveRevenuePerCredit(data.clientSubscriptionTier || data.tier || 'starter')).toFixed(2))
      const creativeCost = Number(data.creativeCost || data.creativeEarning || 0)
      payload.approvedAt = serverTimestamp()
      payload.creditsConsumed = creditsConsumed
      payload.clientRevenue = clientRevenue
      payload.creativeCost = creativeCost
      payload.projectMargin = Number((clientRevenue - creativeCost).toFixed(2))
    }

    await updateDoc(projectRef, payload)

    if (data.assignedCreativeId && ['revision', 'completed'].includes(workflowStatus)) {
      await recomputeCreativePerformanceProfile(data.assignedCreativeId).catch((error) => {
        console.error('[AdminService] Failed to refresh creative performance after workflow update:', error)
      })
    }
  }

  async flagProjectDelay(projectId, reason = '') {
    if (!projectId) throw new Error('projectId is required')
    await updateDoc(doc(db, 'projects', projectId), {
      delayedFlag: true,
      delayRisk: true,
      delayedReason: String(reason || '').trim() || null,
      delayedFlaggedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async createBriefingTemplate(payload, createdBy = 'admin') {
    if (!payload?.title) {
      throw new Error('Template title is required')
    }

    await addDoc(collection(db, 'briefingTemplates'), {
      title: payload.title,
      category: payload.category || 'general',
      description: payload.description || '',
      suggestedBrief: payload.suggestedBrief || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      usageCount: Number(payload.usageCount || 0),
      status: payload.status || 'active',
      published: payload.published !== false,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async deleteBriefingTemplate(templateId) {
    if (!templateId) throw new Error('templateId is required')
    await deleteDoc(doc(db, 'briefingTemplates', templateId))
  }

  async updateBriefingTemplate(templateId, payload = {}) {
    if (!templateId) throw new Error('templateId is required')

    await updateDoc(doc(db, 'briefingTemplates', templateId), {
      title: payload.title || '',
      category: payload.category || 'general',
      description: payload.description || '',
      suggestedBrief: payload.suggestedBrief || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      updatedAt: serverTimestamp(),
    })
  }

  async setBriefingTemplateStatus(templateId, status) {
    if (!templateId) throw new Error('templateId is required')
    if (!['active', 'inactive'].includes(status)) throw new Error('Invalid status')

    await updateDoc(doc(db, 'briefingTemplates', templateId), {
      status,
      published: status === 'active',
      updatedAt: serverTimestamp(),
    })
  }

  async deleteNotification(notificationId) {
    if (!notificationId) throw new Error('notificationId is required')
    await deleteDoc(doc(db, 'notifications', notificationId))
  }

  async runWorkspaceMigration({ pruneLegacy = false, maxProjects = 0, startAfterId = '' } = {}) {
    const response = await this.runWorkspaceMigrationCallable({
      pruneLegacy: Boolean(pruneLegacy),
      maxProjects: Number(maxProjects) || 0,
      startAfterId: String(startAfterId || '').trim(),
    })
    return response?.data || null
  }

  async triggerDailyNotificationDigest() {
    const response = await this.triggerDailyNotificationDigestCallable({})
    return response?.data || null
  }

  async triggerExpiredCreditPackCleanup() {
    const response = await this.triggerExpiredCreditPackCleanupCallable({})
    return response?.data || null
  }

  async triggerMonthlyCreditAllocationJob() {
    const response = await this.triggerMonthlyCreditAllocationJobCallable({})
    return response?.data || null
  }

  async triggerMonthlyCPSCalculation() {
    const response = await this.triggerMonthlyCPSCalculationCallable({})
    return response?.data || null
  }

  async overrideCreativePerformanceReview(payload) {
    const response = await this.overrideCreativePerformanceReviewCallable(payload || {})
    return response?.data || null
  }

  async getCreditTransactionsPage({ pageSize = 50, cursorMillis = null, filters = {} } = {}) {
    const response = await this.getCreditTransactionsPageCallable({
      pageSize,
      cursorMillis,
      filters,
    })
    return response?.data || { items: [], nextCursorMillis: null, hasMore: false }
  }
}

export default new AdminService()
