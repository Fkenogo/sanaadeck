/* eslint-disable no-console */
// Seeds systemConfig/subscriptionTiers Firestore document.
// Run: npm --prefix functions run seed:system-config
//
// This document is the authoritative runtime source for tier limits.
// Cloud Functions read from here first; they fall back to functions/config/tiers.js
// if this document is missing or unreadable.
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const TIERS = {
  starter: {maxActiveRequests: 1, creditsPerMonth: 15},
  growth: {maxActiveRequests: 2, creditsPerMonth: 30},
  pro: {maxActiveRequests: 3, creditsPerMonth: 60},
};

async function seedSystemConfig() {
  const ref = db.collection("systemConfig").doc("subscriptionTiers");
  const snap = await ref.get();

  if (snap.exists) {
    console.log("systemConfig/subscriptionTiers already exists. Skipping.");
    return {skipped: true};
  }

  await ref.set({
    tiers: TIERS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("Seeded systemConfig/subscriptionTiers.");
  return {seeded: true};
}

seedSystemConfig()
    .then((result) => {
      if (result.skipped) {
        console.log("Nothing to do — systemConfig already seeded.");
      } else {
        console.log("Done. Tier config written to systemConfig/subscriptionTiers.");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
