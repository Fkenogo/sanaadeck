import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

function mapCatalogError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'You do not have permission to load service categories.'
  }
  if (code.includes('unavailable') || message.includes('network')) {
    return 'Service catalog is temporarily unavailable. Check your connection and try again.'
  }
  if (code.includes('not-found') || message.includes('not found')) {
    return 'Design catalog service is not available yet. Contact support to deploy catalog functions.'
  }
  if (code.includes('failed-precondition') || message.includes('index')) {
    return 'Design catalog data is not configured correctly. Please seed service categories and deliverables.'
  }
  return 'Unable to load service categories and deliverables right now.'
}

class DesignCatalogService {
  constructor() {
    this.getCatalogCallable = httpsCallable(functions, 'getDesignCatalog')
    this.cache = null
    this.cacheAt = 0
    this.cacheTtlMs = 60 * 1000
  }

  async getCatalog({ forceRefresh = false } = {}) {
    const now = Date.now()
    if (!forceRefresh && this.cache && now - this.cacheAt < this.cacheTtlMs) {
      return this.cache
    }

    try {
      const response = await this.getCatalogCallable({})
      const payload = {
        categories: Array.isArray(response?.data?.categories) ? response.data.categories : [],
        deliverables: Array.isArray(response?.data?.deliverables) ? response.data.deliverables : [],
      }

      this.cache = payload
      this.cacheAt = now
      return payload
    } catch (error) {
      const wrapped = new Error(mapCatalogError(error))
      wrapped.code = error?.code || null
      wrapped.cause = error
      throw wrapped
    }
  }
}

export default new DesignCatalogService()
