import { useMemo, useState } from 'react'

function toDate(value) {
  if (!value) return 'Unknown'
  const d = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString()
}

function TemplateAssetLibraryPanel({ assets = [], creatives = [], onCreateAsset, onDeleteAsset }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('social_post')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets.filter((asset) => {
      if (!term) return true
      return (
        String(asset.title || '').toLowerCase().includes(term) ||
        String(asset.category || '').toLowerCase().includes(term) ||
        String(asset.tags || []).toLowerCase().includes(term)
      )
    })
  }, [assets, search])

  function handleCreate() {
    if (!title.trim() || !url.trim()) return
    onCreateAsset({
      title: title.trim(),
      category,
      url: url.trim(),
      tags: tags.split(',').map((entry) => entry.trim()).filter(Boolean),
    })
    setTitle('')
    setUrl('')
    setTags('')
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Template Asset Library Management</h2>
      <p className="mt-1 text-sm text-muted-foreground">Founder control for reusable production assets and contribution quality.</p>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" className="rounded border border-border px-2 py-1 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
          <option value="social_post">social_post</option>
          <option value="carousel">carousel</option>
          <option value="presentation">presentation</option>
          <option value="flyer">flyer</option>
          <option value="branding">branding</option>
        </select>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Asset URL" className="rounded border border-border px-2 py-1 text-sm" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags comma-separated" className="rounded border border-border px-2 py-1 text-sm" />
        <button className="rounded border border-border px-2 py-1 text-sm" onClick={handleCreate}>Add asset</button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets" className="mt-3 w-full rounded border border-border px-2 py-1 text-sm" />

      <div className="mt-3 max-h-80 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Tags</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((asset) => (
                <tr key={asset.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <a href={asset.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">{asset.title}</a>
                  </td>
                  <td className="px-2 py-2">{asset.category || '-'}</td>
                  <td className="px-2 py-2">{Array.isArray(asset.tags) ? asset.tags.join(', ') : '-'}</td>
                  <td className="px-2 py-2">{toDate(asset.createdAt)}</td>
                  <td className="px-2 py-2">
                    <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onDeleteAsset(asset.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-2 py-4 text-muted-foreground">No template assets found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded border border-border p-3">
        <p className="text-sm font-semibold">Creative contribution snapshot</p>
        <div className="mt-2 space-y-1 text-sm">
          {creatives.map((creative) => (
            <p key={creative.id}>{creative.displayName || creative.email || 'Unknown creative'}: {Array.isArray(creative.templateContributions) ? creative.templateContributions.length : 0} total contributions</p>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TemplateAssetLibraryPanel
