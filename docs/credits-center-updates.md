# Credits Center Updates

Last updated: 2026-03-03

## Objective
Replace placeholder credits page with a usable operational center for client and admin roles.

## Implemented

### 1) Functional Credits Center Page
- Replaced placeholder `Credits` page with live Firestore-backed view.
- Client mode now includes:
  - real-time total/subscription/extra balances
  - cycle usage percentage
  - expiring extra packs (next 7 days)
  - buy extra credits entrypoint
  - transaction ledger
- Admin/super admin mode now includes:
  - global credit transaction ledger across clients
  - summary KPI cards for allocations/deductions/purchases

### 2) Ledger Filters
- Added filters for:
  - free text search
  - transaction type
  - source
  - date range (`from`, `to`)
  - client selector (admin mode)

### 3) Pagination
- Added 50-row pagination for the ledger table.
- Added result range indicator and prev/next controls.
- Added server-backed admin pagination (`Load more from server`) to avoid loading the entire global ledger at once.
- Added callable ledger endpoint `getCreditTransactionsPage` with cursor pagination (`cursorMillis`, `nextCursorMillis`).
- Added role-scoped access in callable:
  - client sees only own records
  - admin/super_admin can query all clients or filter by client

### 4) CSV Export
- Added CSV export of currently filtered ledger rows.
- Export includes:
  - date
  - clientId
  - projectId
  - type/source
  - credits amount
  - balance before/after
- description

### 5) Admin Quick Credit Actions
- Added inline admin actions in Credits Center:
  - select client
  - add/deduct amount
  - required reason
  - apply action via `adminService.adjustClientCredits`
- Added quick refund reason template action.
- Added success/error feedback banners for action results.

### 6) Transaction Detail Modal
- Added row-click transaction detail modal in Credits ledger.
- Displays:
  - transaction id/date/type/source
  - client and project references
  - credits and balance delta
  - description
- Added contextual navigation buttons:
  - open projects page (if transaction has `projectId`)
  - open admin dashboard (admin mode with `clientId`)

## Files Updated
- `src/pages/Credits.jsx`
- `src/services/adminService.js`
- `functions/credits/ledger.js`
- `functions/index.js`
- `firestore.indexes.json`

## Validation
- `npm run lint` passed.
- `npm run build` passed.
