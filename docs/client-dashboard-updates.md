# Client Dashboard Alignment Updates (Mar 4, 2026)

## Scope
Step-by-step alignment of the client dashboard with the SanaaDeck specification while preserving workspace and updated credit-deduction flow.

## Changes made

### 1) Header alignment
- Updated `ClientDashboard` header to include:
  - Welcome message with business name
  - Tier badge (`starter/growth/pro`)
  - Quick stats line: total projects, credits remaining, active requests
- File: `src/components/dashboard/ClientDashboard.jsx`

### 2) Credit balance card alignment
- Added expiring credits warning (<7 days) support from credit balance payload:
  - `expiringSoonCredits`
  - `expiringSoonPackCount`
- Displayed expiry warning in `CreditBalanceCard`.
- Kept “Buy extra credits” CTA only when usage is >= 80% (quick action purchase remains available separately).
- Files:
  - `src/services/creditService.js`
  - `src/components/credits/CreditBalanceCard.jsx`

### 3) Active requests counter behavior
- Added active requests preview section in Overview showing up to 3 active project cards and counter (`x of limit`).
- File: `src/components/dashboard/ClientDashboard.jsx`

### 4) Project tabs and cards
- Updated tab label to `Pending confirmation`.
- Updated project card primary action label from `Open workspace` to `View`.
- Project cards already include:
  - title + deliverable
  - status badge with color mapping
  - credits used/estimated
  - timeline
  - assigned creative with avatar
  - quick actions for review/approve/revision flow
- Files:
  - `src/components/dashboard/ClientDashboard.jsx`
  - `src/components/projects/ProjectCard.jsx`

### 5) New request modal wording alignment
- Updated final confirmation copy/button to match current credit policy:
  - project confirmed at request time
  - credit deduction occurs at final client approval stage
- File: `src/components/projects/NewProjectModal.jsx`

## Notes
- Existing real-time listeners remain in place:
  - client profile (`onSnapshot`)
  - projects subscription
  - notifications (`useNotifications` + Firestore subscription)
- Quick actions remain available:
  - upgrade subscription
  - purchase extra credits
  - view billing history
  - update brand assets
