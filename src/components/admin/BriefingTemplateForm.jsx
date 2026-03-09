import { useEffect, useMemo, useState } from 'react'

const EMPTY_FORM = {
  title: '',
  category: 'social_post',
  description: '',
  suggestedBrief: '',
  tags: '',
}

function toDraft(template) {
  if (!template) return { ...EMPTY_FORM }
  return {
    title: template.title || '',
    category: template.category || 'social_post',
    description: template.description || '',
    suggestedBrief: template.suggestedBrief || '',
    tags: Array.isArray(template.tags) ? template.tags.join(', ') : '',
  }
}

function normalizePayload(form) {
  return {
    title: form.title.trim(),
    category: form.category,
    description: form.description.trim(),
    suggestedBrief: form.suggestedBrief.trim(),
    tags: form.tags.split(',').map((entry) => entry.trim()).filter(Boolean),
  }
}

function BriefingTemplateForm({ editingTemplate = null, onCreate, onUpdate, onCancelEdit = null }) {
  const [form, setForm] = useState(() => toDraft(editingTemplate))

  useEffect(() => {
    setForm(toDraft(editingTemplate))
  }, [editingTemplate])

  const isEditing = Boolean(editingTemplate?.id)
  const canSave = useMemo(() => form.title.trim().length > 0, [form.title])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!canSave) return
    const payload = normalizePayload(form)
    if (isEditing) {
      onUpdate(editingTemplate.id, payload)
      return
    }
    onCreate(payload)
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <input
        value={form.title}
        onChange={(e) => updateField('title', e.target.value)}
        placeholder="Template title"
        className="rounded border border-border px-2 py-1 text-sm"
      />
      <select value={form.category} onChange={(e) => updateField('category', e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
        <option value="social_post">social_post</option>
        <option value="carousel">carousel</option>
        <option value="presentation">presentation</option>
        <option value="flyer">flyer</option>
        <option value="branding">branding</option>
      </select>
      <textarea
        value={form.description}
        onChange={(e) => updateField('description', e.target.value)}
        placeholder="Description"
        rows={3}
        className="rounded border border-border px-2 py-1 text-sm"
      />
      <textarea
        value={form.suggestedBrief}
        onChange={(e) => updateField('suggestedBrief', e.target.value)}
        placeholder="Suggested brief"
        rows={3}
        className="rounded border border-border px-2 py-1 text-sm"
      />
      <input
        value={form.tags}
        onChange={(e) => updateField('tags', e.target.value)}
        placeholder="Tags comma-separated"
        className="rounded border border-border px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          className="rounded border border-border px-2 py-1 text-sm disabled:opacity-50"
          onClick={handleSave}
          disabled={!canSave}
        >
          {isEditing ? 'Update template' : 'Create template'}
        </button>
        {isEditing ? (
          <button className="rounded border border-border px-2 py-1 text-xs" onClick={onCancelEdit}>Cancel edit</button>
        ) : null}
      </div>
    </div>
  )
}

export default BriefingTemplateForm
