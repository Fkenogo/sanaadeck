import { useMemo, useState } from 'react'

const PAGE_SIZE = 50

function UsersManagementPanel({ users = [], onUpdateRole, onUpdateStatus, onDeleteUser, onPromoteAdmin }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch =
        term.length === 0 ||
        String(user.displayName || '').toLowerCase().includes(term) ||
        String(user.email || '').toLowerCase().includes(term)

      const role = String(user.role || '').toLowerCase()
      const status = String(user.status || 'active').toLowerCase()

      return matchesSearch && (roleFilter === 'all' || role === roleFilter) && (statusFilter === 'all' || status === statusFilter)
    })
  }, [users, search, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const inputCls = "rounded-xl border border-white/10 bg-[#262626] px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-[#C9A227]/40 focus:outline-none"
  const btnCls = "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all"

  return (
    <section className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Users Management</h2>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/email" className={inputCls} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls}>
            <option value="all">All roles</option>
            <option value="client">Client</option>
            <option value="creative">Creative</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.length > 0 ? (
              pagedUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 text-zinc-300">
                  <td className="px-2 py-2">{user.displayName || '-'}</td>
                  <td className="px-2 py-2">{user.email || '-'}</td>
                  <td className="px-2 py-2">{user.role || '-'}</td>
                  <td className="px-2 py-2">{user.status || 'active'}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={user.role || 'client'}
                        onChange={(e) => onUpdateRole(user.id, e.target.value)}
                        className={inputCls}
                      >
                        <option value="client">Client</option>
                        <option value="creative">Creative</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                      <select
                        value={user.status || 'active'}
                        onChange={(e) => onUpdateStatus(user.id, e.target.value)}
                        className={inputCls}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="disabled">Disabled</option>
                      </select>
                      <button className={btnCls} onClick={() => onPromoteAdmin(user.id)}>
                        Assign admin
                      </button>
                      <button className={btnCls} onClick={() => onDeleteUser(user.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-4 text-zinc-500" colSpan={5}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <p>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</p>
        <div className="flex gap-2">
          <button className={btnCls} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page}/{totalPages}</span>
          <button className={btnCls} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default UsersManagementPanel
