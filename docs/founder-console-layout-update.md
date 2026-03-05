# Founder Console Layout & Operations Alignment

Last updated: 2026-03-02

## Why this refactor
The original Super Admin dashboard rendered many modules in one long page, creating cognitive overload and slowing founder-level decision making.

Based on:
- `founder checklist.pdf`
- `founder ops manual.pdf`

we aligned to a control-tower style console: one active module at a time, with role-safe operational controls.

## UI architecture change

### Before
- Long single-page dashboard with all analytics/tables visible together.

### After
- Left navigation + active module workspace.
- Only selected module renders in main content area.
- Workspace modal remains global for project interventions.

## Founder Console modules
1. Overview
2. Users
3. Clients
4. Creatives
5. Projects
6. Credit Transactions
7. Payments
8. Notifications
9. Template Library
10. Reports
11. Admins

## Management capabilities mapped

### Users management
- Search/filter users
- Update role (client/creative/admin/super_admin)
- Update status (active/suspended/disabled)
- Assign admin role type
- Delete user record (Firestore metadata)

### Clients management
- Search/sort/filter by tier/status/country
- Tier changes
- Pause/cancel status updates
- Credit adjustments
- Bulk CSV export and bulk notifications

### Creatives management
- Search/filter by specialty/tier/performance
- Warn creative
- Suspend/unsuspend creative
- View workspace via assigned project

### Projects management
- Status charts (pie + bar)
- Bottlenecks, nearing deadline, overdue
- QC queue actions
- Manual assignment
- Credit estimate adjustments
- Open workspace for intervention

### Credit transactions management
- Search/filter transaction records
- Paginated operational audit table

### Payments/subscriptions management
- Payment monitoring cards
- Payment status updates
- Subscription status updates

### Notifications management
- Compose/send notification to any user
- Search and delete notifications

### Template asset library management
- CRUD for `templateAssetLibrary`
- Contribution snapshot by creative

### Admins management
- Role scope assignment through existing admin role management
- Create admin accounts directly from founder console
- Assign admin type (`project_admin` / `app_admin`)
- Apply granular module/action permissions per admin
- Suspend/reactivate admin users
- Delete admin user records (super-admin controlled)

### Client dashboard cleanup
- Moved from stacked long-page sections to module-based client console:
  - Overview
  - Projects
  - Workspace
  - Quick actions
- `New request` remains globally accessible in header.
- Project cards continue to drive workspace/approval/revision actions.

### Creative dashboard cleanup
- Moved to module-based creative console:
  - Overview
  - Projects
  - Workspace
  - Template contributions
  - Notifications
- Preserved card/table project switch and workspace handoff.

## Founder operating manual alignment implemented
- Revenue and margin visibility centralized in Overview.
- Production stability and quality controls anchored in Projects + Performance Alerts.
- Scope discipline support through explicit status/action controls.
- Template library governance elevated to top-level module.

## Files introduced for this refactor
- `src/components/admin/UsersManagementPanel.jsx`
- `src/components/admin/CreditTransactionsManagementPanel.jsx`
- `src/components/admin/PaymentsSubscriptionsManagementPanel.jsx`
- `src/components/admin/NotificationsManagementPanel.jsx`
- `src/components/admin/TemplateAssetLibraryPanel.jsx`

## Files changed
- `src/components/dashboard/AdminDashboard.jsx`
- `src/components/admin/AdminRoleManagement.jsx`
- `src/components/dashboard/ClientDashboard.jsx`
- `src/components/dashboard/CreativeDashboard.jsx`
- `src/services/adminService.js`
- `firestore.rules`

## Security updates
- Added `templateAssetLibrary` Firestore rules.
- Admin-only create/update, super-admin delete.

## Validation
- `npm run lint` passed.
- `npm run build` passed.

## Known constraints / next improvements
1. User deletion currently removes Firestore user metadata only, not Firebase Auth account.
2. Add confirmation dialogs for destructive actions beyond current prompts.
3. Add lazy-loading for heavy chart modules to reduce initial bundle size.
