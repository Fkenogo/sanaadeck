// Fallback subscription tier config for Cloud Functions.
//
// The authoritative runtime source is the Firestore document:
//   systemConfig/subscriptionTiers  (field: tiers)
//
// This file is used ONLY when that document cannot be read (cold-start failure,
// missing seed, etc.). Run  npm --prefix functions run seed:system-config  to
// write the Firestore document before first deploy.
//
// Frontend display constants in src/utils/constants.js must stay in sync with
// these values, but the Cloud Function always reads from Firestore first.

const SUBSCRIPTION_TIERS = {
  starter: {maxActiveRequests: 1, creditsPerMonth: 15},
  growth: {maxActiveRequests: 2, creditsPerMonth: 30},
  pro: {maxActiveRequests: 3, creditsPerMonth: 60},
};

module.exports = {SUBSCRIPTION_TIERS};
