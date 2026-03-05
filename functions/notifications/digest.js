const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

function digestDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const role = snap.data()?.role || "";
  return role === "admin" || role === "super_admin";
}

async function createDailyDigests() {
  const db = admin.firestore();
  const snapshot = await db.collection("notifications")
      .where("read", "==", false)
      .get();

  if (snapshot.empty) {
    return {totalRecipients: 0, createdDigests: 0, sourceNotifications: 0};
  }

  const byRecipient = new Map();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const recipientId = data.recipientId;
    if (!recipientId) return;
    if (!byRecipient.has(recipientId)) byRecipient.set(recipientId, []);
    byRecipient.get(recipientId).push({id: docSnap.id, ...data});
  });

  const dateKey = digestDateKey();
  const batch = db.batch();
  let createdDigests = 0;

  for (const [recipientId, entries] of byRecipient.entries()) {
    const digestId = `${recipientId}_${dateKey}`;
    const digestRef = db.collection("notificationDigests").doc(digestId);

    const existing = await digestRef.get();
    if (existing.exists) continue;

    const sample = entries
        .sort((a, b) => {
          const am = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
          const bm = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
          return bm - am;
        })
        .slice(0, 5)
        .map((entry) => ({
          notificationId: entry.id,
          title: entry.title || "",
          message: entry.message || "",
          createdAt: entry.createdAt || null,
          type: entry.type || "general",
        }));

    batch.set(digestRef, {
      recipientId,
      dateKey,
      totalUnread: entries.length,
      sample,
      channel: "in_app",
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(db.collection("notifications").doc(), {
      recipientId,
      title: "Daily notification digest",
      message: `You have ${entries.length} unread updates today.`,
      type: "digest",
      read: false,
      digestRef: digestId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "system_digest",
    });

    createdDigests += 1;
  }

  if (createdDigests > 0) {
    await batch.commit();
  }

  return {
    totalRecipients: byRecipient.size,
    createdDigests,
    sourceNotifications: snapshot.size,
  };
}

const generateDailyNotificationDigest = onSchedule({
  schedule: "0 6 * * *",
  timeZone: "Africa/Nairobi",
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  return createDailyDigests();
});

const triggerDailyNotificationDigest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const allowed = await isAdmin(request.auth.uid);
  if (!allowed) {
    throw new HttpsError("permission-denied", "Only admins can trigger digest jobs.");
  }
  const result = await createDailyDigests();
  return {ok: true, ...result};
});

module.exports = {
  generateDailyNotificationDigest,
  triggerDailyNotificationDigest,
};
