import { useMemo, useState } from 'react'
import { ADMIN_ACTION_KEYS, ADMIN_MODULE_KEYS, ADMIN_PERMISSION_PRESETS } from '@/utils/constants'

function permissionsFromPreset(adminType) {
  const preset = ADMIN_PERMISSION_PRESETS[adminType] || ADMIN_PERMISSION_PRESETS.project_admin
  return {
    modules: { ...preset.modules },
    actions: { ...preset.actions },
  }
}

function AdminRoleManagement({
  admins,
  onUpdateAdminType,
  onUpdateAdminPermissions,
  onCreateAdmin,
  onUpdateAdminStatus,
  onDeleteAdmin,
}) {
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    adminType: 'project_admin',
  })
  const [permissions, setPermissions] = useState(() => permissionsFromPreset('project_admin'))
  const [creating, setCreating] = useState(false)
  const [editingAdminId, setEditingAdminId] = useState('')
  const [editingAdminType, setEditingAdminType] = useState('project_admin')
  const [editingPermissions, setEditingPermissions] = useState(() => permissionsFromPreset('project_admin'))
  const [updating, setUpdating] = useState(false)

  const sortedAdmins = useMemo(
    () => [...admins].sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''))),
    [admins],
  )

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'adminType') {
      setPermissions(permissionsFromPreset(value))
    }
  }

  function togglePermission(group, key) {
    setPermissions((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: !prev[group][key],
      },
    }))
  }

  function toggleEditingPermission(group, key) {
    setEditingPermissions((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: !prev[group][key],
      },
    }))
  }

  async function handleCreateAdmin(event) {
    event.preventDefault()
    if (!form.displayName.trim() || !form.email.trim() || !form.password.trim()) return

    setCreating(true)
    try {
      await onCreateAdmin({
        ...form,
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        adminPermissions: permissions,
      })
      setForm({ displayName: '', email: '', password: '', adminType: 'project_admin' })
      setPermissions(permissionsFromPreset('project_admin'))
    } finally {
      setCreating(false)
    }
  }

  function startEditingAdmin(admin) {
    const nextType = admin.adminType || 'project_admin'
    const seed = permissionsFromPreset(nextType)
    const merged = {
      modules: { ...seed.modules, ...(admin.adminPermissions?.modules || {}) },
      actions: { ...seed.actions, ...(admin.adminPermissions?.actions || {}) },
    }

    setEditingAdminId(admin.id)
    setEditingAdminType(nextType)
    setEditingPermissions(merged)
  }

  async function handleSaveAdminPermissions() {
    if (!editingAdminId) return
    setUpdating(true)
    try {
      await onUpdateAdminPermissions(editingAdminId, editingAdminType, editingPermissions)
      setEditingAdminId('')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <section className="space-y-4 rounded border border-border p-4">
      <div>
        <h2 className="text-base font-semibold">Admin Management (Super Admin)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create project/app admins and assign exact module/action permissions.</p>
      </div>

      <form className="rounded border border-border p-3" onSubmit={handleCreateAdmin}>
        <h3 className="text-sm font-semibold">Create Admin</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <input value={form.displayName} onChange={(event) => updateForm('displayName', event.target.value)} placeholder="Display name" className="rounded border border-border px-2 py-1 text-sm" />
          <input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="Email" className="rounded border border-border px-2 py-1 text-sm" />
          <input value={form.password} onChange={(event) => updateForm('password', event.target.value)} placeholder="Temporary password" type="password" className="rounded border border-border px-2 py-1 text-sm" />
          <select value={form.adminType} onChange={(event) => updateForm('adminType', event.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="project_admin">Project Admin</option>
            <option value="app_admin">App Admin</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Modules</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {ADMIN_MODULE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(permissions.modules[key])} onChange={() => togglePermission('modules', key)} />
                  {key}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Actions</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {ADMIN_ACTION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(permissions.actions[key])} onChange={() => togglePermission('actions', key)} />
                  {key}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={creating} className="mt-3 rounded border border-border px-3 py-2 text-sm">
          {creating ? 'Creating...' : 'Create admin'}
        </button>
      </form>

      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Admin Type</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Permissions</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAdmins.length > 0 ? (
              sortedAdmins.map((admin) => (
                <tr key={admin.id} className="border-b border-border/60 align-top">
                  <td className="px-2 py-2">{admin.displayName || admin.email || 'Unknown admin'}</td>
                  <td className="px-2 py-2">{admin.email || '-'}</td>
                  <td className="px-2 py-2">{admin.role}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={admin.adminType || 'project_admin'}
                        onChange={(event) => onUpdateAdminType(admin.id, event.target.value)}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        <option value="project_admin">Project Admin</option>
                        <option value="app_admin">App Admin</option>
                      </select>
                      <button
                        className="rounded border border-border px-2 py-1 text-xs"
                        onClick={() => startEditingAdmin(admin)}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${admin.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {admin.status || 'active'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      className="rounded border border-border px-2 py-1 text-xs"
                      onClick={() => {
                        const nextType = admin.adminType || 'project_admin'
                        const seed = permissionsFromPreset(nextType)
                        const merged = {
                          modules: { ...seed.modules, ...(admin.adminPermissions?.modules || {}) },
                          actions: { ...seed.actions, ...(admin.adminPermissions?.actions || {}) },
                        }
                        onUpdateAdminPermissions(admin.id, nextType, merged)
                      }}
                    >
                      Apply preset
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded border border-border px-2 py-1 text-xs"
                        onClick={() => onUpdateAdminStatus?.(admin.id, admin.status === 'suspended' ? 'active' : 'suspended')}
                      >
                        {admin.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                      {admin.role === 'super_admin' ? null : (
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                          onClick={() => onDeleteAdmin?.(admin.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-3 text-muted-foreground" colSpan={7}>No admin users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingAdminId ? (
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-semibold">Edit Admin Permissions</h3>
          <div className="mt-2 max-w-xs">
            <select
              value={editingAdminType}
              onChange={(event) => {
                const nextType = event.target.value
                setEditingAdminType(nextType)
                setEditingPermissions(permissionsFromPreset(nextType))
              }}
              className="w-full rounded border border-border px-2 py-1 text-sm"
            >
              <option value="project_admin">Project Admin</option>
              <option value="app_admin">App Admin</option>
            </select>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Modules</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {ADMIN_MODULE_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={Boolean(editingPermissions.modules[key])} onChange={() => toggleEditingPermission('modules', key)} />
                    {key}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Actions</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {ADMIN_ACTION_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={Boolean(editingPermissions.actions[key])} onChange={() => toggleEditingPermission('actions', key)} />
                    {key}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={handleSaveAdminPermissions}
              disabled={updating}
            >
              {updating ? 'Saving...' : 'Save permissions'}
            </button>
            <button
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() => setEditingAdminId('')}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default AdminRoleManagement
