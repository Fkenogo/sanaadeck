import { useEffect, useMemo, useState } from 'react'
import FileUploader from '@/components/common/FileUploader'
import imageBankService from '@/services/imageBankService'
import { formatDate, normalizeTimestamp } from '@/utils/timestamp'

function monthKey(value) {
  const date = normalizeTimestamp(value)
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function ImageBankContribution({ creativeId }) {
  const [assets, setAssets] = useState([])
  const [title, setTitle] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [tags, setTags] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!creativeId) return () => {}

    const unsubscribe = imageBankService.subscribeCreativeAssets(
      creativeId,
      (items) => {
        setAssets(items)
      },
      () => {
        setError('Failed to load image submissions.')
      },
    )

    return () => unsubscribe()
  }, [creativeId])

  const currentMonthCount = useMemo(() => {
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return assets.filter((entry) => monthKey(entry.createdAt) === key).length
  }, [assets])

  async function handleSubmit() {
    if (!creativeId) return
    if (!rightsConfirmed) {
      setError('You must confirm usage rights before submitting.')
      return
    }
    setUploading(true)
    setError('')

    try {
      await imageBankService.submitAsset({
        creativeId,
        title,
        assetUrl,
        file: uploadedFiles[0] || null,
        tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
        rightsConfirmed: true,
      })
      setTitle('')
      setAssetUrl('')
      setTags('')
      setUploadedFiles([])
      setRightsConfirmed(false)
    } catch (submitError) {
      console.error('[ImageBankContribution] Failed to submit asset:', submitError)
      setError(submitError?.message || 'Unable to submit image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Image Bank Contributions</h3>
      <p className="mt-1 text-sm text-muted-foreground">Upload reusable assets for moderation.</p>
      <p className={`mt-2 text-sm ${currentMonthCount >= 2 ? 'text-green-700' : 'text-amber-700'}`}>
        This month: {currentMonthCount} submission(s)
      </p>
      <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
        Only upload assets you own or have full rights to share. Submitted assets must be royalty-free for use on the SanaaDeck platform.
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Image title"
          className="rounded border border-border px-3 py-2 text-sm"
        />
        <input
          value={assetUrl}
          onChange={(event) => setAssetUrl(event.target.value)}
          placeholder="https://..."
          className="rounded border border-border px-3 py-2 text-sm"
        />
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Tags comma-separated"
          className="rounded border border-border px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-2">
        <FileUploader
          multiple={false}
          storagePath={`image-bank/${creativeId || 'unknown'}`}
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'application/pdf']}
          onChange={setUploadedFiles}
          initialFiles={uploadedFiles}
        />
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(event) => setRightsConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        <span>I confirm I own this asset or have full rights to share it royalty-free on SanaaDeck.</span>
      </label>

      <button className="mt-2 rounded border border-border px-3 py-2 text-sm" onClick={handleSubmit} disabled={uploading || !rightsConfirmed}>
        {uploading ? 'Submitting...' : 'Submit image'}
      </button>

      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}

      <div className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
        {assets.length > 0 ? (
          assets.map((entry) => (
            <div key={entry.id} className="rounded border border-border p-2">
              <p className="font-medium">{entry.title}</p>
              <a className="break-all text-blue-700 underline" href={entry.assetUrl} target="_blank" rel="noreferrer">
                {entry.assetUrl}
              </a>
              <p className="text-xs text-muted-foreground">
                Status: {entry.status || 'pending'} · {formatDate(entry.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No image submissions yet.</p>
        )}
      </div>
    </section>
  )
}

export default ImageBankContribution
