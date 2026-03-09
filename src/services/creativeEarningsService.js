import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import payoutRateService from './payoutRateService'
import { toMillis } from '@/utils/timestamp'

const VALID_STATUSES = new Set(['earned', 'pending', 'queued', 'paid', 'failed'])

function sortByCreatedAt(records = []) {
  return [...records].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

function summarize(records = []) {
  return records.reduce((acc, entry) => {
    const total = Number(entry.totalPayout || 0)
    acc.totalEarned += total
    if (entry.status === 'paid') acc.paidOut += total
    if (['earned', 'pending', 'queued'].includes(entry.status)) acc.pending += total
    return acc
  }, { totalEarned: 0, pending: 0, paidOut: 0 })
}

class CreativeEarningsService {
  async upsertProjectEarning({
    creativeId,
    projectId,
    clientId = null,
    deliverableType = null,
    tier = null,
    creditsDelivered,
    creativeProfile = null,
    payoutPerCredit = null,
    status = 'earned',
    projectTitle = '',
  }) {
    if (!creativeId) throw new Error('creativeId is required')
    if (!projectId) throw new Error('projectId is required')

    const safeStatus = VALID_STATUSES.has(status) ? status : 'earned'
    const deliveredCredits = Number(creditsDelivered || 0)
    if (!Number.isFinite(deliveredCredits) || deliveredCredits < 0) {
      throw new Error('creditsDelivered must be a non-negative number')
    }

    let profile = creativeProfile
    if (!profile) {
      const creativeSnap = await getDoc(doc(db, 'creatives', creativeId))
      profile = creativeSnap.exists() ? creativeSnap.data() : {}
    }

    const rate = Number.isFinite(Number(payoutPerCredit)) && Number(payoutPerCredit) > 0
      ? Number(payoutPerCredit)
      : await payoutRateService.resolvePayoutPerCredit(profile || {})

    const totalPayout = Number((deliveredCredits * rate).toFixed(2))
    const recordId = `${projectId}_${creativeId}`
    const recordRef = doc(db, 'creativeEarnings', recordId)

    await setDoc(recordRef, {
      creativeId,
      projectId,
      clientId: clientId ? String(clientId).trim() : null,
      deliverableType: deliverableType ? String(deliverableType).trim() : null,
      tier: tier ? String(tier).trim().toLowerCase() : null,
      projectTitle: String(projectTitle || '').trim() || null,
      creditsDelivered: deliveredCredits,
      payoutPerCredit: rate,
      totalPayout,
      status: safeStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })

    return {
      id: recordId,
      creativeId,
      projectId,
      clientId: clientId ? String(clientId).trim() : null,
      deliverableType: deliverableType ? String(deliverableType).trim() : null,
      tier: tier ? String(tier).trim().toLowerCase() : null,
      creditsDelivered: deliveredCredits,
      payoutPerCredit: rate,
      totalPayout,
      status: safeStatus,
    }
  }

  async updateEarningStatus(recordId, status) {
    if (!recordId) throw new Error('recordId is required')
    if (!VALID_STATUSES.has(status)) throw new Error('Invalid payout status')

    await updateDoc(doc(db, 'creativeEarnings', recordId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  subscribeToCreativeEarnings(creativeId, onData, onError) {
    if (!creativeId) return () => {}

    const q = query(collection(db, 'creativeEarnings'), where('creativeId', '==', creativeId))
    return onSnapshot(
      q,
      (snapshot) => {
        const records = sortByCreatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
        onData({ records, summary: summarize(records) })
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeToAllEarnings(onData, onError) {
    const q = query(collection(db, 'creativeEarnings'), orderBy('updatedAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
        onData(records)
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async fetchCreativeEarnings(creativeId) {
    const snapshot = await getDocs(query(collection(db, 'creativeEarnings'), where('creativeId', '==', creativeId)))
    const records = sortByCreatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
    return { records, summary: summarize(records) }
  }
}

export default new CreativeEarningsService()
