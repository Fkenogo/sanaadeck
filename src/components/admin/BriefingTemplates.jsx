import { useMemo, useState } from 'react'
import { formatDate } from '@/utils/timestamp'
import BriefingTemplateForm from '@/components/admin/BriefingTemplateForm'

function BriefingTemplates({ templates = [], onCreateTemplate, onUpdateTemplate, onDeleteTemplate, onTogglePublished }) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((template) => {
      return (
        String(template.title || '').toLowerCase().includes(term) ||
        String(template.category || '').toLowerCase().includes(term) ||
        String(template.description || '').toLowerCase().includes(term) ||
        String(template.suggestedBrief || '').toLowerCase().includes(term)
      )
    })
  }, [templates, search])

  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === editingId) || null,
    [templates, editingId],
  )

  function stopEditing() {
    setEditingId('')
  }

  function handleCreate(payload) {
    onCreateTemplate(payload)
  }

  function handleUpdate(templateId, payload) {
    onUpdateTemplate(templateId, payload)
    stopEditing()
  }

  function handleEdit(template) {
    setEditingId(template.id)
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Briefing Templates</h2>
      <p className="mt-1 text-sm text-muted-foreground">Founder control for reusable client briefing starters.</p>

      <BriefingTemplateForm
        editingTemplate={editingTemplate}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onCancelEdit={stopEditing}
      />

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates" className="mt-3 w-full rounded border border-border px-2 py-1 text-sm" />

      <div className="mt-3 max-h-80 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Usage</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((template) => (
                <tr key={template.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{template.title}</td>
                  <td className="px-2 py-2">{template.category || '-'}</td>
                  <td className="px-2 py-2">{template.status === 'inactive' ? 'Unpublished' : 'Published'}</td>
                  <td className="px-2 py-2">{Number(template.usageCount || 0)}</td>
                  <td className="px-2 py-2">{formatDate(template.createdAt)}</td>
                  <td className="px-2 py-2">
                    <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => handleEdit(template)}>Edit</button>{' '}
                    <button
                      className="rounded border border-border px-2 py-1 text-xs"
                      onClick={() => onTogglePublished(template.id, template.status !== 'inactive')}
                    >
                      {template.status === 'inactive' ? 'Publish' : 'Unpublish'}
                    </button>{' '}
                    <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onDeleteTemplate(template.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-2 py-4 text-muted-foreground">No briefing templates found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default BriefingTemplates
