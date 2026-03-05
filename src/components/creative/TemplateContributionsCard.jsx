import { useMemo, useState } from 'react'
import FileUploader from '@/components/common/FileUploader'

function monthKey(value) {
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function TemplateContributionsCard({ contributions = [], onUploadTemplate, uploading, creativeId }) {
  const [templateLink, setTemplateLink] = useState('')
  const [templateTitle, setTemplateTitle] = useState('')
  const [uploadedTemplateFiles, setUploadedTemplateFiles] = useState([])

  const currentMonthCount = useMemo(() => {
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return contributions.filter((entry) => monthKey(entry.createdAt) === key).length
  }, [contributions])

  async function handleUpload() {
    const directLink = templateLink.trim()
    const uploadedLink = uploadedTemplateFiles[0]?.url || ''
    const finalLink = directLink || uploadedLink
    if (!finalLink || !templateTitle.trim()) return
    await onUploadTemplate({
      title: templateTitle.trim(),
      link: finalLink,
      file: uploadedTemplateFiles[0] || null,
    })
    setTemplateTitle('')
    setTemplateLink('')
    setUploadedTemplateFiles([])
  }

  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Template Contributions</h3>
      <p className="mt-1 text-sm text-muted-foreground">Monthly target: 2 templates</p>
      <p className={`mt-2 text-sm ${currentMonthCount >= 2 ? 'text-green-700' : 'text-amber-700'}`}>
        This month: {currentMonthCount} / 2
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          value={templateTitle}
          onChange={(event) => setTemplateTitle(event.target.value)}
          placeholder="Template title"
          className="rounded border border-border px-3 py-2 text-sm"
        />
        <input
          value={templateLink}
          onChange={(event) => setTemplateLink(event.target.value)}
          placeholder="https://drive.google.com/..."
          className="rounded border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-2">
        <FileUploader
          multiple={false}
          storagePath={`templates/${creativeId || 'unknown'}`}
          acceptedTypes={['image/png', 'image/jpeg', 'application/pdf', '.psd', '.ai']}
          onChange={setUploadedTemplateFiles}
          initialFiles={uploadedTemplateFiles}
        />
      </div>
      <button className="mt-2 rounded border border-border px-3 py-2 text-sm" onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload template'}
      </button>

      <div className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
        {contributions.length > 0 ? (
          contributions.map((entry, index) => (
            <div key={`${entry.link}-${index}`} className="rounded border border-border p-2">
              <p className="font-medium">{entry.title}</p>
              <a className="break-all text-blue-700 underline" href={entry.link} target="_blank" rel="noreferrer">
                {entry.link}
              </a>
              <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No template contributions yet.</p>
        )}
      </div>
    </section>
  )
}

export default TemplateContributionsCard
