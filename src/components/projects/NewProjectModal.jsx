import { useEffect, useMemo, useState } from 'react'
import projectService from '@/services/projectService'
import briefingTemplateService from '@/services/briefingTemplateService'
import designCatalogService from '@/services/designCatalogService'
import FileUploader from '@/components/common/FileUploader'
import { mapTemplateToForm } from '@/utils/templateMapping'

const emptyForm = {
  category: '',
  deliverableId: '',
  title: '',
  description: '',
  projectOverview: '',
  targetAudience: '',
  keyMessage: '',
  deliverables: '',
  specifications: '',
  usagePlatform: '',
  otherNotes: '',
  deadline: '',
  inspirationFiles: [],
  brandAssets: [],
  referenceFiles: [],
  templateId: null,
  templateSnapshot: null,
}

function TemplatePicker({ onSelect, onClose }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    briefingTemplateService.fetchTemplates({ maxItems: 100 }).then(({ items }) => {
      if (!cancelled) setTemplates(items)
    }).catch(() => {
      if (!cancelled) setLoadError('Failed to load briefing templates.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((t) =>
      String(t.title || '').toLowerCase().includes(term) ||
      String(t.category || '').toLowerCase().includes(term) ||
      (Array.isArray(t.tags) && t.tags.some((tag) => String(tag).toLowerCase().includes(term)))
    )
  }, [templates, search])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Choose a briefing template</p>
        <button onClick={onClose} className="text-xs underline text-zinc-400 hover:text-white">
          Cancel
        </button>
      </div>

      <input
        type="search"
        placeholder="Search briefing templates..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-sm text-white"
        autoFocus
      />

      <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10">
        {loading ? (
          <p className="p-4 text-sm text-zinc-400">Loading briefing templates...</p>
        ) : loadError ? (
          <p className="p-4 text-sm text-red-400">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            {templates.length === 0
              ? 'No briefing templates available yet. You can still create a custom brief.'
              : 'No briefing templates match your search.'}
          </p>
        ) : (
          filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="w-full border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/5"
            >
              <p className="text-sm font-medium text-white">{template.title}</p>
              {template.description ? (
                <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{template.description}</p>
              ) : null}
              {Array.isArray(template.tags) && template.tags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {template.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function composeLegacyBrief(value) {
  return [
    `Project Overview: ${String(value.projectOverview || '').trim() || '-'}`,
    `Target Audience: ${String(value.targetAudience || '').trim() || '-'}`,
    `Key Message: ${String(value.keyMessage || '').trim() || '-'}`,
    `Deliverables: ${String(value.deliverables || '').trim() || '-'}`,
    `Specifications: ${String(value.specifications || '').trim() || '-'}`,
    `Usage Platform: ${String(value.usagePlatform || '').trim() || '-'}`,
    `Deadline: ${String(value.deadline || '').trim() || '-'}`,
    `Other Notes: ${String(value.otherNotes || '').trim() || '-'}`,
  ].join('\n')
}

function NewProjectModal({ open, onClose, clientId, createdBy, availableCredits, onProjectCreated, initialValues }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(initialValues || {}) }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [categories, setCategories] = useState([])
  const [deliverables, setDeliverables] = useState([])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setForm({ ...emptyForm, ...(initialValues || {}) })
    setSubmitting(false)
    setError('')
    setPickerOpen(false)
  }, [open, initialValues])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadCatalog(forceRefresh = false) {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const payload = await designCatalogService.getCatalog({ forceRefresh })
        if (cancelled) return
        setCategories(payload.categories || [])
        setDeliverables(payload.deliverables || [])
      } catch (catalogLoadError) {
        console.error('[NewProjectModal] Failed to load design catalog:', catalogLoadError)
        if (!cancelled) {
          setCatalogError(catalogLoadError?.message || 'Unable to load service categories and deliverables.')
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    loadCatalog()
    return () => { cancelled = true }
  }, [open])

  const selectedCategory = useMemo(
    () => categories.find((entry) => entry.id === form.category) || null,
    [categories, form.category],
  )

  const deliverablesForCategory = useMemo(
    () => deliverables.filter((entry) => entry.category === form.category),
    [deliverables, form.category],
  )

  const selectedDeliverable = useMemo(
    () => deliverables.find((entry) => entry.id === form.deliverableId) || null,
    [deliverables, form.deliverableId],
  )

  const estimatedCredits = Number(selectedDeliverable?.typicalCredits || 0)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSelectCategory(nextCategory) {
    setForm((prev) => {
      if (prev.category === nextCategory) return prev
      return {
        ...prev,
        category: nextCategory,
        deliverableId: '',
      }
    })
  }

  function handleSelectDeliverable(deliverableId) {
    const deliverable = deliverables.find((entry) => entry.id === deliverableId)
    setForm((prev) => ({
      ...prev,
      deliverableId,
      deliverables: prev.deliverables || deliverable?.title || '',
      title: prev.title || deliverable?.title || '',
    }))
  }

  function applyTemplate(template) {
    const mapped = mapTemplateToForm(template)
    // Templates are optional and only prefill the brief fields.
    setForm((prev) => ({
      ...prev,
      description: mapped.description || prev.description,
      projectOverview: mapped.projectOverview || prev.projectOverview,
      targetAudience: mapped.targetAudience || prev.targetAudience,
      keyMessage: mapped.keyMessage || prev.keyMessage,
      usagePlatform: mapped.usagePlatform || prev.usagePlatform,
      otherNotes: mapped.otherNotes || prev.otherNotes,
      templateId: mapped.templateId || prev.templateId,
      templateSnapshot: mapped.templateSnapshot || prev.templateSnapshot,
    }))
    setPickerOpen(false)
    setStep(3)
  }

  function nextStep() {
    setError('')

    if (step === 1 && !form.category) {
      setError('Please select a service category.')
      return
    }

    if (step === 2 && !form.deliverableId) {
      setError('Please select a deliverable type.')
      return
    }

    if (step === 3) {
      if (!form.title.trim()) {
        setError('Request title is required.')
        return
      }
      if (!form.projectOverview.trim()) {
        setError('Project overview is required.')
        return
      }
    }

    if (step < 4) {
      setStep((prev) => prev + 1)
    }
  }

  function prevStep() {
    setError('')
    if (step > 1) setStep((prev) => prev - 1)
  }

  async function confirmRequest() {
    if (!clientId) {
      setError('Missing client profile. Please sign in again.')
      return
    }

    if (!selectedDeliverable) {
      setError('Deliverable details could not be resolved. Re-select your deliverable.')
      return
    }

    if (availableCredits < estimatedCredits) {
      setError('Insufficient credits for this request. Buy extra credits or upgrade your subscription.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const inspirationFiles = Array.isArray(form.inspirationFiles) ? form.inspirationFiles : []
      const brandAssets = Array.isArray(form.brandAssets) ? form.brandAssets : []
      const referenceFiles = [...inspirationFiles, ...brandAssets]
      const legacyBrief = composeLegacyBrief(form)

      const result = await projectService.createProjectWithCreditReservation({
        clientId,
        createdBy,
        category: form.category,
        deliverableId: form.deliverableId,
        credits: estimatedCredits,
        title: form.title,
        description: form.description,
        brief: legacyBrief,
        briefModel: {
          projectOverview: form.projectOverview,
          targetAudience: form.targetAudience,
          keyMessage: form.keyMessage,
          deliverables: form.deliverables || selectedDeliverable?.title || '',
          specifications: form.specifications,
          deadline: form.deadline,
          usagePlatform: form.usagePlatform,
          otherNotes: form.otherNotes,
        },
        deadline: form.deadline,
        inspirationFiles,
        brandAssets,
        brandAssetFiles: brandAssets,
        referenceFiles,
        templateId: form.templateId || null,
        templateSnapshot: form.templateSnapshot || null,
      })

      if (onProjectCreated) onProjectCreated(result)
      onClose()
    } catch (submitError) {
      console.error('[NewProjectModal] Failed to create project:', submitError)
      if (submitError?.code === 'functions/resource-exhausted') {
        setError("You've hit your active request limit for your plan. Upgrade to add more.")
      } else {
        setError(submitError?.message || 'Unable to create request. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Project Request</h2>
          <div className="flex items-center gap-3">
            {!pickerOpen && step >= 3 ? (
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
                onClick={() => { setPickerOpen(true); setError('') }}
                disabled={submitting}
              >
                Use a briefing template
              </button>
            ) : null}
            <button className="text-sm text-zinc-400 hover:text-white" onClick={onClose}>Close</button>
          </div>
        </div>

        {!pickerOpen ? <p className="mt-1 text-sm text-zinc-500">Step {step} of 4</p> : null}

        <div className="mt-4">
          {pickerOpen ? (
            <TemplatePicker onSelect={applyTemplate} onClose={() => setPickerOpen(false)} />
          ) : null}

          {!pickerOpen && catalogError ? (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <p>{catalogError}</p>
              <button
                className="mt-2 rounded border border-red-400/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                onClick={async () => {
                  setCatalogLoading(true)
                  setCatalogError('')
                  try {
                    const payload = await designCatalogService.getCatalog({ forceRefresh: true })
                    setCategories(payload.categories || [])
                    setDeliverables(payload.deliverables || [])
                  } catch (nextError) {
                    setCatalogError(nextError?.message || 'Unable to load service categories and deliverables.')
                  } finally {
                    setCatalogLoading(false)
                  }
                }}
              >
                Retry loading catalog
              </button>
            </div>
          ) : null}

          {!pickerOpen && step === 1 ? (
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
              <h3 className="text-sm font-semibold text-white">Select service category</h3>
              {catalogLoading ? (
                <p className="text-sm text-zinc-400">Loading service categories...</p>
              ) : categories.length === 0 ? (
                <p className="text-sm text-zinc-400">No active service categories are configured yet.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {categories.map((entry) => {
                    const selected = form.category === entry.id
                    return (
                      <button
                        key={entry.id}
                        onClick={() => handleSelectCategory(entry.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${selected ? 'border-[#C9A227]/60 bg-[#C9A227]/10 text-white' : 'border-white/10 bg-[#262626] text-zinc-300 hover:border-white/20'}`}
                      >
                        <p className="text-sm font-medium">{entry.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{entry.description}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {!pickerOpen && step === 2 ? (
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
              <h3 className="text-sm font-semibold text-white">Select deliverable type</h3>
              {!selectedCategory ? (
                <p className="text-sm text-zinc-400">Select a category first.</p>
              ) : deliverablesForCategory.length === 0 ? (
                <p className="text-sm text-zinc-400">No deliverables configured for {selectedCategory.title} yet.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {deliverablesForCategory.map((entry) => {
                    const selected = form.deliverableId === entry.id
                    return (
                      <button
                        key={entry.id}
                        onClick={() => handleSelectDeliverable(entry.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${selected ? 'border-[#C9A227]/60 bg-[#C9A227]/10 text-white' : 'border-white/10 bg-[#262626] text-zinc-300 hover:border-white/20'}`}
                      >
                        <p className="text-sm font-medium">{entry.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{entry.description}</p>
                        <p className="mt-2 text-xs text-zinc-300">Credits: <span className="font-semibold text-white">{entry.typicalCredits}</span></p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {!pickerOpen && step === 3 ? (
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#1F1F1F] p-4">
              <h3 className="text-sm font-semibold text-white">Fill design brief</h3>
              <div>
                <label className="mb-1 block text-sm text-zinc-300" htmlFor="request-title">Request title</label>
                <input
                  id="request-title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-300" htmlFor="request-description">Description</label>
                <textarea
                  id="request-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-300" htmlFor="project-overview">Project overview</label>
                <textarea
                  id="project-overview"
                  rows={3}
                  value={form.projectOverview}
                  onChange={(e) => updateField('projectOverview', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  placeholder="Describe what you need created."
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="target-audience">Target audience</label>
                  <input
                    id="target-audience"
                    value={form.targetAudience}
                    onChange={(e) => updateField('targetAudience', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="key-message">Key message</label>
                  <input
                    id="key-message"
                    value={form.keyMessage}
                    onChange={(e) => updateField('keyMessage', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="deliverables">Deliverables</label>
                  <input
                    id="deliverables"
                    value={form.deliverables}
                    onChange={(e) => updateField('deliverables', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                    placeholder={selectedDeliverable?.title || ''}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="usage-platform">Usage platform</label>
                  <input
                    id="usage-platform"
                    value={form.usagePlatform}
                    onChange={(e) => updateField('usagePlatform', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                    placeholder="Instagram, billboard, website, print..."
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-300" htmlFor="specifications">Specifications</label>
                <textarea
                  id="specifications"
                  rows={2}
                  value={form.specifications}
                  onChange={(e) => updateField('specifications', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  placeholder="Size, dimensions, language, quantity, orientation..."
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="deadline">Deadline</label>
                  <input
                    id="deadline"
                    type="datetime-local"
                    value={form.deadline}
                    onChange={(e) => updateField('deadline', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300" htmlFor="other-notes">Other notes</label>
                  <textarea
                    id="other-notes"
                    rows={2}
                    value={form.otherNotes}
                    onChange={(e) => updateField('otherNotes', e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#262626] px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {!pickerOpen && step === 4 ? (
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#1F1F1F] p-4 text-sm text-zinc-300">
              <h3 className="text-sm font-semibold text-white">Upload attachments</h3>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-medium text-white">Inspirations</p>
                <p className="mt-1 text-xs text-zinc-500">Reference images/files/links.</p>
                <div className="mt-2">
                  <FileUploader
                    multiple
                    storagePath={`clients/${clientId}/projects/draft-brief/inspirations`}
                    acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4', '.ai', '.psd', '.gif', '.fig', '.figma']}
                    onChange={(items) => updateField('inspirationFiles', items)}
                    initialFiles={form.inspirationFiles}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-medium text-white">Brand assets</p>
                <p className="mt-1 text-xs text-zinc-500">Logos, colors, fonts, brand guides.</p>
                <div className="mt-2">
                  <FileUploader
                    multiple
                    storagePath={`clients/${clientId}/projects/draft-brief/brand-assets`}
                    acceptedTypes={['image/png', 'image/jpeg', 'application/pdf', '.ai', '.psd', '.fig', '.figma']}
                    onChange={(items) => updateField('brandAssets', items)}
                    initialFiles={form.brandAssets}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-zinc-400">
                <p><span className="font-semibold text-white">Category:</span> {selectedCategory?.title || '-'}</p>
                <p><span className="font-semibold text-white">Deliverable:</span> {selectedDeliverable?.title || '-'}</p>
                <p><span className="font-semibold text-white">Credits:</span> {estimatedCredits}</p>
                <p><span className="font-semibold text-white">Deadline:</span> {form.deadline || 'Not set'}</p>
                <p><span className="font-semibold text-white">Credits available:</span> {availableCredits}</p>
                <p><span className="font-semibold text-white">Inspirations:</span> {Array.isArray(form.inspirationFiles) ? form.inspirationFiles.length : 0}</p>
                <p><span className="font-semibold text-white">Brand assets:</span> {Array.isArray(form.brandAssets) ? form.brandAssets.length : 0}</p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        {!pickerOpen ? (
          <div className="mt-5 flex items-center justify-between">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
              onClick={prevStep}
              disabled={step === 1 || submitting}
            >
              Back
            </button>

            {step < 4 ? (
              <button
                className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E3C96E] disabled:opacity-60"
                onClick={nextStep}
                disabled={submitting || catalogLoading}
              >
                Continue
              </button>
            ) : (
              <button
                className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E3C96E] disabled:opacity-60"
                onClick={confirmRequest}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default NewProjectModal
