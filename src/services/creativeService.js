import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

class CreativeService {
  async updateAvailability(creativeId, availability) {
    if (!creativeId) throw new Error('creativeId is required')
    if (!['available', 'busy', 'unavailable'].includes(availability)) {
      throw new Error('Invalid availability status')
    }

    await updateDoc(doc(db, 'creatives', creativeId), {
      availability,
      updatedAt: serverTimestamp(),
    })
  }

  async addTemplateContribution(creativeId, payload) {
    if (!creativeId) throw new Error('creativeId is required')
    if (!payload?.title || !payload?.link) throw new Error('Template title and link are required')

    await updateDoc(doc(db, 'creatives', creativeId), {
      templateContributions: arrayUnion({
        title: payload.title,
        link: payload.link,
        file: payload.file || null,
        createdAt: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    })
  }
}

export default new CreativeService()
