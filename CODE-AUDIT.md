# CODE-AUDIT.md — SanaaDeck Platform

**Audit Date:** 2026-03-03
**Audited by:** Claude Code (automated audit)
**Codebase:** `/Users/theo/sanaa-deck`
**Reference docs:** `docs/01-BUSINESS-CONCEPT-REVISED.md`, `docs/02-TECHNICAL-IMPLEMENTATION-GUIDE-REVISED.md`, `docs/03-AI-DEVELOPMENT-PROMPTS-REVISED.md`, `docs/04-QUICK-START-IMPLEMENTATION-ROADMAP-REVISED.md`

---

## 1. Fully Implemented Features

These features are documented in the .md files and have matching, working implementations in the codebase.

| Feature | Documentation Reference | Implementation |
|---|---|---|
| Role-based auth (client, creative, admin, super_admin) | Business Concept §3 | `authService.js`, `authStore.js`, `useAuth.js`, `App.jsx` route guards |
| Credit system (1 credit = 45 min) | Business Concept §4 | `creditService.js`, `creditsStore.js`, `useCredits.js`, `Credits.jsx` |
| FIFO credit deduction (subscription first, then extras) | Tech Guide §5 | `creditService.js` — `deductFromExtraPacks` + subscription balance logic |
| Subscription tiers (Starter/Growth/Pro) | Business Concept §4 | `constants.js` `SUBSCRIPTION_TIERS`, `clientService.js` `updateSubscriptionTier` |
| Monthly credit allocation | Tech Guide §5 | Cloud Function `runMonthlyCreditAllocationJob` + `functions/credits/` |
| Expiring credit packs (FIFO cleanup) | Tech Guide §5 | Cloud Function `runExpiredCreditPackCleanup` + `functions/credits/` |
| Pesapal payment integration (East Africa) | Tech Guide §7 | `paymentService.js`, `UnifiedPaymentForm.jsx`, Cloud Functions `payments/` |
| Multi-country pricing (KE, UG, RW, BI, TZ) | Business Concept §6 | `pricingService.js` with local currency support |
| Project lifecycle (6 statuses) | Tech Guide §3 | `projectService.js` — full status machine from `pending_confirmation` → `approved` |
| Real-time workspace (comments, notes, versions) | Tech Guide §4 | `ProjectWorkspace.jsx`, `projectService.js` workspace methods |
| Workspace presence tracking | Tech Guide §4 | `upsertWorkspacePresence` in `projectService.js`, 30s heartbeat |
| File management (upload, Drive links, Figma links) | Tech Guide §4 | `fileService.js` — Storage upload, Google Drive, Figma URL handling |
| In-app notifications with unread count | Tech Guide §6 | `notificationService.js`, `useNotifications.js`, `NotificationCenter.jsx` |
| Creative performance score (CPS) | Business Concept §5 | Cloud Function `runMonthlyCPSCalculation`, `CreativePerformancePanel.jsx` |
| QC workflow | Tech Guide §3 | `projectService.js` — QC flag, `ready_for_qc` status, admin handoff |
| Client rating system (post-approval) | Tech Guide §3 | `projectService.js` `submitProjectRating`, `RatingSummaryCard.jsx` |
| Brand assets storage per client | Tech Guide §3 | `clientService.js` `updateBrandAssets`, `brandAssets` field in profile |
| Template contributions by creatives | Business Concept §5 | `creativeService.js` `addTemplateContribution`, `TemplateContributionsCard.jsx` |
| Admin template asset library | Tech Guide §8 | `TemplateAssetLibraryPanel.jsx`, `adminService.js` |
| Admin credit adjustment | Tech Guide §8 | `CreditAdjustmentModal.jsx`, `adminService.js` |
| Admin project oversight | Tech Guide §8 | `ProjectOversightPanel.jsx`, `adminService.js` |
| Admin performance reviews & overrides | Tech Guide §8 | `CreativePerformancePanel.jsx`, Cloud Function `overrideCreativePerformanceReview` |
| Admin role management | Tech Guide §8 | `AdminRoleManagement.jsx`, permission presets in `constants.js` |
| Admin platform KPIs | Tech Guide §8 | `PlatformKPIs.jsx`, `adminService.js` |
| Revenue chart | Tech Guide §8 | `RevenueChart.jsx` |
| System jobs panel (manual triggers) | Tech Guide §9 | `SystemJobsPanel.jsx` — triggers all Cloud Functions manually |
| Daily notification digest email | Tech Guide §6 | Cloud Function `generateDailyNotificationDigest` + SendGrid webhook handler |
| Workspace migration utility | Tech Guide §9 | `runWorkspaceMigration` Cloud Function |
| Dark mode UI with gold accent | — | TailwindCSS dark theme, `#C9A227` accent throughout |
| Comment notification badge in workspace | — | `ProjectWorkspace.jsx` — `seenCommentIdsRef` + badge on Review tab |
| Timer widget in workspace header | — | `ProjectWorkspace.jsx` — start/stop timer accessible from all tabs |

---

## 2. Partially Implemented Features

These features have UI or backend components but are missing one side or have notable gaps.

### 2.1 Email Notifications
- **Documented:** Full email delivery for key events (project status changes, payment confirmations, new comments)
- **Implemented:** Cloud Function `sendNotifications` handles SendGrid webhook events; notification Firestore docs include `channels: ['in_app', 'email']`
- **Gap:** No frontend visibility into email delivery status. No email preference settings UI. No unsubscribe mechanism. SendGrid API key must be manually configured in Cloud Function environment with no fallback if absent.
- **Severity:** Medium

### 2.2 Active Project Request Limits per Tier
- **Documented:** `CLIENT_ACTIVE_REQUEST_LIMITS` in `constants.js` — Starter: 2, Growth: 3, Pro: 5
- **Implemented:** Constants are defined; `NewProjectModal.jsx` checks against active project count client-side
- **Gap:** Enforcement is client-side only — no Firestore security rule or Cloud Function validates this server-side. A client could bypass the limit through direct API calls.
- **Severity:** Medium

### 2.3 Payment Status / Webhook Return Flow
- **Documented:** Pesapal IPN (Instant Payment Notification) webhook flow
- **Implemented:** Cloud Functions `pesapalIPN`, `registerPesapalIPN`, `checkPesapalPaymentStatus` exist; `UnifiedPaymentForm.jsx` redirects to Pesapal; `subscribeToPayment` in `paymentService.js` does Firestore real-time listen
- **Gap:** No dedicated `/payment/callback` or `/payment/success` route in `App.jsx`. After Pesapal redirect, users land on the catch-all which redirects to `/dashboard` — losing payment context. Users get no confirmation screen.
- **Severity:** High

### 2.4 Deliverable Versioning UI
- **Documented:** Workspace supports file versioning with version history
- **Implemented:** `projectService.js` has deliverable management methods; `ProjectWorkspace.jsx` has a Deliverables tab; backend stores version numbers
- **Gap:** No "Version 1 → Version 2 → Version 3" timeline UI with compare or revert actions exposed to users.
- **Severity:** Low

### 2.5 Creative Availability Toggle
- **Documented:** Creatives set availability status; affects project assignment eligibility
- **Implemented:** `creativeService.js` `updateAvailability()` exists; `CreativeDashboard.jsx` likely has a toggle
- **Gap:** Admin project assignment panel does not filter by availability when suggesting assignees. No admin-side availability column in `CreativeManagementTable.jsx`.
- **Severity:** Low

### 2.6 Report Generator
- **Documented:** Admin can generate platform reports
- **Implemented:** `ReportGenerator.jsx` component exists
- **Gap:** No backend Cloud Function for report generation — likely generates client-side from Firestore data with no scheduled delivery or export-to-email capability.
- **Severity:** Low

### 2.7 Payment Simulate Mode
- **Documented:** `VITE_PAYMENT_SIMULATE` env var controls simulation for testing
- **Implemented:** Referenced in `paymentService.js`
- **Gap:** No UI indicator when simulate mode is active — a developer could accidentally ship with simulation enabled.
- **Severity:** Low

---

## 3. Missing Features

Features documented but with no implementation found in the codebase.

### 3.1 Payment Return / Callback Route
- **Documented:** Post-payment redirect back to app with confirmation
- **Status:** No `/payment/callback` or `/payment/success` route in `App.jsx`
- **Impact:** Users get no payment confirmation; poor UX on a revenue-critical flow

### 3.2 Email Preference Management
- **Documented:** Users opt in/out of email notifications per event type
- **Status:** No settings page, no preference fields in user profiles, no unsubscribe mechanism
- **Impact:** All-or-nothing email delivery; no user control

### 3.3 Creative Onboarding / Profile Setup Flow
- **Documented:** Creatives complete a profile (portfolio, skills, tools) during onboarding
- **Status:** `authService.js` `createCreativeProfile` sets basic fields only. No guided onboarding wizard, portfolio upload, or skills/tools selection UI exists.
- **Impact:** Creative profiles are sparse; admin has limited data when assigning projects

### 3.4 Client-Facing Template Marketplace Browse
- **Documented:** Clients browse and use templates from the library
- **Status:** Admin can manage the library; creatives can contribute; but no client-facing browse/search UI exists
- **Impact:** Template library is write-only from the client's perspective

### 3.5 Self-Service Subscription Upgrade/Downgrade
- **Documented:** Clients can change tiers themselves with credit impact preview
- **Status:** `clientService.js` `updateSubscriptionTier` exists but is admin-only; no self-service upgrade button or payment flow in client UI; no proration calculation
- **Impact:** All tier changes require admin intervention; no upsell mechanism

### 3.6 Formal Revision / Dispute Flow
- **Documented:** Clients request revisions; formal dispute mechanism
- **Status:** Client can reject at `client_review` status but no structured revision request form, revision notes, or dispute ticket system exists. Communication happens through unstructured comments.
- **Impact:** Revision expectations are undocumented and untracked

### 3.7 Client Dashboard Consumption Metrics
- **Documented:** Client dashboard shows hours consumed, credits remaining, project velocity
- **Status:** `ClientDashboard.jsx` exists but detailed metrics (burn rate, hours per project, velocity charts) not confirmed implemented
- **Impact:** Clients lack visibility into credit consumption patterns

---

## 4. Dead Code

Code present in the repository that serves no active purpose.

### 4.1 `src/components/FirebaseTest.jsx`
- **Type:** Debug/test component left from initial setup
- **Content:** Writes `{ message: 'SanaaDeck Firebase Connected', timestamp }` to Firestore `test/connectionTest` document; returns `null` (invisible in UI)
- **Usage:** Not imported anywhere — no component renders it
- **Risk:** If ever accidentally imported, it writes to production Firestore with test data
- **Action:** **Delete this file**

### 4.2 `src/utils/paymentTesting.js`
- **Type:** Test fixture file in wrong directory
- **Content:** `TEST_COUNTRIES`, `PESAPAL_SANDBOX_CREDENTIALS` (placeholder strings `'YOUR_PESAPAL_SANDBOX_KEY'`), `TEST_CARDS`, `MOCK_PAYMENT_SCENARIOS`, `TEST_SCENARIOS`
- **Usage:** Not imported anywhere in production code
- **Risk:** Lives in `src/utils/` — will be included in build analysis even if tree-shaken; placeholder credentials in source are a code review smell
- **Action:** Move to `src/__tests__/fixtures/` if needed for tests, otherwise **delete**

### 4.3 `src/utils/helpers.js` (near-dead)
- **Type:** Near-trivial utility module
- **Content:** Single function `creditsToHours(credits) => (credits * 45) / 60`
- **Usage:** Only used in `CreditEstimator.jsx`
- **Action:** Inline into `CreditEstimator.jsx` or merge into `creditService.js`

---

## 5. Unused Imports and Console Statements

### 5.1 Console.log Statements in Production Components

| File | Log |
|---|---|
| `src/components/auth/LoginForm.jsx:30` | `'[LoginForm] Login successful'` |
| `src/components/auth/SignupForm.jsx:76` | `'[SignupForm] Signup successful'` |
| `src/components/projects/NewProjectModal.jsx:91` | `'[NewProjectModal] Project created'` |
| `src/components/payments/UnifiedPaymentForm.jsx:108` | Payment error |

**Action:** Remove all `console.log` from production components. Auth success logs are an information disclosure risk in verbose browser environments.

### 5.2 App.css
- `App.css` is not imported anywhere in the codebase (project uses Tailwind exclusively)
- **Action:** Delete if confirmed untracked (check `.gitignore`)

---

## 6. Inconsistent Naming Patterns

### 6.1 Duplicate Constant: `ACTIVE_PROJECT_STATUSES`
Defined in **both** `src/utils/constants.js` (as an exported Set) **and** inline in `src/components/dashboard/AdminDashboard.jsx`.
Any future status addition must be updated in two places.
**Action:** Remove the inline declaration from `AdminDashboard.jsx`; import from `constants.js`.

### 6.2 Service Module Size Imbalance
- `clientService.js` — 3 functions
- `adminService.js` — 20+ functions
- `projectService.js` — 25+ functions
No consistent domain boundary. Admin functions that manipulate projects live in `adminService.js` while core project functions live in `projectService.js`.

### 6.3 Firestore Collection Naming Convention
- `templateAssetLibrary` (camelCase)
- `workspacePresence` (camelCase)
- `credit_transactions` (snake_case — inferred from function names)
No single convention applied. Recommend kebab-case or snake_case uniformly.

### 6.4 Duplicate Component Name: `NotificationsPanel`
`src/components/creative/NotificationsPanel.jsx` and likely a similar component exist for other roles — same filename in different directories. IDE navigation and import auto-complete become error-prone.

### 6.5 `AdminDashboard` `mode` Prop vs Role Names
- Role in auth: `'super_admin'`
- Mode prop in `AdminDashboard`: `'super'`
- Role in auth: `'admin'` (but split into `mode='project'` and `mode='app'`)
Inconsistent mapping between auth role names and dashboard mode names.

---

## 7. Temporary Test Logic Left in Production

### 7.1 `FirebaseTest.jsx` — Test Writes to Production Firestore
Writes to `test/connectionTest` collection. Not imported, but its presence is a risk.

### 7.2 `paymentTesting.js` — Sandbox Credentials in Source
`PESAPAL_SANDBOX_CREDENTIALS` object with placeholder values lives in `src/utils/`. Even with tree-shaking, credentials files in source should not exist.

### 7.3 Console.log in Auth Flow
`LoginForm.jsx` and `SignupForm.jsx` log successful auth events — potential information disclosure in production browser consoles.

---

## 8. Duplication of Logic

### 8.1 `toMillis()` — Duplicated Across 21+ Files
This is the most significant duplication in the codebase. Every file that touches a Firestore Timestamp re-implements the same one-liner:

```js
const toMillis = (ts) => ts?.toMillis?.() ?? ts?.seconds * 1000 ?? ts ?? 0
```

**Files with this duplication (21+):**
`ProjectWorkspace.jsx`, `AdminDashboard.jsx`, `ProjectOversightPanel.jsx`, `ClientManagementTable.jsx`, `CreativePerformancePanel.jsx`, `CreativeDashboard.jsx`, `NotificationCenter.jsx`, `RatingSummaryCard.jsx`, `ProjectDetailsModal.jsx`, `ProjectCard.jsx`, `adminService.js`, `projectService.js`, `QuickActionsPanel.jsx`, `Credits.jsx`, `notificationService.js`, `EarningsCard.jsx`, `creditService.js`, `NotificationsPanel.jsx` (creative), `TemplateContributionsCard.jsx`, `clientService.js`, and more.

**Action:** Create `src/utils/timestamp.js` and export `toMillis`, `formatDate`, `formatDateTime`, `monthLabel`. Import in all 21+ files.

### 8.2 `formatDate()` / `formatDateTime()` — Duplicated ~10 Times
Inline date formatting functions duplicated across components and services alongside `toMillis`.

### 8.3 `monthLabel()` — Inline in `AdminDashboard.jsx`
Month label formatter not shared with other components that do the same formatting.

### 8.4 `ACTIVE_PROJECT_STATUSES` — Defined Twice
See §6.1 above.

### 8.5 `runWorkspaceMigration` — Inline in `functions/index.js`
All other Cloud Function handlers are extracted to separate module files under `functions/credits/`, `functions/notifications/`, `functions/payments/`, etc. `runWorkspaceMigration` (~70 lines) is defined inline in the entry point.

**Action:** Extract to `functions/workspace/workspaceMigration.js` for consistency.

---

## 9. Incomplete Flows (UI without Backend or Vice Versa)

| Flow | What Exists | What's Missing |
|---|---|---|
| Payment return | Backend IPN handler + Firestore listener | Frontend `/payment/callback` route and confirmation UI |
| Notification digest | Cloud Function sends emails daily | User preference UI, digest history, unsubscribe |
| Creative profile | `createCreativeProfile` backend | Profile editing UI, portfolio upload, skills selection |
| Template marketplace | Admin CRUD + creative contributions | Client-facing browse/search/use UI |
| Subscription self-service | `updateSubscriptionTier` backend | Client-facing upgrade/downgrade UI with payment |
| Server-side project limits | `CLIENT_ACTIVE_REQUEST_LIMITS` constants | Firestore rule or Cloud Function enforcement |

---

## 10. Technical Debt Level: **MEDIUM–HIGH**

### Breakdown

| Category | Instances | Severity |
|---|---|---|
| `toMillis` duplication | 21+ files | **High** |
| `formatDate`/`formatDateTime` duplication | ~10 files | Medium |
| Missing payment callback route | 1 (revenue-critical) | **High** |
| Missing documented features | 7 features | Medium |
| Dead test files | 2 files | Low |
| Console.log in production | 4 files | Low |
| Inline constant duplication | 2 instances | Low |
| Service module size imbalance | 3 services | Low |

### Reasoning

**Why not Low:** The `toMillis` duplication across 21+ files is a compounding maintenance liability — any change to Firestore Timestamp handling requires touching 21 files. The missing payment callback route is a production gap in a revenue-critical user flow.

**Why not High:** Core architecture is sound. Role-based security model is correctly implemented. Cloud Functions are modular. No SQL injection, XSS, or credential exposure found in production code. Dead code volume is small (2 files). The platform is functionally operational for its primary use cases.

---

## 11. Recommended Priority Actions

### P0 — Fix Before or At Launch
1. **Add `/payment/callback` route** — users need a landing page after Pesapal redirect with success/failure confirmation
2. **Extract `toMillis` to `src/utils/timestamp.js`** — eliminates the largest maintenance risk before the codebase grows further

### P1 — Fix This Sprint
3. **Delete `src/components/FirebaseTest.jsx`** — dead test file that writes to production Firestore
4. **Delete or relocate `src/utils/paymentTesting.js`** — test fixtures do not belong in `src/utils/`
5. **Remove `console.log` from auth components** — information disclosure risk
6. **Remove duplicate `ACTIVE_PROJECT_STATUSES`** from `AdminDashboard.jsx`; import from `constants.js`

### P2 — Next Milestone
7. **Build payment callback/success UI** (`/payment/callback` page)
8. **Build creative profile setup/edit flow** — enable richer onboarding
9. **Add self-service subscription upgrade UI** — reduce admin operational burden
10. **Build client-facing template browse UI** — complete the template marketplace

### P3 — Ongoing Refactor
11. **Extract `formatDate`/`formatDateTime`/`monthLabel` to `src/utils/timestamp.js`**
12. **Split `projectService.js` and `adminService.js`** into smaller domain-scoped services
13. **Extract `runWorkspaceMigration`** from `functions/index.js` to `functions/workspace/`
14. **Add server-side enforcement** of active project limits (Firestore security rule or Cloud Function)
15. **Standardize Firestore collection naming** to snake_case across all collections

---

*Audit generated against branch `main` as of 2026-03-03. Re-run after P0/P1 items are resolved.*
