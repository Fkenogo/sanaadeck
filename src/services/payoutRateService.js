import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

const DEFAULT_PAYOUT_RATES = {
  junior: 7,
  mid: 9,
  senior: 11,
}

class PayoutRateService {
  constructor() {
    this.cache = null
    this.cacheAt = 0
    this.cacheTtlMs = 5 * 60 * 1000
  }

  async getRates({ forceRefresh = false } = {}) {
    const now = Date.now()
    if (!forceRefresh && this.cache && now - this.cacheAt < this.cacheTtlMs) {
      return this.cache
    }

    try {
      const snap = await getDoc(doc(db, 'systemConfig', 'payoutRates'))
      const rawRates = snap.exists() ? snap.data()?.rates : null
      if (rawRates && typeof rawRates === 'object') {
        this.cache = {
          junior: Number(rawRates.junior || DEFAULT_PAYOUT_RATES.junior),
          mid: Number(rawRates.mid || DEFAULT_PAYOUT_RATES.mid),
          senior: Number(rawRates.senior || DEFAULT_PAYOUT_RATES.senior),
        }
        this.cacheAt = now
        return this.cache
      }
    } catch (error) {
      console.error('[PayoutRateService] Failed to load payout rates config:', error)
    }

    this.cache = { ...DEFAULT_PAYOUT_RATES }
    this.cacheAt = now
    return this.cache
  }

  async resolvePayoutPerCredit(creative = {}, options = {}) {
    const rates = await this.getRates(options)
    const explicit = Number(creative?.payoutRate)
    if (Number.isFinite(explicit) && explicit > 0) return explicit

    const level = String(creative?.experienceLevel || creative?.tier || 'mid').toLowerCase()
    return Number(rates[level] || rates.mid)
  }
}

export default new PayoutRateService()
