const admin = require("firebase-admin");

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_BATCH_LIMIT = 450;

function toTimestamp(value) {
  if (!value) return admin.firestore.Timestamp.now();
  if (value instanceof admin.firestore.Timestamp) return value;
  if (typeof value.toDate === "function") {
    try {
      return admin.firestore.Timestamp.fromDate(value.toDate());
    } catch (error) {
      return admin.firestore.Timestamp.now();
    }
  }
  if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return admin.firestore.Timestamp.now();
  return admin.firestore.Timestamp.fromDate(parsed);
}

function normalizeVersion(entry, index) {
  if (typeof entry === "string") {
    return {
      id: `legacy_version_${index + 1}`,
      url: entry,
      note: null,
      version: `v${index + 1}`,
      versionNumber: index + 1,
      createdBy: "migration",
      createdByRole: "system",
      createdAt: admin.firestore.Timestamp.now(),
      migratedFromLegacy: true,
    };
  }

  const explicitNumber = Number(entry.versionNumber || 0);
  const parsedFromLabel = Number(String(entry.version || "").replace(/\D+/g, ""));
  const versionNumber = explicitNumber > 0 ?
    explicitNumber : (parsedFromLabel > 0 ? parsedFromLabel : index + 1);

  return {
    id: entry.id || `legacy_version_${index + 1}`,
    url: entry.url || "",
    note: entry.note || null,
    version: entry.version || `v${versionNumber}`,
    versionNumber,
    createdBy: entry.createdBy || "migration",
    createdByRole: entry.createdByRole || "system",
    createdAt: toTimestamp(entry.createdAt),
    migratedFromLegacy: true,
  };
}

function normalizeComment(entry, index) {
  return {
    id: entry.id || `legacy_comment_${index + 1}`,
    content: entry.content || "",
    authorId: entry.authorId || "unknown",
    authorRole: entry.authorRole || "unknown",
    parentId: entry.parentId || null,
    status: entry.status || "needs_attention",
    mentions: Array.isArray(entry.mentions) ? entry.mentions : [],
    createdAt: toTimestamp(entry.createdAt),
    updatedAt: entry.updatedAt ? toTimestamp(entry.updatedAt) : null,
    migratedFromLegacy: true,
  };
}

function normalizeActivity(entry, index) {
  return {
    id: entry.id || `legacy_activity_${index + 1}`,
    type: entry.type || "legacy_activity",
    message: entry.message || "Legacy activity",
    actorId: entry.actorId || "system",
    actorRole: entry.actorRole || "system",
    createdAt: toTimestamp(entry.createdAt),
    migratedFromLegacy: true,
  };
}

function normalizeNote(entry, index) {
  return {
    id: entry.id || `legacy_note_${index + 1}`,
    content: entry.content || "",
    authorId: entry.authorId || "unknown",
    authorRole: entry.authorRole || "unknown",
    createdAt: toTimestamp(entry.createdAt),
    migratedFromLegacy: true,
  };
}

async function migrateProjectDoc(projectDoc, options = {}) {
  const db = admin.firestore();
  const pruneLegacy = Boolean(options.pruneLegacy);
  const batchLimit = Number(options.batchLimit || DEFAULT_BATCH_LIMIT);

  const projectData = projectDoc.data();
  const projectRef = projectDoc.ref;
  const notesCol = projectRef.collection("notes");
  const commentsCol = projectRef.collection("comments");
  const versionsCol = projectRef.collection("versions");
  const activitiesCol = projectRef.collection("activities");

  const legacyNotes = Array.isArray(projectData.workspaceNotesLog) ? projectData.workspaceNotesLog : [];
  const legacyComments = Array.isArray(projectData.comments) ? projectData.comments : [];
  const legacyVersions = Array.isArray(projectData.deliverableLinks) ? projectData.deliverableLinks : [];
  const legacyActivities = Array.isArray(projectData.activityFeed) ? projectData.activityFeed : [];

  let batch = db.batch();
  let operations = 0;
  let inserted = 0;

  async function flushBatch() {
    if (operations === 0) return;
    await batch.commit();
    batch = db.batch();
    operations = 0;
  }

  function queueSet(ref, payload) {
    batch.set(ref, payload, {merge: true});
    operations += 1;
    inserted += 1;
  }

  for (let i = 0; i < legacyNotes.length; i += 1) {
    const note = normalizeNote(legacyNotes[i], i);
    queueSet(notesCol.doc(note.id), note);
    if (operations >= batchLimit) await flushBatch();
  }

  for (let i = 0; i < legacyComments.length; i += 1) {
    const comment = normalizeComment(legacyComments[i], i);
    queueSet(commentsCol.doc(comment.id), comment);
    if (operations >= batchLimit) await flushBatch();
  }

  for (let i = 0; i < legacyVersions.length; i += 1) {
    const version = normalizeVersion(legacyVersions[i], i);
    if (!version.url) continue;
    queueSet(versionsCol.doc(version.id), version);
    if (operations >= batchLimit) await flushBatch();
  }

  for (let i = 0; i < legacyActivities.length; i += 1) {
    const activity = normalizeActivity(legacyActivities[i], i);
    queueSet(activitiesCol.doc(activity.id), activity);
    if (operations >= batchLimit) await flushBatch();
  }

  batch.update(projectRef, {
    workspaceDataMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
    workspaceDataMigrationVersion: 1,
    ...(pruneLegacy ?
      {
        workspaceNotesLog: [],
        comments: [],
        deliverableLinks: [],
        activityFeed: [],
      } : {}),
  });
  operations += 1;
  await flushBatch();

  return {
    inserted,
    hasLegacyData: legacyNotes.length + legacyComments.length +
      legacyVersions.length + legacyActivities.length > 0,
  };
}

async function migrateWorkspaceData(options = {}) {
  const db = admin.firestore();
  const pageSize = Number(options.pageSize || DEFAULT_PAGE_SIZE);
  const maxProjects = Math.max(0, Number(options.maxProjects || 0));
  const startAfterId = typeof options.startAfterId === "string" ?
    options.startAfterId.trim() : "";

  let lastDoc = null;
  let lastProcessedDocId = "";
  let scanned = 0;
  let migratedProjects = 0;
  let totalInserted = 0;
  let firstPage = true;

  let hasNextPage = true;
  while (hasNextPage) {
    let q = db.collection("projects")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(pageSize);
    if (firstPage && startAfterId) {
      q = q.startAfter(startAfterId);
    } else if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const page = await q.get();
    if (page.empty) {
      hasNextPage = false;
      continue;
    }

    for (const projectDoc of page.docs) {
      scanned += 1;
      lastProcessedDocId = projectDoc.id;
      const result = await migrateProjectDoc(projectDoc, options);
      if (result.hasLegacyData) {
        migratedProjects += 1;
        totalInserted += result.inserted;
      }
      if (maxProjects > 0 && scanned >= maxProjects) {
        return {
          scanned,
          migratedProjects,
          totalInserted,
          reachedLimit: true,
          nextCursor: lastProcessedDocId || null,
          pruneLegacy: Boolean(options.pruneLegacy),
        };
      }
    }

    firstPage = false;
    lastDoc = page.docs[page.docs.length - 1];
    hasNextPage = page.size >= pageSize;
  }

  return {
    scanned,
    migratedProjects,
    totalInserted,
    reachedLimit: false,
    nextCursor: null,
    pruneLegacy: Boolean(options.pruneLegacy),
  };
}

module.exports = {
  migrateWorkspaceData,
};
