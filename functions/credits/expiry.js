const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

function validPackCredits(pack, nowMillis) {
  const expiryMillis = toMillis(pack?.expiryDate);
  const remaining = Number(pack?.creditsRemaining || 0);
  return expiryMillis > nowMillis && remaining > 0;
}

function currentBalancesFromClient(data, nowMillis) {
  const subscriptionCredits = Number(data?.subscription?.creditsRemaining || 0);
  const extraCredits = (Array.isArray(data?.extraCredits) ? data.extraCredits : [])
      .filter((pack) => validPackCredits(pack, nowMillis))
      .reduce((sum, pack) => sum + Number(pack.creditsRemaining || 0), 0);

  return {
    subscriptionCredits,
    extraCredits,
    totalCredits: subscriptionCredits + extraCredits,
  };
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const role = snap.data()?.role || "";
  return role === "admin" || role === "super_admin";
}

async function expireCreditPacks() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const clientsSnap = await db.collection("clients").get();

  let clientsUpdated = 0;
  let packsExpired = 0;
  let creditsExpired = 0;

  for (const clientSnap of clientsSnap.docs) {
    const data = clientSnap.data() || {};
    const extraCredits = Array.isArray(data.extraCredits) ? data.extraCredits : [];
    if (extraCredits.length === 0) continue;

    const remainingPacks = [];
    const expiredPacks = [];

    for (const pack of extraCredits) {
      const hasExpired = toMillis(pack?.expiryDate) <= nowMillis;
      if (hasExpired) expiredPacks.push(pack);
      else remainingPacks.push(pack);
    }

    if (expiredPacks.length === 0) continue;

    const balances = currentBalancesFromClient(data, nowMillis);
    let runningBalance = balances.totalCredits;

    const batch = db.batch();
    batch.update(clientSnap.ref, {
      extraCredits: remainingPacks,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    for (const pack of expiredPacks) {
      const lostCredits = Number(pack?.creditsRemaining || 0);
      packsExpired += 1;
      if (lostCredits <= 0) continue;

      creditsExpired += lostCredits;
      const txRef = db.collection("creditTransactions").doc();
      batch.set(txRef, {
        clientId: clientSnap.id,
        projectId: null,
        type: "expiry",
        source: "extra_pack",
        amount: lostCredits,
        creditsAmount: lostCredits,
        balanceBefore: runningBalance,
        balanceAfter: Math.max(0, runningBalance - lostCredits),
        packId: pack?.packId || null,
        expiryDate: pack?.expiryDate || null,
        description: `Expired extra pack (${lostCredits} credits lost)`,
        createdAt: now,
        createdBy: "system",
      });

      runningBalance = Math.max(0, runningBalance - lostCredits);
    }

    await batch.commit();
    clientsUpdated += 1;
  }

  return {
    clientsUpdated,
    packsExpired,
    creditsExpired,
  };
}

const runExpiredCreditPackCleanup = onSchedule({
  schedule: "0 3 * * *",
  timeZone: "Africa/Nairobi",
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => expireCreditPacks());

const triggerExpiredCreditPackCleanup = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const allowed = await isAdmin(request.auth.uid);
  if (!allowed) {
    throw new HttpsError("permission-denied", "Only admins can run pack expiry cleanup.");
  }
  const result = await expireCreditPacks();
  return {ok: true, ...result};
});

module.exports = {
  runExpiredCreditPackCleanup,
  triggerExpiredCreditPackCleanup,
};
