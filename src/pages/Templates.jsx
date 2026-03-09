import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import creditService from '@/services/creditService'
import briefingTemplateService from '@/services/briefingTemplateService'
import NewProjectModal from '@/components/projects/NewProjectModal'
import { mapTemplateToForm } from '@/utils/templateMapping'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'social_post', label: 'Social post' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'branding', label: 'Branding' },
]

function TemplateCard({ template, onSelect }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-4 text-left hover:border-white/10 transition-all w-full shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
    >
      <p className="font-medium text-sm text-white">{template.title}</p>
      <p className="mt-1 text-xs text-zinc-500 capitalize">
        {template.category?.replace(/_/g, ' ') || 'General'}
      </p>
      {Array.isArray(template.tags) && template.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-[#C9A227] font-medium">View details →</p>
    </button>
  )
}

function TemplateDetailModal({ template, onClose, onUse }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#141414] border border-white/10 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{template.title}</h2>
            <p className="mt-1 text-sm text-zinc-500 capitalize">
              {template.category?.replace(/_/g, ' ') || 'General'}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-sm text-zinc-400 hover:text-white">
            Close
          </button>
        </div>

        {Array.isArray(template.tags) && template.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {template.url ? (
          <a
            href={template.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-[#C9A227] hover:text-[#E3C96E]"
          >
            View asset file →
          </a>
        ) : null}

        <div className="mt-6">
          <button
            onClick={() => onUse(template)}
            className="w-full rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E3C96E]"
          >
            Use this briefing template
          </button>
        </div>
      </div>
    </div>
  )
}

function Templates() {
  const { user } = useAuth()
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [projectInitialValues, setProjectInitialValues] = useState(undefined)
  const [creditBalance, setCreditBalance] = useState(null)

  const clientId = user?.uid

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    creditService.getCreditBalance(clientId).then((balance) => {
      if (!cancelled) setCreditBalance(balance)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    briefingTemplateService.fetchTemplates().then(({ items, lastDoc: ld, hasMore: hm }) => {
      if (cancelled) return
      setAllItems(items)
      setLastDoc(ld)
      setHasMore(hm)
    }).catch((fetchError) => {
      if (!cancelled) {
        const suffix = fetchError?.code ? ` (code: ${fetchError.code})` : ''
        setError(`${fetchError?.message || 'Failed to load briefing templates.'}${suffix}`)
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function loadMore() {
    if (!hasMore || loadingMore || !lastDoc) return
    setLoadingMore(true)
    setError('')
    try {
      const { items, lastDoc: ld, hasMore: hm } = await briefingTemplateService.fetchTemplates({ pageParam: lastDoc })
      setAllItems((prev) => [...prev, ...items])
      setLastDoc(ld)
      setHasMore(hm)
    } catch (fetchError) {
      const suffix = fetchError?.code ? ` (code: ${fetchError.code})` : ''
      setError(`${fetchError?.message || 'Failed to load more briefing templates.'}${suffix}`)
    } finally {
      setLoadingMore(false)
    }
  }

  const displayedItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const cat = category.trim()

    return allItems.filter((item) => {
      const matchesCategory = !cat || item.category === cat
      if (!matchesCategory) return false

      if (!term) return true
      return (
        String(item.title || '').toLowerCase().includes(term) ||
        String(item.category || '').toLowerCase().includes(term) ||
        (Array.isArray(item.tags) && item.tags.some((tag) => String(tag).toLowerCase().includes(term)))
      )
    })
  }, [allItems, searchTerm, category])

  function openDetail(template) {
    setSelectedTemplate(template)
    setDetailOpen(true)
  }

  function handleUseTemplate(template) {
    setProjectInitialValues(mapTemplateToForm(template))
    setDetailOpen(false)
    setSelectedTemplate(null)
    setProjectModalOpen(true)
  }

  function handleProjectModalClose() {
    setProjectModalOpen(false)
    setProjectInitialValues(undefined)
  }

  return (
    <main className="min-h-screen bg-[#0F0F0F]">
      <header className="border-b border-white/[0.06] bg-[#111111] px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Briefing Templates</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Browse briefing templates to start a new project brief.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="shrink-0 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </header>

      <div className="px-6 py-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search briefing templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="min-w-48 flex-1 rounded-xl border border-white/10 bg-[#1E1E1E] px-3 py-2 text-sm text-white"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#1E1E1E] px-3 py-2 text-sm text-white"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="px-6 pb-10">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading briefing templates...</p>
        ) : error ? null : displayedItems.length === 0 ? (
          <div className="rounded-2xl bg-[#1A1A1A] border border-white/[0.06] p-10 text-center text-sm text-zinc-500">
            {allItems.length === 0
              ? 'No published briefing templates are available yet.'
              : 'No briefing templates match your search or filter.'}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedItems.map((template) => (
                <TemplateCard key={template.id} template={template} onSelect={openDetail} />
              ))}
            </div>

            {hasMore ? (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {detailOpen && selectedTemplate ? (
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => {
            setDetailOpen(false)
            setSelectedTemplate(null)
          }}
          onUse={handleUseTemplate}
        />
      ) : null}

      <NewProjectModal
        open={projectModalOpen}
        onClose={handleProjectModalClose}
        clientId={clientId}
        createdBy={clientId}
        availableCredits={Number(creditBalance?.totalCredits || 0)}
        initialValues={projectInitialValues}
        onProjectCreated={handleProjectModalClose}
      />
    </main>
  )
}

export default Templates
