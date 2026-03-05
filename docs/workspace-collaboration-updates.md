# SanaaDeck Workspace Collaboration Updates

Last updated: 2026-03-02

## Goal
Implement a shared, role-aware project workspace without overhauling existing dashboard-specific business features (credits, tiers, payouts, KPI views).

## Scope Implemented

### 1) Shared Workspace Access Across Dashboards
- Client dashboard now opens collaborative project workspace instead of read-only details modal.
- Creative dashboard keeps workspace usage and role-specific production actions.
- Admin dashboard (project/app/super admin modes) can open workspace directly from QC queue.

### 2) Clear Per-Project Role Foundation
- Added per-project membership records at:
  - `projects/{projectId}/members/{uid}`
- Current role values used in membership writes:
  - `client_owner`
  - `creative_lead`
  - `project_admin`
  - `app_admin`
  - `super_admin`

### 3) Workspace Collaboration Features (Shared)
- Threaded comments with replies.
- Comment status markers:
  - `needs_attention`
  - `resolved`
  - `approved`
- Mentions parsing (`@name`) in comments.
- Activity feed timeline.
- Design/file preview links and version comparison selectors.
- Role-aware action visibility in workspace:
  - Creative: start, notes/time, upload versions, submit QC.
  - Project/admin: QC approve for client review, send revision.
  - Client: approve project, request revision.

### 3.1) Workspace UX Redesign (Clean + Modern)
- Reworked `ProjectWorkspace` from single long column layout into tabbed workflow:
  - `Overview`
  - `Production`
  - `Review & comments`
  - `Activity`
- Added large preview stage in `Overview` for better design/file review.
- Added fullscreen preview popup modal for assets/versions.
- Consolidated asset list into a unified `Assets and versions` picker to reduce scanning time.
- Added comment status filtering in review tab for triage (`all`, `needs_attention`, `resolved`, `approved`).
- Kept role-based actions and existing business flows intact (QC, client approval, revisions, time tracking, deliverable versioning).
- Added keyboard shortcuts for speed:
  - `1` Overview
  - `2` Production
  - `3` Review & comments
  - `4` Activity
  - `Esc` close fullscreen preview, then workspace
- Added sticky bottom action bar for persistent navigation and quick production actions (`Save`, `Submit QC`, tab jump buttons).
- Added pinned comment anchor rail in Review tab with:
  - status counters (`needs_attention`, `resolved`, `approved`)
  - compact thread previews
  - one-click jump-to-thread navigation

### 3.2) Production Workflow Fixes
- `Save notes` is now a dedicated save action and no longer coupled to submit-QC flow.
- Added progressive, attributed note timeline (`workspaceNotesLog`) with:
  - note content
  - author id/role
  - timestamp
- Added clearer submit-QC guard message when status is not eligible.

### 3.3) Client Rating After Delivery
- Added client rating flow in workspace after project status is `approved`.
- Clients can submit/update:
  - rating score (1-5)
  - optional feedback
- Rating is stored on project (`clientRating`, `ratingsHistory`) and logged in activity feed.
- Creative receives notification when a new rating is submitted.
- Creative dashboard overview now includes a rating summary card:
  - average rating
  - trend vs older ratings
  - total rating count
  - latest feedback snapshot

### 3.6) Project Member Management (Workspace)
- Added workspace member stream via `projects/{projectId}/members`.
- Added admin controls in workspace to:
  - add collaborator by email with per-project role
  - activate/deactivate existing project member access
- Added service APIs:
  - `resolveUserByEmail`
  - `addProjectMemberByEmail`
  - `updateProjectMemberStatus`

### 3.7) Presence + Read Tracking
- Added workspace presence stream:
  - `projects/{projectId}/presence/{uid}`
  - tracks role, active tab, online/offline state, last seen timestamps
- Workspace now shows active collaborators in the header.
- Added per-tab read tracking on member records:
  - `projects/{projectId}/members/{uid}.lastReadAtByTab.{tabKey}`

### 3.8) Notification Digest Foundation
- Added Cloud Functions:
  - scheduled: `generateDailyNotificationDigest` (daily 06:00, Africa/Nairobi)
  - manual admin trigger: `triggerDailyNotificationDigest`
- Digest pipeline:
  - groups unread notifications by recipient
  - writes `notificationDigests/{recipientId}_{YYYY-MM-DD}`
  - creates an in-app summary notification (`type: digest`)
- Added admin UI button in Notifications module to trigger digest generation and view run counts.

### 3.9) Unread + Read-State Surfaces
- Added shared notifications panel with:
  - unread counter
  - `Mark read` per item
  - `Mark all read`
- Wired into both client and creative dashboards.
- Added unread badge indicators in dashboard side navigation for notifications modules.
- Added overview-level notification summary cards in:
  - client dashboard
  - creative dashboard
  - admin dashboard
- Added auto-mark setting in client/creative notifications tabs:
  - `Auto mark on open` (persisted in local storage)

### 3.10) Dashboard Performance Baseline
- Added route-level lazy loading for role dashboards:
  - client
  - creative
  - admin
- Introduced suspense fallback UI during module chunk loading.

### 3.11) Workspace Member Management Upgrade
- Extended workspace member controls for project admins:
  - update collaborator role inline
  - deactivate/activate collaborator
  - remove collaborator from workspace
- Added ownership operations:
  - transfer project ownership to an active workspace member
  - automatic demotion of previous owner to collaborator role
- Added service-layer operations:
  - `updateProjectMemberRole(...)`
  - `removeProjectMember(...)`
  - `transferProjectOwnership(...)`
- Added audit activity entries and recipient notifications for role changes/removal.
- Added member-removal safety guards:
  - owner cannot be removed directly (transfer first)
  - last active project/app admin cannot be removed

### 3.4) Workspace Data Scaling Refactor
- Migrated high-churn workspace entities from project document arrays to project subcollections:
  - `projects/{projectId}/notes`
  - `projects/{projectId}/comments`
  - `projects/{projectId}/versions`
  - `projects/{projectId}/activities`
- `projectService` now writes these entities as independent documents.
- Added real-time first-page listeners + explicit load-more pagination for each workspace stream.
- Workspace UI now reads paginated subcollection data and no longer depends on growing array fields for these streams.

### 3.5) Legacy Data Backfill Utility
- Added one-time migration script:
  - `npm run migrate:workspace-data`
- Script path:
  - `functions/scripts/migrateWorkspaceData.js`
- Behavior:
  - scans all `projects`
  - backfills legacy arrays into `notes/comments/versions/activities` subcollections
  - writes migration marker fields on each project document
- Optional cleanup mode:
  - `npm --prefix functions run migrate:workspace-data -- --prune`
  - clears legacy arrays after successful backfill validation
- Added in-app safety fallback:
  - workspace open triggers `projectService.backfillWorkspaceDataForProject(...)`
  - this backfills legacy arrays into subcollections on-demand for unmigrated projects
  - intended as a bridge when one-time script execution is unavailable in local/dev environments
- Added server-side callable migration:
  - `runWorkspaceMigration` Cloud Function (admin-auth protected)
  - supports:
    - `pruneLegacy` (boolean)
    - `maxProjects` (optional safety limit)
    - `startAfterId` (resume cursor for chunked runs)
  - wired into founder/admin dashboard as one-click migration controls
  - writes audit records in `systemJobs`:
    - `type: workspace_migration`
    - requester, run options, status, result/error, timestamps
  - added Founder Console `System Jobs` panel:
    - filter by status
    - inspect run metrics and next cursor
    - one-click cursor load for resume runs

### 4) Notifications Expansion
- Added notification fan-out for key transitions:
  - Revision requested
  - Project approved
  - Ready for client review

### 5) Firestore Security Rules Hardening
Replaced temporary open rules with role- and collaborator-aware rules:
- User role lookup via `users/{uid}`.
- Project access based on owner/assigned/member/admin.
- Project subcollections added for future-safe collaboration structure:
  - `members`, `notes`, `comments`, `versions`, `activities`, `approvals`
- Notifications restricted to recipient/admin reads.

## Files Updated
- `src/components/dashboard/ClientDashboard.jsx`
- `src/components/dashboard/CreativeDashboard.jsx`
- `src/components/dashboard/AdminDashboard.jsx`
- `src/components/admin/ProjectOversightPanel.jsx`
- `src/components/creative/ProjectWorkspace.jsx`
- `src/services/projectService.js`
- `src/services/adminService.js`
- `firestore.rules`

## Backward-Compatibility Notes
- Existing dashboard role-specific sections remain intact (credits, earnings, workload, KPI/admin tables).
- Existing project document fields remain usable.
- Added `assignedCreativeIds` for multi-member-ready assignment while keeping `assignedCreativeId` for current flows.

## Next Recommended Iteration
1. Add project member management UI (invite/remove client members and creative collaborators).
2. Add presence indicators and read/unread tracking in workspace.
3. Add scheduled email digest Cloud Function for notifications.
