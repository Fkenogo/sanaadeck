import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { toMillis } from '@/utils/timestamp'

function sortByCreatedAtDesc(items) {
  return items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

class ImageBankService {
  async submitAsset(payload = {}) {
    if (!payload.creativeId) throw new Error('creativeId is required')
    if (!payload.title?.trim()) throw new Error('Asset title is required')
    if (payload.rightsConfirmed !== true) throw new Error('Rights confirmation is required')

    const directUrl = String(payload.assetUrl || '').trim()
    const uploadedUrl = String(payload.file?.url || '').trim()
    const finalUrl = directUrl || uploadedUrl

    if (!finalUrl) throw new Error('Asset URL is required')

    await addDoc(collection(db, 'imageBankAssets'), {
      title: payload.title.trim(),
      creativeId: payload.creativeId,
      assetUrl: finalUrl,
      previewUrl: payload.file?.downloadURL || payload.file?.url || null,
      file: payload.file || null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      status: 'pending',
      rightsConfirmed: true,
      licenseType: 'royalty-free',
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  subscribeCreativeAssets(creativeId, onData, onError) {
    const q = query(collection(db, 'imageBankAssets'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => entry.creativeId === creativeId)
        onData(sortByCreatedAtDesc(items))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeModerationQueue(onData, onError) {
    const q = query(collection(db, 'imageBankAssets'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
        onData(sortByCreatedAtDesc(items))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeApprovedAssets(onData, onError) {
    const q = query(collection(db, 'imageBankAssets'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const approved = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => entry.status === 'approved')
        onData(sortByCreatedAtDesc(approved))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async approveAsset(assetId, reviewedBy = 'admin', moderationChecks = {}) {
    if (!assetId) throw new Error('assetId is required')

    const checks = {
      rightsChecked: Boolean(moderationChecks.rightsChecked),
      appropriatenessChecked: Boolean(moderationChecks.appropriatenessChecked),
      qualityChecked: Boolean(moderationChecks.qualityChecked),
      reusableChecked: Boolean(moderationChecks.reusableChecked),
    }

    await updateDoc(doc(db, 'imageBankAssets', assetId), {
      status: 'approved',
      reviewedBy,
      reviewedAt: serverTimestamp(),
      moderationChecks: checks,
      updatedAt: serverTimestamp(),
    })
  }

  async rejectAsset(assetId, reviewedBy = 'admin', rejectionReason = '', moderationChecks = {}) {
    if (!assetId) throw new Error('assetId is required')

    const checks = {
      rightsChecked: Boolean(moderationChecks.rightsChecked),
      appropriatenessChecked: Boolean(moderationChecks.appropriatenessChecked),
      qualityChecked: Boolean(moderationChecks.qualityChecked),
      reusableChecked: Boolean(moderationChecks.reusableChecked),
    }

    await updateDoc(doc(db, 'imageBankAssets', assetId), {
      status: 'rejected',
      reviewedBy,
      reviewedAt: serverTimestamp(),
      moderationChecks: checks,
      rejectionReason: String(rejectionReason || '').trim() || null,
      updatedAt: serverTimestamp(),
    })
  }
}

export default new ImageBankService()
