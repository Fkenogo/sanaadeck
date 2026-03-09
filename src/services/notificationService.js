import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { toMillis } from '../utils/timestamp'

class NotificationService {
  subscribeToUserNotifications(userId, onData, onError, options = {}) {
    if (!userId) return () => {}

    const { type = 'all', days = 30, max = 200 } = options

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(max),
    )

    return onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifications = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .filter((entry) => {
            if (type && type !== 'all' && entry.type !== type) return false
            if (!days) return true
            return toMillis(entry.createdAt) >= Date.now() - days * 24 * 60 * 60 * 1000
          })

        onData(notifications)
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async markNotificationRead(notificationId) {
    if (!notificationId) return
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async markAsRead(notificationId) {
    return this.markNotificationRead(notificationId)
  }

  async markAllNotificationsRead(userId, notifications = []) {
    if (!userId) return
    const pending = notifications.length > 0
      ? notifications.filter((entry) => entry.recipientId === userId && !entry.read)
      : await this.getUnreadNotifications(userId, 500)

    if (pending.length === 0) return

    const batch = writeBatch(db)
    pending.forEach((entry) => {
      batch.update(doc(db, 'notifications', entry.id), {
        read: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }

  async markAllAsRead(userId, notifications = []) {
    return this.markAllNotificationsRead(userId, notifications)
  }

  async getUnreadNotifications(userId, max = 200) {
    if (!userId) return []
    const unreadQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const snapshot = await getDocs(unreadQuery)
    return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  }

  async getUnreadCount(userId) {
    if (!userId) return 0
    const unreadQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false),
    )
    const snapshot = await getCountFromServer(unreadQuery)
    return Number(snapshot.data()?.count || 0)
  }

  async createNotification(userId, type, title, message, relatedIds = {}, channels = {}) {
    if (!userId) throw new Error('userId is required')
    const payload = {
      recipientId: userId,
      type: type || 'system',
      title: title || 'Notification',
      message: message || '',
      relatedIds,
      channels: {
        inApp: true,
        email: Boolean(channels?.email),
        sms: Boolean(channels?.sms),
      },
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const result = await addDoc(collection(db, 'notifications'), payload)
    return { id: result.id, ...payload }
  }

  buildProjectUpdateTemplate({ projectTitle, newStatus, projectId }) {
    return {
      type: 'project_update',
      title: `Project Update: ${projectTitle || 'Project'}`,
      message: `Your project '${projectTitle || 'Project'}' status changed to ${newStatus || 'updated'}.`,
      relatedIds: { projectId: projectId || null },
    }
  }

  buildPaymentReminderTemplate({ tier, days, amount, clientId }) {
    return {
      type: 'payment_reminder',
      title: 'Subscription Renewal Due',
      message: `Your ${String(tier || 'plan').toUpperCase()} subscription renews in ${days || 0} days. Amount: ${amount || 0}.`,
      relatedIds: { clientId: clientId || null },
    }
  }

  buildCreditLowTemplate({ creditsRemaining, percentage, clientId }) {
    return {
      type: 'credit_low',
      title: 'Low Credit Balance',
      message: `You have ${creditsRemaining || 0} credits left (${percentage || 0}% of monthly allocation).`,
      relatedIds: { clientId: clientId || null },
    }
  }

  buildPerformanceAlertTemplate({ score, actionRequired, creativeId }) {
    return {
      type: 'performance_alert',
      title: 'Performance Review Alert',
      message: `Your CPS score is ${score || 0}. ${actionRequired || ''}`.trim(),
      relatedIds: { creativeId: creativeId || null },
    }
  }

  async getPreferences(userId) {
    if (!userId) return null
    const snapshot = await getDoc(doc(db, 'userNotificationPreferences', userId))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() }
  }

  async upsertPreferences(userId, preferences) {
    if (!userId) throw new Error('userId is required')
    const existing = await this.getPreferences(userId)
    const payload = {
      userId,
      inAppEnabled: preferences?.inAppEnabled !== false,
      emailEnabled: Boolean(preferences?.emailEnabled),
      smsEnabled: Boolean(preferences?.smsEnabled),
      updatedAt: serverTimestamp(),
    }

    await setDoc(doc(db, 'userNotificationPreferences', userId), {
      ...payload,
      createdAt: existing?.createdAt || serverTimestamp(),
    }, { merge: true })
    return userId
  }
}

export default new NotificationService()
