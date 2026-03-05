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

function monthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return {
    start: admin.firestore.Timestamp.fromDate(start),
    end: admin.firestore.Timestamp.fromDate(end),
    label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

function calculateCPSScore(metrics) {
  const averageRating = Number(metrics.averageRating || 0);
  const onTimeRate = Number(metrics.onTimeRate || 0);
  const revisionRate = Number(metrics.revisionRate || 0);
  const missedDeadlines = Number(metrics.missedDeadlines || 0);

  const ratingScore = Math.max(0, Math.min(40, (averageRating / 5) * 40));
  const onTimeScore = Math.max(0, Math.min(30, (onTimeRate / 100) * 30));
  const revisionScore = Math.max(0, Math.min(20, ((100 - revisionRate * 2) / 100) * 20));
  const missedDeadlineScore = Math.max(0, Math.min(10, ((100 - missedDeadlines * 20) / 100) * 10));

  return Math.max(0, Math.min(100, Number((ratingScore + onTimeScore + revisionScore + missedDeadlineScore).toFixed(2))));
}

function determineStatus(score) {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs_improvement";
  if (score >= 30) return "warning";
  return "probation";
}

function generateReviewNotes(status, metrics) {
  const notes = [];
  if (Number(metrics.averageRating || 0) < 4.2) notes.push("Client rating below target (4.2)");
  if (Number(metrics.onTimeRate || 0) < 95) notes.push("On-time delivery below target (95%)");
  if (Number(metrics.revisionRate || 0) > 35) notes.push("Revision rate above threshold (35%)");
  if (Number(metrics.missedDeadlines || 0) > 2) notes.push("Missed deadlines above monthly limit (2)");

  if (notes.length === 0) {
    return status === "excellent" ?
      "Outstanding monthly performance. Keep consistency high." :
      "Performance is on target for the current month.";
  }

  return `Focus areas: ${notes.join("; ")}.`;
}

async function checkTierPromotion(db, creativeId, currentScore) {
  const reviewsSnap = await db.collection("performanceReviews")
      .where("creativeId", "==", creativeId)
      .orderBy("createdAt", "desc")
      .limit(2)
      .get();

  const scores = [Number(currentScore), ...reviewsSnap.docs.map((doc) => Number(doc.data()?.cpsScore || 0))].slice(0, 3);
  return scores.length === 3 && scores.every((entry) => entry >= 90);
}

function calculateBonusEligibility(metrics, creditsCompleted) {
  return {
    fiveStar: Number(metrics.averageRating || 0) >= 4.8,
    fastTrack: Number(metrics.fastTrackCount || 0) > 0,
    volume: Number(creditsCompleted || 0) >= 20,
  };
}

async function issuePerformanceWarning(db, creativeId, status, score) {
  const creativeRef = db.collection("creatives").doc(creativeId);
  const warningEntry = {
    createdAt: admin.firestore.Timestamp.now(),
    status,
    score,
    message: `Performance warning: status ${status} with CPS ${score}.`,
  };

  await creativeRef.set({
    warnings: admin.firestore.FieldValue.arrayUnion(warningEntry),
    accountStatus: status === "probation" ? "probation" : "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  await db.collection("notifications").add({
    recipientId: creativeId,
    type: "performance_alert",
    title: "Performance Review Alert",
    message: `Your CPS score is ${score}. Current status: ${status}.`,
    channels: {inApp: true, email: true, sms: false},
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "system",
  });
}

async function promoteCreativeTier(db, creativeId, currentTier) {
  const next = currentTier === "junior" ? {tier: "mid", payoutRate: 9} :
    currentTier === "mid" ? {tier: "senior", payoutRate: 11} : null;

  if (!next) return null;

  await db.collection("creatives").doc(creativeId).set({
    tier: next.tier,
    payoutRate: next.payoutRate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  await db.collection("notifications").add({
    recipientId: creativeId,
    type: "system",
    title: "Tier Promotion",
    message: `Congratulations! You were promoted to ${next.tier}.`,
    channels: {inApp: true, email: true, sms: false},
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "system",
  });

  return next;
}

async function calculateMonthlyCPS() {
  const db = admin.firestore();
  const {start, end, label} = monthWindow();
  const creativesSnap = await db.collection("creatives").get();

  let processed = 0;
  let warningsIssued = 0;
  let promotions = 0;

  for (const creativeDoc of creativesSnap.docs) {
    processed += 1;
    const creativeId = creativeDoc.id;
    const creativeData = creativeDoc.data() || {};

    const projectsSnap = await db.collection("projects")
        .where("assignedCreativeId", "==", creativeId)
        .where("status", "==", "approved")
        .where("approvedAt", ">=", start)
        .where("approvedAt", "<", end)
        .get();

    const projects = projectsSnap.docs.map((doc) => doc.data() || {});
    const totalProjects = projects.length;
    const totalCredits = projects.reduce((sum, project) => sum + Number(project.actualCreditsUsed || project.confirmedCredits || 0), 0);
    const ratingValues = projects.map((project) => Number(project.clientRating?.rating || 0)).filter((value) => value > 0);
    const averageRating = ratingValues.length > 0 ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length : 0;

    let onTimeCount = 0;
    let revisionCount = 0;
    let missedDeadlines = 0;
    let fastTrackCount = 0;

    projects.forEach((project) => {
      const actualTurnaround = Number(project.actualTurnaroundHours || 0);
      const estimatedTurnaround = Number(project.estimatedTurnaroundHours || 0);
      const approvedAtMs = toMillis(project.approvedAt || project.updatedAt);
      const createdAtMs = toMillis(project.createdAt);
      const deadlineMs = toMillis(project.deadline);

      if (estimatedTurnaround > 0 && actualTurnaround > 0) {
        if (actualTurnaround <= estimatedTurnaround) onTimeCount += 1;
      } else if (deadlineMs > 0 && approvedAtMs > 0 && approvedAtMs <= deadlineMs) {
        onTimeCount += 1;
      }

      if (createdAtMs > 0 && approvedAtMs > 0) {
        const elapsedHours = (approvedAtMs - createdAtMs) / (1000 * 60 * 60);
        if (elapsedHours <= 24) fastTrackCount += 1;
      }

      revisionCount += Number(project.revisionCount || project.revisionRound || 0);

      if (deadlineMs > 0 && approvedAtMs > deadlineMs) {
        missedDeadlines += 1;
      }
    });

    const onTimeRate = totalProjects > 0 ? (onTimeCount / totalProjects) * 100 : 0;
    const revisionRate = totalProjects > 0 ? (revisionCount / totalProjects) * 100 : 0;

    const metrics = {
      totalProjects,
      totalCredits,
      averageRating: Number(averageRating.toFixed(2)),
      onTimeRate: Number(onTimeRate.toFixed(2)),
      revisionRate: Number(revisionRate.toFixed(2)),
      missedDeadlines,
      fastTrackCount,
    };

    const cpsScore = calculateCPSScore(metrics);
    const status = determineStatus(cpsScore);
    const bonusEligible = calculateBonusEligibility(metrics, totalCredits);
    const eligibleForPromotion = await checkTierPromotion(db, creativeId, cpsScore);
    const reviewNotes = generateReviewNotes(status, metrics);

    const reviewRef = db.collection("performanceReviews").doc();
    await reviewRef.set({
      creativeId,
      period: label,
      metrics,
      cpsScore,
      status,
      reviewNotes,
      bonusEligible,
      eligibleForPromotion,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "scheduler",
      manualOverride: null,
    });

    const previousCpsScore = Number(creativeData?.performance?.cpsScore || cpsScore);
    const consistency = Number(creativeData?.bonusProgress?.consistencyStreak || 0);
    const nextConsistency = metrics.averageRating >= 4.5 ? consistency + 1 : 0;

    await db.collection("creatives").doc(creativeId).set({
      performance: {
        cpsScore,
        previousCpsScore,
        avgRating: metrics.averageRating,
        onTimeRate: metrics.onTimeRate,
        revisionRate: metrics.revisionRate,
        missedDeadlines: metrics.missedDeadlines,
        status,
        performanceTrend: cpsScore > previousCpsScore ? "up" : cpsScore < previousCpsScore ? "down" : "stable",
        lastCalculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      bonuses: {
        ...(creativeData?.bonuses || {}),
        fiveStar: bonusEligible.fiveStar,
        fastTrack: bonusEligible.fastTrack,
        volume: bonusEligible.volume,
        consistency: nextConsistency >= 3,
      },
      bonusProgress: {
        consistencyStreak: nextConsistency,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    if (status === "warning" || status === "probation") {
      warningsIssued += 1;
      await issuePerformanceWarning(db, creativeId, status, cpsScore);
    }

    if (eligibleForPromotion) {
      const promoted = await promoteCreativeTier(db, creativeId, String(creativeData?.tier || "mid").toLowerCase());
      if (promoted) promotions += 1;
    }
  }

  return {processed, warningsIssued, promotions};
}

const runMonthlyCPSCalculation = onSchedule({
  schedule: "0 2 1 * *",
  timeZone: "Africa/Nairobi",
  timeoutSeconds: 540,
  memory: "1GiB",
}, async () => calculateMonthlyCPS());

const triggerMonthlyCPSCalculation = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const userSnap = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }

  const user = userSnap.data() || {};
  const role = user.role || "";
  const canRun = role === "super_admin" || (role === "admin" && Boolean(user.adminPermissions?.actions?.manage_admins));
  if (!canRun) {
    throw new HttpsError("permission-denied", "Only admins can run CPS calculation.");
  }

  const result = await calculateMonthlyCPS();
  return {ok: true, ...result};
});

const overrideCreativePerformanceReview = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const userSnap = await admin.firestore().collection("users").doc(request.auth.uid).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const isPrivileged = user.role === "super_admin" || user.role === "admin";
  if (!isPrivileged) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const creativeId = String(request.data?.creativeId || "").trim();
  const reviewId = String(request.data?.reviewId || "").trim();
  const cpsScore = Number(request.data?.cpsScore);
  const status = String(request.data?.status || "").trim();
  const justification = String(request.data?.justification || "").trim();

  if (!creativeId || !reviewId) {
    throw new HttpsError("invalid-argument", "creativeId and reviewId are required.");
  }

  if (!Number.isFinite(cpsScore) || cpsScore < 0 || cpsScore > 100) {
    throw new HttpsError("invalid-argument", "cpsScore must be between 0 and 100.");
  }

  if (!status || !["excellent", "good", "needs_improvement", "warning", "probation"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid status value.");
  }

  if (!justification) {
    throw new HttpsError("invalid-argument", "justification is required.");
  }

  const db = admin.firestore();
  const reviewRef = db.collection("performanceReviews").doc(reviewId);
  const creativeRef = db.collection("creatives").doc(creativeId);

  await db.runTransaction(async (tx) => {
    const reviewSnap = await tx.get(reviewRef);
    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", "Performance review not found.");
    }
    const reviewData = reviewSnap.data() || {};
    const metrics = reviewData.metrics || {};

    tx.update(reviewRef, {
      cpsScore,
      status,
      manualOverride: {
        by: request.auth.uid,
        justification,
        at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(creativeRef, {
      performance: {
        cpsScore,
        avgRating: Number(metrics.averageRating || 0),
        onTimeRate: Number(metrics.onTimeRate || 0),
        revisionRate: Number(metrics.revisionRate || 0),
        missedDeadlines: Number(metrics.missedDeadlines || 0),
        status,
        lastCalculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  });

  return {ok: true};
});

module.exports = {
  calculateCPSScore,
  determineStatus,
  generateReviewNotes,
  calculateMonthlyCPS,
  runMonthlyCPSCalculation,
  triggerMonthlyCPSCalculation,
  overrideCreativePerformanceReview,
};
