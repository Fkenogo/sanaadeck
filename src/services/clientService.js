import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import { TIER_BY_KEY } from '@/utils/constants'

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

class ClientService {
  subscribeToPayments(clientId, onData, onError) {
    const paymentsQuery = query(collection(db, 'payments'), where('clientId', '==', clientId))

    return onSnapshot(
      paymentsQuery,
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

  async updateSubscriptionTier(clientId, tierKey) {
    const tier = TIER_BY_KEY[tierKey]
    if (!tier) throw new Error('Invalid tier selected')

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

  async updateBrandAssets(clientId, brandAssets) {
    const clientRef = doc(db, 'clients', clientId)
    await updateDoc(clientRef, {
      brandAssets,
      updatedAt: serverTimestamp(),
    })
  }
}

export default new ClientService()
