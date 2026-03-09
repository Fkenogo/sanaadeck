const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {SUBSCRIPTION_TIERS} = require("../config/tiers");
const {ALLOWED_UPLOAD_FORMATS} = require("../catalog/catalogDefinitions");
const {normalizeSkillTags} = require("../catalog/skillTaxonomy");

// Must match src/utils/constants.js ACTIVE_PROJECT_STATUSES
const ACTIVE_PROJECT_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "in_progress",
  "ready_for_qc",
  "client_review",
  "revision_requested",
];

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

function parseDeadline(deadline) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return admin.firestore.Timestamp.fromDate(date);
}

function composeLegacyBrief(briefModel) {
  return [
    `Project Overview: ${briefModel.projectOverview || "-"}`,
    `Target Audience: ${briefModel.targetAudience || "-"}`,
    `Key Message: ${briefModel.keyMessage || "-"}`,
    `Deliverables: ${briefModel.deliverables || "-"}`,
    `Specifications: ${briefModel.specifications || "-"}`,
    `Usage Platform: ${briefModel.usagePlatform || "-"}`,
    `Deadline: ${briefModel.deadline || "-"}`,
    `Other Notes: ${briefModel.otherNotes || "-"}`,
  ].join("\n");
}

function normalizeBriefModel(data = {}) {
  const legacy = data.structuredBrief && typeof data.structuredBrief === "object" ? data.structuredBrief : {};
  const input = data.briefModel && typeof data.briefModel === "object" ? data.briefModel : {};

  const model = {
    projectOverview: String(input.projectOverview || legacy.taskDescription || data.description || "").trim(),
    targetAudience: String(input.targetAudience || legacy.targetAudience || "").trim(),
    keyMessage: String(input.keyMessage || legacy.keyMessage || "").trim(),
    deliverables: String(input.deliverables || "").trim(),
    specifications: String(input.specifications || "").trim(),
    deadline: String(input.deadline || legacy.deadline || data.deadline || "").trim(),
    usagePlatform: String(input.usagePlatform || legacy.platformOrMedia || "").trim(),
    otherNotes: String(input.otherNotes || legacy.additionalNotes || "").trim(),
  };

  return model;
}

function countAssets(items = []) {
  if (!Array.isArray(items)) return 0;
  return items.filter((entry) => {
    if (!entry) return false;
    if (typeof entry === "string") return Boolean(String(entry).trim());
    if (typeof entry === "object") {
      return Boolean(String(entry.url || entry.link || entry.fileName || entry.name || "").trim());
    }
    return false;
  }).length;
}

function countReferenceLinks(items = []) {
  const linkRegex = /^https?:\/\//i;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, entry) => {
    if (!entry) return sum;
    if (typeof entry === "string") return sum + (linkRegex.test(entry.trim()) ? 1 : 0);
    if (typeof entry === "object") {
      const candidate = String(entry.url || entry.link || "").trim();
      return sum + (linkRegex.test(candidate) ? 1 : 0);
    }
    return sum;
  }, 0);
}

function hasDimensionsSpecified(briefModel = {}) {
  const combined = `${briefModel.specifications || ""} ${briefModel.deliverables || ""}`;
  if (!combined.trim()) return false;
  const compact = /\b\d{2,5}\s?(x|×)\s?\d{2,5}\b/i;
  const unit = /\b(px|mm|cm|in|inch|inches)\b/i;
  return compact.test(combined) || unit.test(combined);
}

function computeBriefQuality({briefModel, description, referenceFiles, inspirationFiles, brandAssetFiles}) {
  const textContent = [
    briefModel?.projectOverview || "",
    briefModel?.targetAudience || "",
    briefModel?.keyMessage || "",
    briefModel?.deliverables || "",
    briefModel?.specifications || "",
    briefModel?.usagePlatform || "",
    briefModel?.otherNotes || "",
    description || "",
  ].join(" ").trim();

  const textLength = textContent.length;
  const textScore = textLength >= 320 ? 25 :
    textLength >= 180 ? 18 :
      textLength >= 80 ? 12 :
        textLength > 0 ? 6 : 0;

  const assetsCount = countAssets(referenceFiles) + countAssets(inspirationFiles) + countAssets(brandAssetFiles);
  const assetsAttachedScore = assetsCount >= 4 ? 25 :
    assetsCount >= 2 ? 18 :
      assetsCount === 1 ? 10 : 0;

  const inlineLinks = (textContent.match(/https?:\/\/\S+/gi) || []).length;
  const referenceLinksCount = countReferenceLinks(referenceFiles) + countReferenceLinks(inspirationFiles) + inlineLinks;
  const referenceLinksScore = referenceLinksCount >= 3 ? 25 :
    referenceLinksCount >= 1 ? 15 : 0;

  const dimensionsSpecified = hasDimensionsSpecified(briefModel);
  const dimensionsSpecifiedScore = dimensionsSpecified ? 25 : 0;

  const total = Math.max(0, Math.min(100, assetsAttachedScore + textScore + referenceLinksScore + dimensionsSpecifiedScore));
  return {
    briefScore: total,
    briefQualityFlag: total < 50,
    briefScoreBreakdown: {
      assetsAttached: assetsAttachedScore,
      textProvided: textScore,
      referenceLinks: referenceLinksScore,
      dimensionsSpecified: dimensionsSpecifiedScore,
    },
  };
}

// --- Tier config cache ---
// Authoritative source: systemConfig/subscriptionTiers (field: tiers)
// Fallback: SUBSCRIPTION_TIERS from ../config/tiers
let _tierCache = null;
let _tierCacheAt = 0;
const TIER_CACHE_TTL_MS = 5 * 60 * 1000;

async function getTierConfig(db) {
  const now = Date.now();
  if (_tierCache && now - _tierCacheAt < TIER_CACHE_TTL_MS) {
    return _tierCache;
  }
  try {
    const snap = await db.collection("systemConfig").doc("subscriptionTiers").get();
    if (snap.exists) {
      const tiers = snap.data()?.tiers;
      if (tiers && typeof tiers === "object") {
        _tierCache = tiers;
        _tierCacheAt = now;
        return tiers;
      }
    }
  } catch (err) {
    console.warn("[getTierConfig] Firestore read failed, using fallback:", err.message);
  }
  return SUBSCRIPTION_TIERS;
}

// --- FIFO credit reservation plan ---
// Returns { valid, logEntries, clientUpdate }
// valid=false means insufficient credits (remaining > 0 after exhausting all packs)
function computeReservation(clientData, creditsNeeded) {
  const nowMillis = admin.firestore.Timestamp.now().toMillis();
  let remaining = creditsNeeded;
  const logEntries = [];
  const clientUpdate = {};

  // 1. Subscription credits first
  const subCredits = Number(clientData?.subscription?.creditsRemaining || 0);
  if (subCredits > 0 && remaining > 0) {
    const deduct = Math.min(subCredits, remaining);
    remaining -= deduct;
    clientUpdate["subscription.creditsRemaining"] = subCredits - deduct;
    logEntries.push({source: "subscription", amount: deduct, packId: null});
  }

  // 2. Extra credit packs — oldest purchase date first (FIFO)
  const allExtra = Array.isArray(clientData?.extraCredits) ? [...clientData.extraCredits] : [];
  const validExtra = allExtra
      .map((pack, idx) => ({...pack, _idx: idx}))
      .filter((pack) => toMillis(pack?.expiryDate) > nowMillis && Number(pack?.creditsRemaining || 0) > 0)
      .sort((a, b) => toMillis(a.purchaseDate) - toMillis(b.purchaseDate));

  for (const pack of validExtra) {
    if (remaining <= 0) break;
    const packCredits = Number(pack.creditsRemaining || 0);
    const deduct = Math.min(packCredits, remaining);
    remaining -= deduct;
    allExtra[pack._idx] = {...allExtra[pack._idx], creditsRemaining: packCredits - deduct};
    logEntries.push({source: "extra_pack", amount: deduct, packId: pack.packId ?? String(pack._idx)});
  }

  if (Array.isArray(clientData?.extraCredits)) {
    clientUpdate["extraCredits"] = allExtra;
  }

  return {valid: remaining === 0, logEntries, clientUpdate};
}

const createProjectWithReservation = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Verify caller is a client
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  if ((userSnap.data()?.role || "") !== "client") {
    throw new HttpsError("permission-denied", "Only clients can submit project requests.");
  }

  // Validate inputs
  const data = request.data || {};
  const clientId = data.clientId;
  const title = String(data.title || "").trim();
  const category = String(data.category || "").trim();
  const deliverableId = String(data.deliverableId || "").trim();
  const requestedCredits = Number(data.credits || 0);
  const description = String(data.description || "").trim();
  const briefModel = normalizeBriefModel(data);
  const brief = composeLegacyBrief(briefModel);
  const deadline = briefModel.deadline || String(data.deadline || "").trim();

  const inspirationFiles = Array.isArray(data.inspirationFiles) ? data.inspirationFiles : [];
  const brandAssets = Array.isArray(data.brandAssets) ? data.brandAssets : [];
  const brandAssetFiles = Array.isArray(data.brandAssetFiles) ? data.brandAssetFiles : brandAssets;
  const referenceFiles = Array.isArray(data.referenceFiles) && data.referenceFiles.length > 0 ?
    data.referenceFiles : [...inspirationFiles, ...brandAssetFiles];
  const briefQuality = computeBriefQuality({
    briefModel,
    description,
    referenceFiles,
    inspirationFiles,
    brandAssetFiles,
  });

  const templateId = typeof data.templateId === "string" && data.templateId.trim() ? data.templateId.trim() : null;
  const rawTemplateSnapshot = data.templateSnapshot && typeof data.templateSnapshot === "object" ? data.templateSnapshot : null;
  const templateSnapshot = rawTemplateSnapshot ? {
    title: String(rawTemplateSnapshot.title || "").trim(),
    category: String(rawTemplateSnapshot.category || "general").trim() || "general",
    suggestedBrief: String(rawTemplateSnapshot.suggestedBrief || "").trim(),
    description: String(rawTemplateSnapshot.description || "").trim(),
    tags: Array.isArray(rawTemplateSnapshot.tags) ? rawTemplateSnapshot.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [],
  } : null;

  if (!clientId || clientId !== uid) {
    throw new HttpsError("permission-denied", "clientId must match the authenticated user.");
  }
  if (!title) {
    throw new HttpsError("invalid-argument", "Project title is required.");
  }
  if (!category) {
    throw new HttpsError("invalid-argument", "Service category is required.");
  }
  if (!deliverableId) {
    throw new HttpsError("invalid-argument", "Deliverable type is required.");
  }

  // Load tier config (cached; falls back to local config/tiers.js)
  const tierConfig = await getTierConfig(db);

  // Active project count query — outside transaction (accepted small race window;
  // Firestore does not support queries inside transactions)
  const activeSnap = await db.collection("projects")
      .where("clientId", "==", uid)
      .where("status", "in", ACTIVE_PROJECT_STATUSES)
      .get();
  const activeCount = activeSnap.size;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const clientRef = db.collection("clients").doc(uid);
  const categoryRef = db.collection("serviceCategories").doc(category);
  const deliverableRef = db.collection("designDeliverables").doc(deliverableId);
  const projectRef = db.collection("projects").doc();
  const projectId = projectRef.id;
  const templateRef = templateId ? db.collection("briefingTemplates").doc(templateId) : null;

  await db.runTransaction(async (tx) => {
    // --- All reads first (admin SDK requirement) ---
    const [
      clientSnap,
      categorySnap,
      deliverableSnap,
      templateSnap,
    ] = await Promise.all([
      tx.get(clientRef),
      tx.get(categoryRef),
      tx.get(deliverableRef),
      templateRef ? tx.get(templateRef) : Promise.resolve(null),
    ]);

    if (!clientSnap.exists) {
      throw new HttpsError("not-found", "Client profile not found.");
    }

    const categoryData = categorySnap.exists ? categorySnap.data() : null;
    if (!categoryData || categoryData.active === false) {
      throw new HttpsError("invalid-argument", "Selected service category is unavailable.");
    }

    if (!deliverableSnap.exists) {
      throw new HttpsError("invalid-argument", "Selected deliverable not found.");
    }

    const deliverableData = deliverableSnap.data() || {};
    if (deliverableData.active === false) {
      throw new HttpsError("invalid-argument", "Selected deliverable is unavailable.");
    }
    if (String(deliverableData.category || "") !== category) {
      throw new HttpsError("invalid-argument", "Selected deliverable does not belong to the chosen category.");
    }

    const estimatedCredits = Number(deliverableData.typicalCredits || 0);
    if (!Number.isFinite(estimatedCredits) || estimatedCredits <= 0) {
      throw new HttpsError("failed-precondition", "Deliverable credits are not configured.");
    }
    if (Number.isFinite(requestedCredits) && requestedCredits > 0 && requestedCredits !== estimatedCredits) {
      throw new HttpsError("invalid-argument", "Selected deliverable credits are out of date. Please reselect deliverable.");
    }

    const clientData = clientSnap.data() || {};
    const tier = String(clientData?.subscription?.tier || "starter").toLowerCase();
    const tierEntry = tierConfig[tier] || tierConfig["starter"] || {maxActiveRequests: 1};
    const maxActiveRequests = Number(
        tierEntry?.maxActiveRequests ??
        tierEntry?.activeRequestLimit ??
        1,
    );

    if (activeCount >= maxActiveRequests) {
      throw new HttpsError(
          "resource-exhausted",
          `Active request limit reached (${activeCount}/${maxActiveRequests} for ${tier} plan).`,
      );
    }

    const reservation = computeReservation(clientData, estimatedCredits);
    if (!reservation.valid) {
      throw new HttpsError("failed-precondition", "Insufficient credits to create this project.");
    }

    let finalTemplateSnapshot = null;
    if (templateRef) {
      if (!templateSnap || !templateSnap.exists) {
        throw new HttpsError("invalid-argument", "Selected briefing template not found.");
      }
      const templateData = templateSnap.data() || {};
      finalTemplateSnapshot = templateSnapshot || {
        title: String(templateData.title || "").trim(),
        category: String(templateData.category || "general").trim() || "general",
        suggestedBrief: String(templateData.suggestedBrief || "").trim(),
        description: String(templateData.description || "").trim(),
        tags: Array.isArray(templateData.tags) ? templateData.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [],
      };
    }

    const deliverablesSummary = briefModel.deliverables || deliverableData.title || "";
    const normalizedBriefModel = {
      ...briefModel,
      deliverables: deliverablesSummary,
      deadline: deadline || briefModel.deadline || "",
    };

    // --- All writes after reads ---
    const memberRef = projectRef.collection("members").doc(uid);
    const activityRef = projectRef.collection("activities").doc();
    const notifRef = db.collection("notifications").doc();

    tx.set(projectRef, {
      projectId,
      clientId: uid,
      createdBy: uid,
      title,
      category,
      categoryTitle: String(categoryData.title || category),
      deliverableId,
      deliverableType: String(deliverableData.title || deliverableId),
      deliverableTitle: String(deliverableData.title || deliverableId),
      clientSubscriptionTier: tier,
      complexity: String(deliverableData.complexity || "medium"),
      description,
      credits: estimatedCredits,
      estimatedCredits,
      requiredSkills: normalizeSkillTags(deliverableData.requiredSkills),
      internalWorkloadScore: Number(deliverableData.internalWorkloadScore || 0),
      brief: normalizedBriefModel,
      legacyBriefText: brief,
      structuredBrief: normalizedBriefModel,
      briefScore: Number(briefQuality.briefScore || 0),
      briefQualityFlag: Boolean(briefQuality.briefQualityFlag),
      briefScoreBreakdown: briefQuality.briefScoreBreakdown || null,
      instructions: normalizedBriefModel.projectOverview,
      usagePlatform: normalizedBriefModel.usagePlatform,
      templateId: templateId || null,
      templateSnapshot: finalTemplateSnapshot || null,
      confirmedCredits: null,
      actualCreditsUsed: null,
      creditsReserved: true,
      creditReservationStatus: "reserved",
      reservedCreditsAmount: estimatedCredits,
      reservedAt: now,
      creditsConsumed: 0,
      creativeEarning: null,
      payoutStatus: "not_calculated",
      clientRevenue: null,
      creativeCost: null,
      projectMargin: null,
      status: "pending_confirmation",
      workflowStatus: "pending",
      assignmentStatus: "unassigned",
      assignmentScore: null,
      assignmentReason: "",
      assignmentBreakdown: null,
      revisionCount: 0,
      revisionRate: 0,
      revisionFlag: false,
      delayRisk: false,
      assignedCreativeId: null,
      assignedCreativeIds: [],
      workspaceNotes: "",
      inspirationFiles,
      brandAssets: brandAssetFiles,
      brandAssetFiles,
      referenceFiles,
      previewFiles: [],
      finalFiles: [],
      sourceFiles: [],
      allowedUploadFormats: ALLOWED_UPLOAD_FORMATS,
      clientRating: null,
      ratingsHistory: [],
      deadline: parseDeadline(deadline),
      createdAt: now,
      updatedAt: now,
    });

    tx.set(memberRef, {
      uid,
      role: "client_owner",
      status: "active",
      displayName: null,
      email: null,
      addedBy: uid,
      addedAt: now,
      updatedAt: now,
    }, {merge: true});

    tx.set(activityRef, {
      type: "project_created",
      message: "Project request submitted and credits reserved",
      actorId: uid,
      actorRole: "client",
      actorDisplayName: null,
      actorEmail: null,
      createdAt: now,
    });

    tx.set(notifRef, {
      recipientId: uid,
      projectId,
      relatedIds: {},
      type: "project_update",
      channels: {inApp: true, email: true, sms: false},
      title: "Project request submitted",
      message: `${title} is pending admin confirmation before creative assignment.`,
      read: false,
      createdAt: now,
      updatedAt: now,
    });

    // Deduct credits on client doc
    tx.update(clientRef, {
      ...reservation.clientUpdate,
      updatedAt: now,
    });

    // Write one credit transaction log entry per deduction source
    for (const entry of reservation.logEntries) {
      const txLogRef = db.collection("creditTransactions").doc();
      tx.set(txLogRef, {
        clientId: uid,
        projectId,
        type: "deduction",
        source: entry.source,
        packId: entry.packId,
        amount: entry.amount,
        description: `Reserved ${entry.amount} credit(s) for project "${title}"`,
        createdAt: now,
      });
    }

    if (templateRef) {
      tx.update(templateRef, {
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });
    }
  });

  const created = await projectRef.get();
  const estimatedCredits = Number(created.data()?.estimatedCredits || 0);
  return {projectId, estimatedCredits};
});

module.exports = {createProjectWithReservation};
