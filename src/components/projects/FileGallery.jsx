import { useMemo, useState } from 'react'

function bytesToLabel(bytes = 0) {
  const value = Number(bytes || 0)
  if (value <= 0) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function normalizeFiles(files = []) {
  return files.map((entry, index) => {
    if (typeof entry === 'string') {
      return {
        id: `file-${index}-${entry}`,
        url: entry,
        fileName: entry.split('/').pop() || `file-${index + 1}`,
        size: 0,
        type: '',
        source: 'external',
      }
    }
    return {
      id: entry.id || `file-${index}-${entry.url || entry.fileName || 'unknown'}`,
      url: entry.url || '',
      fileName: entry.fileName || entry.name || `file-${index + 1}`,
      size: Number(entry.size || 0),
      type: entry.type || '',
      source: entry.source || 'storage',
      ...entry,
    }
  }).filter((entry) => entry.url)
}

function isImageType(entry) {
  if (String(entry.type || '').startsWith('image/')) return true
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(String(entry.url || ''))
}

function FileGallery({ files = [], canDelete = false, canDeleteFile, onDelete }) {
  const [lightbox, setLightbox] = useState(null)
  const normalized = useMemo(() => normalizeFiles(files), [files])

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.length > 0 ? normalized.map((entry) => (
          <div key={entry.id} className="rounded border border-border bg-white p-2">
            <button
              className="mb-2 h-28 w-full overflow-hidden rounded border border-border bg-muted text-xs text-muted-foreground"
              onClick={() => (isImageType(entry) ? setLightbox(entry) : window.open(entry.url, '_blank', 'noopener,noreferrer'))}
            >
              {isImageType(entry) ? (
                <img src={entry.url} alt={entry.fileName} className="h-full w-full object-cover" />
              ) : (
                <span className="block px-2 py-10">
                  {entry.source === 'google_drive' ? 'Google Drive file' : entry.source === 'figma' ? 'Figma design' : 'Open file'}
                </span>
              )}
            </button>
            <p className="line-clamp-1 text-sm font-medium">{entry.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {bytesToLabel(entry.size)}
              {entry.source === 'google_drive' ? ' · Drive' : ''}
              {entry.source === 'figma' ? ' · Figma' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={entry.url} target="_blank" rel="noreferrer" className="rounded border border-border px-2 py-1 text-xs">
                {entry.source === 'google_drive' || entry.source === 'figma' ? 'Open' : 'Download'}
              </a>
              {canDelete && (canDeleteFile ? canDeleteFile(entry) : true) ? (
                <button
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() => onDelete?.(entry)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        )}
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{lightbox.fileName}</p>
              <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => setLightbox(null)}>
                Close
              </button>
            </div>
            <img src={lightbox.url} alt={lightbox.fileName} className="max-h-[80vh] w-full rounded border border-border object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FileGallery
