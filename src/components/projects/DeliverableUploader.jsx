import { useMemo, useState } from 'react'
import FileUploader from '@/components/common/FileUploader'

function DeliverableUploader({
  clientId,
  projectId,
  onUploadVersion,
  uploading = false,
  initialTarget = 'revisions',
  allowFinal = false,
}) {
  const [revisionRound, setRevisionRound] = useState(1)
  const [versionNote, setVersionNote] = useState('')
  const [markAsLatest, setMarkAsLatest] = useState(true)
  const [uploadedItems, setUploadedItems] = useState([])
  const [error, setError] = useState('')
  const [targetFolder, setTargetFolder] = useState(initialTarget)

  const storagePath = useMemo(
    () => {
      if (!clientId || !projectId) return ''
      if (targetFolder === 'wip') return `clients/${clientId}/projects/${projectId}/wip`
      if (targetFolder === 'final') return `clients/${clientId}/projects/${projectId}/final`
      return `clients/${clientId}/projects/${projectId}/revisions/round-${revisionRound}`
    },
    [clientId, projectId, targetFolder, revisionRound],
  )

  async function handlePublishVersion() {
    if (!onUploadVersion) return
    if (uploadedItems.length === 0) {
      setError('Upload at least one file/link before publishing version.')
      return
    }
    setError('')
    await onUploadVersion({
      files: uploadedItems,
      note: versionNote.trim(),
      revisionRound: Number(revisionRound || 1),
      isLatest: markAsLatest,
      targetFolder,
    })
    setUploadedItems([])
    setVersionNote('')
    setMarkAsLatest(true)
  }

  return (
    <section className="space-y-3 rounded border border-border p-3">
      <h4 className="text-sm font-semibold">Deliverable uploader</h4>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs">
          Upload target
          <select
            className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
          >
            <option value="wip">wip</option>
            <option value="revisions">revisions</option>
            {allowFinal ? <option value="final">final</option> : null}
          </select>
        </label>
        <label className="text-xs">
          Revision round
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
            value={revisionRound}
            onChange={(e) => setRevisionRound(Number(e.target.value || 1))}
            disabled={targetFolder !== 'revisions'}
          />
        </label>
        <label className="text-xs md:col-span-1">
          Version notes
          <input
            className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            placeholder="What changed in this version?"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={markAsLatest} onChange={(e) => setMarkAsLatest(e.target.checked)} />
        Mark as latest version
      </label>

      <FileUploader
        multiple
        storagePath={storagePath}
        maxSize={10 * 1024 * 1024}
        acceptedTypes={[
          'image/png',
          'image/jpeg',
          'application/pdf',
          'application/postscript',
          'application/vnd.adobe.photoshop',
          'video/mp4',
          '.ai',
          '.psd',
        ]}
        initialFiles={uploadedItems}
        onChange={setUploadedItems}
      />

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        className="rounded border border-border px-3 py-2 text-sm"
        onClick={handlePublishVersion}
        disabled={uploading}
      >
        {uploading ? 'Publishing...' : 'Publish version'}
      </button>
    </section>
  )
}

export default DeliverableUploader
