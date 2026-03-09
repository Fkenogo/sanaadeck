import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

const PROFILE_ALLOWED_FIELDS = [
  'displayName',
  'bio',
  'specialty',
  'skills',
  'primarySkills',
  'secondarySkills',
  'experienceLevel',
  'availabilityStatus',
  'maxActiveProjects',
  'currentLoadScore',
  'qualityRating',
  'industries',
  'tools',
  'country',
]

function sanitizeSkillRatings(skillRatings = {}) {
  if (!skillRatings || typeof skillRatings !== 'object' || Array.isArray(skillRatings)) return {}
  const normalized = {}
  Object.entries(skillRatings).forEach(([rawTag, rawRating]) => {
    const tag = String(rawTag || '').trim().toLowerCase()
    const rating = Number(rawRating)
    if (!tag) return
    if (!Number.isFinite(rating)) return
    normalized[tag] = Math.max(0, Math.min(5, Number(rating.toFixed(2))))
  })
  return normalized
}

class CreativeService {
  async updateProfile(creativeId, data) {
    if (!creativeId) throw new Error('creativeId is required')

    const update = {}
    for (const key of PROFILE_ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        update[key] = data[key]
      }
    }

    if (Object.keys(update).length === 0) return

    await updateDoc(doc(db, 'creatives', creativeId), {
      ...update,
      updatedAt: serverTimestamp(),
    })
  }

  async setPortfolioItems(creativeId, items) {
    if (!creativeId) throw new Error('creativeId is required')
    if (!Array.isArray(items)) throw new Error('items must be an array')

    await updateDoc(doc(db, 'creatives', creativeId), {
      portfolioItems: items,
      updatedAt: serverTimestamp(),
    })
  }

  async updateAvailability(creativeId, availability) {
    if (!creativeId) throw new Error('creativeId is required')
    if (!['available', 'busy', 'unavailable'].includes(availability)) {
      throw new Error('Invalid availability status')
    }

    await updateDoc(doc(db, 'creatives', creativeId), {
      availability,
      availabilityStatus: availability,
      updatedAt: serverTimestamp(),
    })
  }

  async setSkillRatings(creativeId, skillRatings) {
    if (!creativeId) throw new Error('creativeId is required')
    const normalizedRatings = sanitizeSkillRatings(skillRatings)

    await updateDoc(doc(db, 'creatives', creativeId), {
      skillRatings: normalizedRatings,
      updatedAt: serverTimestamp(),
    })
  }

}

export default new CreativeService()
