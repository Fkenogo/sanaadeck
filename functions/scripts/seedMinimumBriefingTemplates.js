/* eslint-disable no-console */
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const TEMPLATES = [
  {
    title: "Social Media Post",
    category: "social_post",
    description: "Create a clean social media post aligned to brand style.",
    suggestedBrief: "Design a social media post with a clear message and CTA. Include brand colors and logo.",
    tags: ["social", "brand", "engagement"],
  },
  {
    title: "Promotional Banner",
    category: "social_post",
    description: "Create a promotional banner highlighting a specific offer.",
    suggestedBrief: "Design a bold promo banner. Make the offer and timeline very clear.",
    tags: ["promo", "banner", "offer"],
  },
  {
    title: "Event Poster",
    category: "flyer",
    description: "Create an event poster with date, venue, and key highlights.",
    suggestedBrief: "Design an event poster that is easy to scan and visually strong.",
    tags: ["event", "poster", "flyer"],
  },
];

async function run() {
  const batch = db.batch();

  for (const template of TEMPLATES) {
    const existingSnap = await db.collection("briefingTemplates")
        .where("title", "==", template.title)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
      const ref = existingSnap.docs[0].ref;
      batch.set(ref, {
        ...template,
        published: true,
        status: "active",
        usageCount: Number(existingSnap.docs[0].data().usageCount || 0),
        updatedAt: now,
      }, {merge: true});
      continue;
    }

    const ref = db.collection("briefingTemplates").doc();
    batch.set(ref, {
      ...template,
      published: true,
      status: "active",
      usageCount: 0,
      source: "minimum-seed",
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`Seeded/updated ${TEMPLATES.length} minimum briefing templates.`);
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Minimum briefing template seed failed:", error);
      process.exit(1);
    });
