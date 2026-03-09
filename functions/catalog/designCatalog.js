const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

function canReadCatalog(userRole) {
  return ["client", "creative", "admin", "super_admin"].includes(userRole);
}

const getDesignCatalog = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }

  const role = userSnap.data()?.role || "";
  if (!canReadCatalog(role)) {
    throw new HttpsError("permission-denied", "You do not have access to the design catalog.");
  }

  let categoriesSnap;
  let deliverablesSnap;
  try {
    [categoriesSnap, deliverablesSnap] = await Promise.all([
      db.collection("serviceCategories").where("active", "==", true).get(),
      db.collection("designDeliverables").where("active", "==", true).get(),
    ]);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("permission")) {
      throw new HttpsError("permission-denied", "Service catalog read is not permitted.");
    }
    if (message.includes("index")) {
      throw new HttpsError("failed-precondition", "Service catalog indexes are not ready.");
    }
    throw new HttpsError("unavailable", "Service catalog is temporarily unavailable.");
  }

  const categories = categoriesSnap.docs
      .map((entry) => ({id: entry.id, ...entry.data()}))
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  // Client-safe projection: do not expose internal workload metadata.
  const deliverables = deliverablesSnap.docs
      .map((entry) => {
        const data = entry.data() || {};
        return {
          id: entry.id,
          title: data.title || "",
          category: data.category || "",
          description: data.description || "",
          typicalCredits: Number(data.typicalCredits || 0),
          complexity: data.complexity || "medium",
          dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
          allowedFormats: Array.isArray(data.allowedFormats) ? data.allowedFormats : [],
          active: data.active !== false,
        };
      })
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  return {categories, deliverables};
});

module.exports = {
  getDesignCatalog,
};
