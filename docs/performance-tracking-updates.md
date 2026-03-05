# Performance Tracking System Updates

Last updated: 2026-03-04

## Objective
Implement full CPS backend + dashboard alignment to match Prompt 9 while preserving existing creative/admin workflows.

## Gap Audit Summary
Before this pass, only partial UI existed:
- `PerformanceScoreCard` (display-only)
- admin performance alerts based on current profile values

Missing pieces addressed in this pass:
- scheduled CPS calculator function
- monthly performance review persistence
- warning issuance and tier promotion workflow
- creative performance review UI
- admin performance management panel with manual override

## Implemented

### 1) Cloud Function: CPS Calculator
- Added: `functions/performance/cpsCalculator.js`
- Added helpers:
  - `calculateCPSScore(metrics)`
  - `determineStatus(score)`
  - `generateReviewNotes(status, metrics)`
  - promotion eligibility check (`checkTierPromotion`)
  - bonus eligibility update
  - warning issuer + notification
  - tier promotion handler

### 2) Monthly Scheduler
- Added scheduled function:
  - `runMonthlyCPSCalculation` on `0 2 1 * *` (`Africa/Nairobi`)
- For each creative it computes:
  - total projects, total credits
  - average rating
  - on-time rate
  - revision rate
  - missed deadlines
  - CPS score and status
  - bonus eligibility
  - promotion eligibility
- Persists review docs in `performanceReviews`.
- Updates `creatives/{id}.performance`.

### 3) Admin-triggered CPS run + manual override
- Exported callables in `functions/index.js`:
  - `triggerMonthlyCPSCalculation`
  - `overrideCreativePerformanceReview`
- Added service methods in `src/services/adminService.js`:
  - `triggerMonthlyCPSCalculation()`
  - `overrideCreativePerformanceReview(payload)`

### 4) Creative dashboard review component
- Added `src/components/creative/PerformanceReview.jsx`:
  - current month review summary
  - CPS + trend
  - target comparison bars for rating, on-time, revision, missed deadlines
  - active bonus flags
  - review notes + history count
- Wired into creative overview:
  - `src/components/dashboard/CreativeDashboard.jsx`

### 5) Admin performance management panel
- Added `src/components/admin/CreativePerformancePanel.jsx`:
  - list creatives with latest CPS/status
  - filter by status
  - run monthly CPS button
  - manual override (score/status/justification)
- Wired into admin creatives module:
  - `src/components/dashboard/AdminDashboard.jsx`

### 6) Firestore Rules
- Added `performanceReviews` access in `firestore.rules`:
  - creatives can read own reviews
  - admins can read/write

## Notes
- Email alert delivery for CPS warnings flows through existing notifications system (`channels.email=true`) if functions email provider is configured.
- Metrics depend on project fields currently available (`approvedAt`, `deadline`, `clientRating`, `revisionCount/revisionRound`, turnaround fields if present).
