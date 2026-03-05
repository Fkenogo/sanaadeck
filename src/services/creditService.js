import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

const CREDIT_PACK_STACK_LIMIT = 20
const DEFAULT_EXTRA_PACK_CREDITS = 10
const EXTRA_PACK_VALIDITY_DAYS = 30

const baseCreditEstimates = {
  social_post: 1,
  carousel: 2,
  flyer: 2,
  poster: 2,
  brochure_4pg: 4,
  presentation_10slides: 5,
  logo_concepts: 6,
  mini_brand_guide: 6,
  packaging: 6,
  motion_30sec: 5,
  social_posts_set_5: 5,
  caption_writing: 1,
  ad_copy_set: 2,
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return 0
}

function isPackValid(pack, now = Timestamp.now()) {
  return toMillis(pack?.expiryDate) > now.toMillis() && Number(pack?.creditsRemaining || 0) > 0
}

function getValidExtraPacks(extraCredits = [], now = Timestamp.now()) {
  return extraCredits
    .filter((pack) => isPackValid(pack, now))
    .sort((a, b) => toMillis(a.purchaseDate) - toMillis(b.purchaseDate))
}

function clonePacks(extraCredits = []) {
  return extraCredits.map((pack) => ({ ...pack }))
}

function ensureClientDocument(clientSnap) {
  if (!clientSnap.exists()) {
    throw new Error('Client not found')
  }

  const data = clientSnap.data()
  if (!data?.subscription) {
    throw new Error('Client subscription data is missing')
  }

  return data
}

function currentBalancesFromClient(data, now = Timestamp.now()) {
  const subscriptionCredits = Number(data?.subscription?.creditsRemaining || 0)
  const validPacks = getValidExtraPacks(data?.extraCredits || [], now)
  const extraCredits = validPacks.reduce((sum, pack) => sum + Number(pack.creditsRemaining || 0), 0)
  const expiryWindowMillis = now.toMillis() + 7 * 24 * 60 * 60 * 1000
  const expiringSoonPacks = validPacks.filter((pack) => {
    const expiry = toMillis(pack.expiryDate)
    return expiry > now.toMillis() && expiry <= expiryWindowMillis
  })
  const expiringSoonCredits = expiringSoonPacks.reduce((sum, pack) => sum + Number(pack.creditsRemaining || 0), 0)

  return {
    subscriptionCredits,
    extraCredits,
    totalCredits: subscriptionCredits + extraCredits,
    expiringSoonCredits,
    expiringSoonPackCount: expiringSoonPacks.length,
  }
}

class CreditService {
  async getCreditBalance(clientId) {
    const clientRef = doc(db, 'clients', clientId)
    const clientSnap = await getDoc(clientRef)
    const data = ensureClientDocument(clientSnap)

    const balances = currentBalancesFromClient(data)

    return {
      ...balances,
      tier: data.subscription.tier,
      creditsPerMonth: Number(data.subscription.creditsPerMonth || 0),
      creditsUsed: Number(data.subscription.creditsUsed || 0),
    }
  }

  estimateCredits(deliverableType, complexity = 'standard') {
    const baseCredits = baseCreditEstimates[deliverableType] ?? 3

    if (complexity === 'advanced') {
      return Math.ceil(baseCredits * 2)
    }

    if (complexity === 'complex') {
      return Math.ceil(baseCredits * 1.5)
    }

    return baseCredits
  }

  async reserveCredits(clientId, projectId, creditsAmount) {
    if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
      throw new Error('creditsAmount must be a positive number')
    }

    const clientRef = doc(db, 'clients', clientId)

    await runTransaction(db, async (transaction) => {
      const clientSnap = await transaction.get(clientRef)
      const data = ensureClientDocument(clientSnap)
      const now = Timestamp.now()

      const balances = currentBalancesFromClient(data, now)
      if (balances.totalCredits < creditsAmount) {
        throw new Error('Insufficient credits')
      }

      const logEntries = []
      let remaining = creditsAmount
      let runningBalance = balances.totalCredits

      const subscriptionCredits = Number(data.subscription.creditsRemaining || 0)
      if (subscriptionCredits > 0) {
        const subDeduction = Math.min(subscriptionCredits, remaining)
        if (subDeduction > 0) {
          logEntries.push({
            type: 'deduction',
            amount: subDeduction,
            source: 'subscription',
            balanceBefore: runningBalance,
            balanceAfter: runningBalance - subDeduction,
            description: `Reserved ${subDeduction} credits from subscription`,
          })

          runningBalance -= subDeduction
          remaining -= subDeduction

          transaction.update(clientRef, {
            'subscription.creditsUsed': Number(data.subscription.creditsUsed || 0) + subDeduction,
            'subscription.creditsRemaining': subscriptionCredits - subDeduction,
            updatedAt: now,
          })
        }
      }

      if (remaining > 0) {
        const updatedExtraCredits = clonePacks(data.extraCredits || [])
        const indexedPacks = updatedExtraCredits
          .map((pack, index) => ({ pack, index }))
          .filter(({ pack }) => isPackValid(pack, now))
          .sort((a, b) => toMillis(a.pack.purchaseDate) - toMillis(b.pack.purchaseDate))

        for (const item of indexedPacks) {
          if (remaining <= 0) break

          const available = Number(item.pack.creditsRemaining || 0)
          if (available <= 0) continue

          const deduction = Math.min(available, remaining)
          const currentPack = updatedExtraCredits[item.index]

          updatedExtraCredits[item.index] = {
            ...currentPack,
            creditsUsed: Number(currentPack.creditsUsed || 0) + deduction,
            creditsRemaining: available - deduction,
          }

          logEntries.push({
            type: 'deduction',
            amount: deduction,
            source: 'extra_pack',
            packId: currentPack.packId,
            balanceBefore: runningBalance,
            balanceAfter: runningBalance - deduction,
            description: `Reserved ${deduction} credits from extra pack`,
          })

          runningBalance -= deduction
          remaining -= deduction
        }

        if (remaining > 0) {
          throw new Error('Insufficient extra credits')
        }

        transaction.update(clientRef, {
          extraCredits: updatedExtraCredits,
          updatedAt: now,
        })
      }

      for (const entry of logEntries) {
        const logRef = doc(collection(db, 'creditTransactions'))
        transaction.set(logRef, {
          clientId,
          projectId: projectId || null,
          type: entry.type,
          source: entry.source || null,
          amount: entry.amount,
          creditsAmount: entry.amount,
          balanceBefore: entry.balanceBefore,
          balanceAfter: entry.balanceAfter,
          packId: entry.packId || null,
          description: entry.description,
          createdAt: now,
          createdBy: 'system',
        })
      }
    })

    return true
  }

  async deductFromExtraPacks(clientId, projectId, creditsAmount) {
    if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
      throw new Error('creditsAmount must be a positive number')
    }

    const clientRef = doc(db, 'clients', clientId)

    await runTransaction(db, async (transaction) => {
      const clientSnap = await transaction.get(clientRef)
      const data = ensureClientDocument(clientSnap)
      const now = Timestamp.now()
      const balances = currentBalancesFromClient(data, now)

      if (balances.extraCredits < creditsAmount) {
        throw new Error('Insufficient extra credits')
      }

      const updatedExtraCredits = clonePacks(data.extraCredits || [])
      const indexedPacks = updatedExtraCredits
        .map((pack, index) => ({ pack, index }))
        .filter(({ pack }) => isPackValid(pack, now))
        .sort((a, b) => toMillis(a.pack.purchaseDate) - toMillis(b.pack.purchaseDate))

      let remaining = creditsAmount
      let runningBalance = balances.totalCredits

      for (const item of indexedPacks) {
        if (remaining <= 0) break

        const available = Number(item.pack.creditsRemaining || 0)
        if (available <= 0) continue

        const deduction = Math.min(available, remaining)
        const currentPack = updatedExtraCredits[item.index]

        updatedExtraCredits[item.index] = {
          ...currentPack,
          creditsUsed: Number(currentPack.creditsUsed || 0) + deduction,
          creditsRemaining: available - deduction,
        }

        const logRef = doc(collection(db, 'creditTransactions'))
        transaction.set(logRef, {
          clientId,
          projectId: projectId || null,
          type: 'deduction',
          source: 'extra_pack',
          amount: deduction,
          creditsAmount: deduction,
          balanceBefore: runningBalance,
          balanceAfter: runningBalance - deduction,
          packId: currentPack.packId || null,
          description: `Reserved ${deduction} credits from extra pack`,
          createdAt: now,
          createdBy: 'system',
        })

        runningBalance -= deduction
        remaining -= deduction
      }

      if (remaining > 0) {
        throw new Error('Insufficient extra credits')
      }

      transaction.update(clientRef, {
        extraCredits: updatedExtraCredits,
        updatedAt: now,
      })
    })

    return true
  }

  async logCreditTransaction(clientId, projectId, details) {
    if (!clientId) {
      throw new Error('clientId is required')
    }

    if (!details?.type || !Number.isFinite(details.amount)) {
      throw new Error('details.type and numeric details.amount are required')
    }

    const now = Timestamp.now()
    const logRef = doc(collection(db, 'creditTransactions'))

    await setDoc(logRef, {
      clientId,
      projectId: projectId || null,
      type: details.type,
      source: details.source || null,
      amount: details.amount,
      creditsAmount: details.amount,
      balanceBefore: Number(details.balanceBefore ?? 0),
      balanceAfter: Number(details.balanceAfter ?? 0),
      packId: details.packId || null,
      expiryDate: details.expiryDate || null,
      description: details.description || `${details.type} ${details.amount} credits`,
      createdAt: now,
      createdBy: details.createdBy || 'system',
    })

    return logRef.id
  }

  async purchaseExtraPack(clientId, paymentId, creditsAmount = DEFAULT_EXTRA_PACK_CREDITS) {
    if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
      throw new Error('creditsAmount must be a positive number')
    }

    const clientRef = doc(db, 'clients', clientId)

    return runTransaction(db, async (transaction) => {
      const clientSnap = await transaction.get(clientRef)
      const data = ensureClientDocument(clientSnap)
      const now = Timestamp.now()
      const balances = currentBalancesFromClient(data, now)

      const currentUnusedExtra = balances.extraCredits
      if (currentUnusedExtra + creditsAmount > CREDIT_PACK_STACK_LIMIT) {
        throw new Error('Cannot exceed 20 unused extra credits')
      }

      const expiryDate = Timestamp.fromMillis(now.toMillis() + EXTRA_PACK_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
      const newPack = {
        packId: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        credits: creditsAmount,
        purchaseDate: now,
        expiryDate,
        creditsUsed: 0,
        creditsRemaining: creditsAmount,
        paymentId: paymentId || null,
      }

      const updatedExtraCredits = [...(data.extraCredits || []), newPack]

      transaction.update(clientRef, {
        extraCredits: updatedExtraCredits,
        updatedAt: now,
      })

      const logRef = doc(collection(db, 'creditTransactions'))
      transaction.set(logRef, {
        clientId,
        projectId: null,
        type: 'extra_pack_purchase',
        source: 'extra_pack',
        amount: creditsAmount,
        creditsAmount,
        balanceBefore: balances.totalCredits,
        balanceAfter: balances.totalCredits + creditsAmount,
        packId: newPack.packId,
        expiryDate,
        description: `Purchased extra pack (${creditsAmount} credits)`,
        createdAt: now,
        createdBy: 'system',
      })

      return newPack
    })
  }

  async allocateMonthlyCredits(clientId) {
    const clientRef = doc(db, 'clients', clientId)

    await runTransaction(db, async (transaction) => {
      const clientSnap = await transaction.get(clientRef)
      const data = ensureClientDocument(clientSnap)
      const now = Timestamp.now()
      const balances = currentBalancesFromClient(data, now)
      const creditsPerMonth = Number(data.subscription.creditsPerMonth || 0)

      transaction.update(clientRef, {
        'subscription.creditsUsed': 0,
        'subscription.creditsRemaining': creditsPerMonth,
        updatedAt: now,
      })

      const nextTotalCredits = creditsPerMonth + balances.extraCredits
      const logRef = doc(collection(db, 'creditTransactions'))
      transaction.set(logRef, {
        clientId,
        projectId: null,
        type: 'allocation',
        source: 'subscription',
        amount: creditsPerMonth,
        creditsAmount: creditsPerMonth,
        balanceBefore: balances.totalCredits,
        balanceAfter: nextTotalCredits,
        packId: null,
        description: `Monthly allocation: ${data.subscription.tier}`,
        createdAt: now,
        createdBy: 'system',
      })
    })

    return true
  }

  async handleExpiredPacks() {
    const now = Timestamp.now()
    const clientsSnap = await getDocs(collection(db, 'clients'))

    let clientsUpdated = 0
    let packsExpired = 0

    for (const clientSnap of clientsSnap.docs) {
      const data = clientSnap.data()
      const extraCredits = Array.isArray(data.extraCredits) ? data.extraCredits : []
      if (extraCredits.length === 0) continue

      const remainingPacks = []
      const expiredPacks = []

      for (const pack of extraCredits) {
        const hasExpired = toMillis(pack.expiryDate) <= now.toMillis()
        if (hasExpired) {
          expiredPacks.push(pack)
        } else {
          remainingPacks.push(pack)
        }
      }

      if (expiredPacks.length === 0) continue

      const balances = currentBalancesFromClient(data, now)
      let runningBalance = balances.totalCredits

      const batch = writeBatch(db)
      batch.update(clientSnap.ref, {
        extraCredits: remainingPacks,
        updatedAt: now,
      })

      for (const pack of expiredPacks) {
        const lostCredits = Number(pack.creditsRemaining || 0)
        packsExpired += 1

        if (lostCredits <= 0) {
          continue
        }

        const logRef = doc(collection(db, 'creditTransactions'))
        batch.set(logRef, {
          clientId: clientSnap.id,
          projectId: null,
          type: 'expiry',
          source: 'extra_pack',
          amount: lostCredits,
          creditsAmount: lostCredits,
          balanceBefore: runningBalance,
          balanceAfter: Math.max(0, runningBalance - lostCredits),
          packId: pack.packId || null,
          expiryDate: pack.expiryDate || null,
          description: `Expired extra pack (${lostCredits} credits lost)`,
          createdAt: now,
          createdBy: 'system',
        })

        runningBalance = Math.max(0, runningBalance - lostCredits)
      }

      await batch.commit()
      clientsUpdated += 1
    }

    return {
      clientsUpdated,
      packsExpired,
    }
  }
}

export default new CreditService()
