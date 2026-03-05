# Payment Integration Updates (Pesapal-only)

Last updated: 2026-03-04

## Objective
Keep SanaaDeck payment flow Pesapal-only and remove all legacy runtime integration.

## Implemented

### 1) Legacy payment runtime removed
- Removed legacy payment Cloud Function module.
- Removed legacy payment component.
- Kept only Pesapal runtime functions in `functions/index.js`.

### 2) Frontend payment flow simplified
- `src/services/paymentService.js` now uses Pesapal only.
- Removed legacy callable wiring and branch logic.
- `purchaseExtraCredits(...)` routes directly to Pesapal checkout.

### 3) Unified checkout component enabled
- Added `src/components/payments/UnifiedPaymentForm.jsx` with 3-step flow:
  - country selection
  - payment method selection
  - payer details and redirect
- Wired checkout entry points (dashboard/credits/subscription upgrade) to use `UnifiedPaymentForm`.

### 4) Environment cleanup
- Removed dependency on legacy provider config.
- Added Pesapal functions config keys:
  - `pesapal.consumer_key`
  - `pesapal.consumer_secret`
  - `pesapal.env`
  - `pesapal.ipn_id`
  - `app.url`

### 5) Retained behavior
- Existing payment application logic in `functions/payments/paymentActions.js` remains active.
- Pesapal functions remain active:
  - `initiatePesapalPayment`
  - `registerPesapalIPN`
  - `pesapalIPN`
  - `checkPesapalPaymentStatus`
- Existing `VITE_PAYMENT_SIMULATE` behavior remains available.

## Files Updated
- `functions/index.js`
- `functions/payments/pesapal.js`
- `src/services/paymentService.js`
- `src/services/pricingService.js`
- `src/components/payments/UnifiedPaymentForm.jsx`
- `src/pages/Credits.jsx`
- `src/components/dashboard/ClientDashboard.jsx`
- `scripts/verify-payment-scenarios.mjs`
- `src/utils/paymentTesting.js`
- `docs/payment-integration-updates.md`

## Notes
- `VITE_PAYMENT_SIMULATE=true` keeps local/dev flow testable.
