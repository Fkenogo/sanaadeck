import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { deleteApp, initializeApp } from 'firebase/app'
import { db, firebaseConfig, functions } from './firebase'
import { ADMIN_ACTION_KEYS, ADMIN_MODULE_KEYS, ADMIN_PERMISSION_PRESETS, TIER_BY_KEY } from '@/utils/constants'

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

function normalizeTimestamp(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
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
          .sort((a, b) => normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt))
        onData(records)
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async assignProject(projectId, creativeId, actor = null) {
    if (!projectId) throw new Error('projectId is required')
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()
    const previousAssigned = data.assignedCreativeId || null
    const previousAssignedIds = Array.isArray(data.assignedCreativeIds) ? data.assignedCreativeIds : []
    const nextAssignedIds = creativeId
      ? Array.from(new Set([...previousAssignedIds.filter(Boolean), creativeId]))
      : previousAssignedIds.filter((entry) => entry && entry !== previousAssigned)

    await updateDoc(projectRef, {
      assignedCreativeId: creativeId || null,
      assignedCreativeIds: nextAssignedIds,
      status: creativeId ? 'confirmed' : 'pending_confirmation',
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
    await updateDoc(doc(db, 'projects', projectId), {
      status: 'revision_requested',
      revisionRequestedBy: 'admin',
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

  async createTemplateAsset(payload, createdBy = 'admin') {
    if (!payload?.title || !payload?.url) {
      throw new Error('Asset title and url are required')
    }

    await addDoc(collection(db, 'templateAssetLibrary'), {
      title: payload.title,
      category: payload.category || 'general',
      url: payload.url,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async deleteTemplateAsset(assetId) {
    if (!assetId) throw new Error('assetId is required')
    await deleteDoc(doc(db, 'templateAssetLibrary', assetId))
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
