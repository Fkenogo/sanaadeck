const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions/v2");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const pesapal = require("./payments/pesapal");
const digest = require("./notifications/digest");
const sendNotifications = require("./notifications/sendNotifications");
const ledger = require("./credits/ledger");
const expiry = require("./credits/expiry");
const renewal = require("./credits/renewal");
const {migrateWorkspaceData} = require("./workspace/migration");
const cps = require("./performance/cpsCalculator");

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  maxInstances: 10,
  region: "europe-west1",
});

exports.initiatePesapalPayment = pesapal.initiatePesapalPayment;
exports.pesapalIPN = pesapal.pesapalIPN;
exports.registerPesapalIPN = pesapal.registerPesapalIPN;
exports.checkPesapalPaymentStatus = pesapal.checkPesapalPaymentStatus;
exports.generateDailyNotificationDigest = digest.generateDailyNotificationDigest;
exports.triggerDailyNotificationDigest = digest.triggerDailyNotificationDigest;
exports.sendNotifications = sendNotifications.sendNotifications;
exports.sendgridEventsWebhook = sendNotifications.sendgridEventsWebhook;
exports.getCreditTransactionsPage = ledger.getCreditTransactionsPage;
exports.runExpiredCreditPackCleanup = expiry.runExpiredCreditPackCleanup;
exports.triggerExpiredCreditPackCleanup = expiry.triggerExpiredCreditPackCleanup;
exports.runMonthlyCreditAllocationJob = renewal.runMonthlyCreditAllocationJob;
exports.triggerMonthlyCreditAllocationJob = renewal.triggerMonthlyCreditAllocationJob;
exports.runMonthlyCPSCalculation = cps.runMonthlyCPSCalculation;
exports.triggerMonthlyCPSCalculation = cps.triggerMonthlyCPSCalculation;
exports.overrideCreativePerformanceReview = cps.overrideCreativePerformanceReview;
exports.runWorkspaceMigration = onCall({
  timeoutSeconds: 540,
  memory: "1GiB",
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = request.auth.uid;
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }

  const user = userSnap.data() || {};
  const role = user.role || "";
  const canRunMigration = role === "super_admin" ||
    (role === "admin" && Boolean(user.adminPermissions?.actions?.manage_admins));

  if (!canRunMigration) {
    throw new HttpsError("permission-denied", "Only super admins can run workspace migration.");
  }

  const requestedMax = Number(request.data?.maxProjects || 0);
  const maxProjects = Number.isFinite(requestedMax) && requestedMax > 0 ?
    Math.min(requestedMax, 5000) : 0;
  const startAfterId = typeof request.data?.startAfterId === "string" ?
    request.data.startAfterId.trim() : "";
  const pruneLegacy = Boolean(request.data?.pruneLegacy);

  const jobsRef = admin.firestore().collection("systemJobs");
  const jobRef = jobsRef.doc();
  await jobRef.set({
    type: "workspace_migration",
    status: "running",
    requestedBy: uid,
    requestedByRole: role,
    pruneLegacy,
    maxProjects,
    startAfterId: startAfterId || null,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const result = await migrateWorkspaceData({
      pruneLegacy,
      maxProjects,
      startAfterId,
    });

    await jobRef.set({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      result,
    }, {merge: true});

    return {
      ok: true,
      jobId: jobRef.id,
      ...result,
    };
  } catch (error) {
    await jobRef.set({
      status: "failed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: error?.message || "Workspace migration failed",
    }, {merge: true});
    throw error;
  }
});
