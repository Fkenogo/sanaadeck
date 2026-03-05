const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

function toTimestamp(value, endOfDay = false) {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value;
  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // For date-only filters (YYYY-MM-DD), include entire end day when requested.
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parsed.setHours(23, 59, 59, 999);
  }
  return admin.firestore.Timestamp.fromDate(parsed);
}

async function getUserRole(uid) {
  if (!uid) return "";
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  if (!userSnap.exists) return "";
  return userSnap.data()?.role || "";
}

const getCreditTransactionsPage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = request.auth.uid;
  const role = await getUserRole(uid);
  const isAdmin = role === "admin" || role === "super_admin";
  const isClient = role === "client";

  if (!isAdmin && !isClient) {
    throw new HttpsError("permission-denied", "Role not allowed for ledger access.");
  }

  const pageSizeRaw = Number(request.data?.pageSize || 50);
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
  const cursorMillis = Number(request.data?.cursorMillis || 0);
  const filters = request.data?.filters || {};

  let q = admin.firestore()
      .collection("creditTransactions")
      .orderBy("createdAt", "desc");

  if (isClient) {
    q = q.where("clientId", "==", uid);
  } else if (filters.clientId) {
    q = q.where("clientId", "==", String(filters.clientId));
  }

  if (filters.type) {
    q = q.where("type", "==", String(filters.type));
  }

  if (filters.source) {
    q = q.where("source", "==", String(filters.source));
  }

  const fromTs = toTimestamp(filters.fromDate);
  const toTs = toTimestamp(filters.toDate, true);
  if (fromTs) {
    q = q.where("createdAt", ">=", fromTs);
  }
  if (toTs) {
    q = q.where("createdAt", "<=", toTs);
  }

  if (cursorMillis > 0) {
    q = q.startAfter(admin.firestore.Timestamp.fromMillis(cursorMillis));
  }

  q = q.limit(pageSize);
  const snapshot = await q.get();
  const items = snapshot.docs.map((entry) => {
    const data = entry.data() || {};
    return {
      id: entry.id,
      ...data,
      createdAtMillis: typeof data.createdAt?.toMillis === "function" ?
        data.createdAt.toMillis() : null,
    };
  });

  const last = items.length > 0 ? items[items.length - 1] : null;
  return {
    items,
    nextCursorMillis: last?.createdAtMillis || null,
    hasMore: items.length >= pageSize,
  };
});

module.exports = {
  getCreditTransactionsPage,
};
