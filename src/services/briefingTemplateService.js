import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore'
import { db } from './firebase'

const PAGE_SIZE = 12

function isTemplatePublished(template) {
  if (!template || typeof template !== 'object') return false
  if (template.status === 'active') return true
  if (template.published === true) return true
  return false
}

function mapQueryError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'You do not have permission to load briefing templates.'
  }
  if (code.includes('failed-precondition') || message.toLowerCase().includes('index')) {
    return 'Briefing templates query needs a Firestore index or matching schema configuration.'
  }
  return 'Unable to load briefing templates right now.'
}

class BriefingTemplateService {
  async fetchTemplates({ pageParam = null, maxItems = PAGE_SIZE, onlyActive = true } = {}) {
    try {
      const constraints = [orderBy('createdAt', 'desc'), limit(maxItems)]
      if (pageParam) {
        constraints.push(startAfter(pageParam))
      }

      const q = query(collection(db, 'briefingTemplates'), ...constraints)
      const snapshot = await getDocs(q)

      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      const items = onlyActive ? docs.filter(isTemplatePublished) : docs
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null
      const hasMore = snapshot.docs.length === maxItems

      return { items, lastDoc, hasMore }
    } catch (error) {
      const wrapped = new Error(mapQueryError(error))
      wrapped.cause = error
      wrapped.code = error?.code || null
      throw wrapped
    }
  }
}

export default new BriefingTemplateService()
