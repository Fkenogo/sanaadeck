#!/usr/bin/env node

const admin = require("firebase-admin");
const {SERVICE_CATEGORIES, DESIGN_DELIVERABLES} = require("../catalog/catalogDefinitions");
const {normalizeSkillTags} = require("../catalog/skillTaxonomy");

if (!admin.apps.length) {
  admin.initializeApp();
}

async function seedCollection() {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const category of SERVICE_CATEGORIES) {
    const ref = db.collection("serviceCategories").doc(category.id);
    const snap = await ref.get();
    await ref.set({
      title: category.title,
      description: category.description,
      active: true,
      createdAt: snap.exists ? snap.data()?.createdAt || now : now,
      updatedAt: now,
    }, {merge: true});
  }

  for (const deliverable of DESIGN_DELIVERABLES) {
    const ref = db.collection("designDeliverables").doc(deliverable.id);
    const snap = await ref.get();
    await ref.set({
      title: deliverable.title,
      category: deliverable.category,
      description: deliverable.description,
      typicalCredits: Number(deliverable.typicalCredits || 0),
      internalWorkloadScore: Number(deliverable.internalWorkloadScore || 0),
      complexity: deliverable.complexity || "medium",
      dimensions: Array.isArray(deliverable.dimensions) ? deliverable.dimensions : [],
      allowedFormats: Array.isArray(deliverable.allowedFormats) ? deliverable.allowedFormats : [],
      requiredSkills: normalizeSkillTags(deliverable.requiredSkills),
      active: true,
      createdAt: snap.exists ? snap.data()?.createdAt || now : now,
      updatedAt: now,
    }, {merge: true});
  }

  console.log(`Seeded ${SERVICE_CATEGORIES.length} service categories and ${DESIGN_DELIVERABLES.length} design deliverables.`);
}

seedCollection().catch((error) => {
  console.error("Failed to seed design catalog:", error);
  process.exit(1);
});
