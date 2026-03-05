import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage'
import { auth, db, storage } from './firebase'

const GOOGLE_DRIVE_PATTERNS = [
  /https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
  /https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
  /https?:\/\/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/i,
]
const FIGMA_PATTERNS = [
  /https?:\/\/(?:www\.)?figma\.com\/file\/[a-zA-Z0-9]+/i,
  /https?:\/\/(?:www\.)?figma\.com\/design\/[a-zA-Z0-9]+/i,
  /https?:\/\/(?:www\.)?figma\.com\/proto\/[a-zA-Z0-9]+/i,
]

function sanitizeFileName(name = '') {
  return String(name)
    .trim()
    .replace(/[^\w.-]/g, '_')
}

function extractGoogleDriveFileId(link = '') {
  const normalized = String(link).trim()
  for (const pattern of GOOGLE_DRIVE_PATTERNS) {
    const match = normalized.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

function isFigmaUrl(link = '') {
  const normalized = String(link).trim()
  return FIGMA_PATTERNS.some((pattern) => pattern.test(normalized))
}

class FileService {
  async uploadToStorage(file, path, onProgress) {
    if (!file) throw new Error('File is required')
    if (!path) throw new Error('Storage path is required')

    const fileName = sanitizeFileName(file.name || 'upload.bin')
    const objectPath = `${String(path).replace(/\/+$/, '')}/${Date.now()}_${fileName}`
    const storageRef = ref(storage, objectPath)
    const createdBy = auth.currentUser?.uid || ''
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        originalName: file.name || fileName,
        createdBy,
      },
    })

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (!onProgress) return
          const progress = snapshot.totalBytes > 0
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0
          onProgress(progress, snapshot)
        },
        reject,
        resolve,
      )
    })

    const url = await getDownloadURL(storageRef)
    return {
      url,
      storagePath: objectPath,
      fileName,
      size: Number(file.size || 0),
      type: file.type || 'application/octet-stream',
      source: 'storage',
      createdBy,
      uploadedAt: new Date().toISOString(),
    }
  }

  async handleGoogleDriveLink(link, context = {}) {
    const normalized = String(link || '').trim()
    const fileId = extractGoogleDriveFileId(normalized)
    if (!fileId) throw new Error('Invalid Google Drive link')

    const canonicalUrl = `https://drive.google.com/file/d/${fileId}/view`
    const createdBy = auth.currentUser?.uid || null
    await addDoc(collection(db, 'fileLinks'), {
      url: canonicalUrl,
      provider: 'google_drive',
      fileId,
      createdBy,
      context: context || {},
      createdAt: serverTimestamp(),
    })

    return {
      url: canonicalUrl,
      type: 'google_drive',
      provider: 'google_drive',
      fileId,
      source: 'google_drive',
      createdBy,
      uploadedAt: new Date().toISOString(),
    }
  }

  async handleFigmaLink(link, context = {}) {
    const normalized = String(link || '').trim()
    if (!isFigmaUrl(normalized)) {
      throw new Error('Invalid Figma link')
    }

    const createdBy = auth.currentUser?.uid || null
    await addDoc(collection(db, 'fileLinks'), {
      url: normalized,
      provider: 'figma',
      createdBy,
      context: context || {},
      createdAt: serverTimestamp(),
    })

    return {
      url: normalized,
      type: 'figma',
      provider: 'figma',
      source: 'figma',
      fileName: 'Figma design',
      size: 0,
      createdBy,
      uploadedAt: new Date().toISOString(),
    }
  }

  async deleteFile(fileUrl) {
    if (!fileUrl) return false
    try {
      const fileRef = ref(storage, fileUrl)
      await deleteObject(fileRef)
      return true
    } catch (error) {
      console.error('[fileService] Failed to delete file:', error)
      return false
    }
  }

  async getFileMetadata(fileUrl) {
    if (!fileUrl) throw new Error('fileUrl is required')
    const fileRef = ref(storage, fileUrl)
    const metadata = await getMetadata(fileRef)
    return {
      name: metadata.name || '',
      fullPath: metadata.fullPath || '',
      size: Number(metadata.size || 0),
      type: metadata.contentType || '',
      uploadedAt: metadata.timeCreated || '',
      updatedAt: metadata.updated || '',
      metadata: metadata.customMetadata || {},
    }
  }

  async relocateStorageFile(fileRecord, targetPath) {
    if (!fileRecord?.url || !targetPath) return fileRecord
    if (fileRecord.source !== 'storage') return fileRecord

    const response = await fetch(fileRecord.url)
    if (!response.ok) {
      throw new Error('Unable to fetch original file for relocation')
    }

    const blob = await response.blob()
    const fileName = sanitizeFileName(fileRecord.fileName || 'relocated.bin')
    const nextStoragePath = `${String(targetPath).replace(/\/+$/, '')}/${Date.now()}_${fileName}`
    const targetRef = ref(storage, nextStoragePath)

    await uploadBytes(targetRef, blob, {
      contentType: fileRecord.type || blob.type || 'application/octet-stream',
      customMetadata: {
        originalName: fileRecord.fileName || fileName,
        relocatedFrom: fileRecord.storagePath || '',
        createdBy: fileRecord.createdBy || auth.currentUser?.uid || '',
      },
    })

    const nextUrl = await getDownloadURL(targetRef)

    if (fileRecord.storagePath) {
      await deleteObject(ref(storage, fileRecord.storagePath)).catch(() => {})
    } else {
      await this.deleteFile(fileRecord.url)
    }

    return {
      ...fileRecord,
      url: nextUrl,
      storagePath: nextStoragePath,
      fileName,
      source: 'storage',
      createdBy: fileRecord.createdBy || auth.currentUser?.uid || '',
      relocatedAt: new Date().toISOString(),
    }
  }
}

export function isGoogleDriveLink(link = '') {
  return Boolean(extractGoogleDriveFileId(link))
}

export function isFigmaLink(link = '') {
  return isFigmaUrl(link)
}

export default new FileService()
