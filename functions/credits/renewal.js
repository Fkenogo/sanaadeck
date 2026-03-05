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

function addDays(timestamp, days) {
  return admin.firestore.Timestamp.fromMillis(timestamp.toMillis() + days * 24 * 60 * 60 * 1000);
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const role = snap.data()?.role || "";
  return role === "admin" || role === "super_admin";
}

async function runMonthlyCreditAllocation() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const clientsSnap = await db.collection("clients")
      .where("subscription.status", "==", "active")
      .get();

  let processedClients = 0;
  let allocatedClients = 0;
  let totalAllocatedCredits = 0;

  for (const clientSnap of clientsSnap.docs) {
    processedClients += 1;
    const data = clientSnap.data() || {};
    const renewalDate = data?.subscription?.renewalDate;
    if (!renewalDate || toMillis(renewalDate) > nowMillis) continue;

    const tier = data?.subscription?.tier || "starter";
    const creditsPerMonth = Number(data?.subscription?.creditsPerMonth || 0);
    const balances = currentBalancesFromClient(data, nowMillis);
    const nextTotalCredits = creditsPerMonth + balances.extraCredits;
    const nextPeriodEnd = addDays(now, 30);

    const batch = db.batch();
    batch.update(clientSnap.ref, {
      ["subscription.creditsUsed"]: 0,
      ["subscription.creditsRemaining"]: creditsPerMonth,
      ["subscription.currentPeriodStart"]: now,
      ["subscription.currentPeriodEnd"]: nextPeriodEnd,
      ["subscription.renewalDate"]: nextPeriodEnd,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const txRef = db.collection("creditTransactions").doc();
    batch.set(txRef, {
      clientId: clientSnap.id,
      projectId: null,
      type: "allocation",
      source: "subscription",
      amount: creditsPerMonth,
      creditsAmount: creditsPerMonth,
      balanceBefore: balances.totalCredits,
      balanceAfter: nextTotalCredits,
      description: `Monthly allocation: ${tier}`,
      createdAt: now,
      createdBy: "system",
    });

    await batch.commit();
    allocatedClients += 1;
    totalAllocatedCredits += creditsPerMonth;
  }

  return {
    processedClients,
    allocatedClients,
    totalAllocatedCredits,
  };
}

const runMonthlyCreditAllocationJob = onSchedule({
  schedule: "30 2 * * *",
  timeZone: "Africa/Nairobi",
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => runMonthlyCreditAllocation());

const triggerMonthlyCreditAllocationJob = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const allowed = await isAdmin(request.auth.uid);
  if (!allowed) {
    throw new HttpsError("permission-denied", "Only admins can run monthly credit allocation.");
  }
  const result = await runMonthlyCreditAllocation();
  return {ok: true, ...result};
});

module.exports = {
  runMonthlyCreditAllocation,
  runMonthlyCreditAllocationJob,
  triggerMonthlyCreditAllocationJob,
};
