# Credit Tracking Engine Alignment (Mar 4, 2026)

## Audit Summary
The credit engine was mostly implemented in `src/services/creditService.js` with transaction-safe deduction logic and FIFO extra-pack handling.

## Gaps Found
1. Credits were being deducted at project creation time in `projectService.createProjectWithCreditReservation`, which conflicted with the updated rule to deduct after client confirmation.
2. `handleExpiredPacks()` existed only as a frontend service method, not as a scheduled Cloud Function.
3. Some credit transaction writers did not consistently include both `amount` and balance before/after metadata.
4. Monthly subscription reset existed as a client service utility (`allocateMonthlyCredits`) but had no scheduled backend job.

## Fixes Applied
### 1) Deduct credits on client confirmation
- Updated `src/services/projectService.js`:
  - Project creation now validates available balance but does not deduct credits.
  - New projects store:
    - `creditsReserved: false`
    - `reservedCreditsAmount: 0`
  - Credits are reserved in `approveProject(...)` (client final confirmation stage).
  - Added legacy-safe backfill check to avoid double-deduction for older projects that were already deducted.

### 2) Scheduled expiry cleanup
- Added `functions/credits/expiry.js`:
  - `runExpiredCreditPackCleanup` (daily scheduled job)
  - `triggerExpiredCreditPackCleanup` (admin callable)
  - Removes expired extra packs and logs `expiry` transactions.
- Exported in `functions/index.js`.

### 3) Transaction payload consistency
- Updated `src/services/creditService.js` transaction writers to include:
  - `amount`
  - `creditsAmount`
  - `balanceBefore`
  - `balanceAfter`
- Updated `functions/payments/paymentActions.js` extra-pack grant logs to include:
  - `amount`
  - `balanceBefore`
  - `balanceAfter`

### 4) Scheduled monthly allocation
- Added `functions/credits/renewal.js`:
  - `runMonthlyCreditAllocationJob` (daily scheduled renewal check)
  - `triggerMonthlyCreditAllocationJob` (admin callable)
  - For active subscriptions with due `renewalDate`, resets:
    - `subscription.creditsUsed = 0`
    - `subscription.creditsRemaining = creditsPerMonth`
    - period dates and renewal date
  - Logs `allocation` transaction.
- Exported in `functions/index.js`.

## Result
Core credit tracking now aligns with the provided specification while preserving existing dashboard and project workflows.

## Admin controls added
- Super admin dashboard now includes manual credit maintenance actions:
  - Run monthly allocation job
  - Run expired-pack cleanup job
- Wired through `adminService` callables:
  - `triggerMonthlyCreditAllocationJob`
  - `triggerExpiredCreditPackCleanup`
