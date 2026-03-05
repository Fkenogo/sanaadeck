import { useEffect, useMemo, useRef, useState } from 'react'
import FileGallery from '@/components/projects/FileGallery'
import fileService, { isFigmaLink, isGoogleDriveLink } from '@/services/fileService'
import { auth } from '@/services/firebase'

const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/postscript',
  'application/vnd.adobe.photoshop',
  'video/mp4',
]

function bytesToLabel(bytes = 0) {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function normalizeAcceptedTypes(acceptedTypes = []) {
  const set = new Set([...(acceptedTypes.length > 0 ? acceptedTypes : DEFAULT_ACCEPTED_TYPES), '.fig', '.figma', '.ai', '.psd'])
  return [...set]
}

function isTypeAccepted(file, acceptedTypes) {
  if (!file) return false
  const fileType = String(file.type || '')
  const lowerName = String(file.name || '').toLowerCase()
  return acceptedTypes.some((entry) => {
    if (entry.startsWith('.')) return lowerName.endsWith(entry.toLowerCase())
    return entry === fileType
  })
}

function FileUploader({
  maxSize = 10 * 1024 * 1024,
  acceptedTypes = [],
  onUpload,
  multiple = false,
  storagePath = '',
  initialFiles = [],
  onChange,
  isAdmin = false,
}) {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progressByName, setProgressByName] = useState({})
  const [files, setFiles] = useState(initialFiles)
  const [externalLink, setExternalLink] = useState('')

  const normalizedAcceptedTypes = useMemo(() => normalizeAcceptedTypes(acceptedTypes), [acceptedTypes])
  const currentUserId = auth.currentUser?.uid || ''

  useEffect(() => {
    setFiles(initialFiles || [])
  }, [initialFiles])

  function emitFiles(nextFiles) {
    setFiles(nextFiles)
    if (onChange) onChange(nextFiles)
  }

  function pushFiles(uploaded) {
    const next = multiple ? [...files, ...uploaded] : uploaded.slice(0, 1)
    emitFiles(next)
    if (onUpload) onUpload(multiple ? uploaded : uploaded[0], next)
  }

  async function handleSelectedFiles(list) {
    const selected = [...(list || [])]
    if (selected.length === 0) return
    if (!storagePath) {
      setError('Storage path is required for file upload.')
      return
    }

    setError('')
    setBusy(true)

    try {
      const uploaded = []
      for (const file of selected) {
        if (!isTypeAccepted(file, normalizedAcceptedTypes)) {
          throw new Error(`Unsupported file type for ${file.name}.`)
        }
        if (Number(file.size || 0) > maxSize) {
          throw new Error(`${file.name} exceeds max size of ${bytesToLabel(maxSize)}. Use a Google Drive/Figma link for larger files.`)
        }

        const result = await fileService.uploadToStorage(
          file,
          storagePath,
          (progress) => setProgressByName((prev) => ({ ...prev, [file.name]: progress })),
        )

        uploaded.push(result)
      }
      pushFiles(uploaded)
    } catch (uploadError) {
      console.error('[FileUploader] Upload failed:', uploadError)
      setError(uploadError?.message || 'Upload failed.')
    } finally {
      setBusy(false)
      setProgressByName({})
    }
  }

  async function handleAddExternalLink() {
    const link = externalLink.trim()
    if (!link) return

    setError('')
    setBusy(true)
    try {
      let record
      if (isGoogleDriveLink(link)) {
        record = await fileService.handleGoogleDriveLink(link, { storagePath })
      } else if (isFigmaLink(link)) {
        record = await fileService.handleFigmaLink(link, { storagePath })
      } else {
        record = {
          url: link,
          source: link.includes('figma.com') ? 'figma' : 'external',
          type: 'external_link',
          fileName: link,
          size: 0,
        }
      }
      pushFiles([record])
      setExternalLink('')
    } catch (linkError) {
      console.error('[FileUploader] External link error:', linkError)
      setError(linkError?.message || 'Invalid external link.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(entry) {
    const nextFiles = files.filter((item) => item.url !== entry.url)
    emitFiles(nextFiles)
    if (entry.source === 'storage') {
      await fileService.deleteFile(entry.url)
    }
  }

  return (
    <div className="space-y-3 rounded border border-border bg-white p-3">
      <div
        className={`rounded border border-dashed p-4 text-sm ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleSelectedFiles(event.dataTransfer.files)
        }}
      >
        <p className="font-medium">Drag and drop files here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max: {bytesToLabel(maxSize)} · Supported: {normalizedAcceptedTypes.join(', ')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Browse files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple={multiple}
            onChange={(event) => handleSelectedFiles(event.target.files)}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          value={externalLink}
          onChange={(event) => setExternalLink(event.target.value)}
          placeholder="Google Drive / Figma / external link"
          className="rounded border border-border px-3 py-2 text-sm"
        />
        <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleAddExternalLink} disabled={busy}>
          Add link
        </button>
      </div>

      {Object.keys(progressByName).length > 0 ? (
        <div className="space-y-1">
          {Object.entries(progressByName).map(([name, progress]) => (
            <div key={name}>
              <p className="text-xs text-muted-foreground">{name} · {progress}%</p>
              <div className="h-1.5 w-full rounded bg-muted">
                <div className="h-1.5 rounded bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <FileGallery
        files={files}
        canDelete
        canDeleteFile={(entry) => isAdmin || (entry.createdBy && entry.createdBy === currentUserId)}
        onDelete={handleDelete}
      />
    </div>
  )
}

export default FileUploader
