const admin = require("firebase-admin");

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function validPackCredits(pack, nowMillis) {
  const expiryMillis = toMillis(pack.expiryDate);
  const remaining = Number(pack.creditsRemaining || 0);
  return expiryMillis > nowMillis && remaining > 0;
}

function currentBalancesFromClient(clientData, nowMillis) {
  const subscriptionCredits = Number(clientData?.subscription?.creditsRemaining || 0);
  const extraCredits = (Array.isArray(clientData?.extraCredits) ? clientData.extraCredits : [])
      .filter((pack) => validPackCredits(pack, nowMillis))
      .reduce((sum, pack) => sum + Number(pack.creditsRemaining || 0), 0);
  return {
    subscriptionCredits,
    extraCredits,
    totalCredits: subscriptionCredits + extraCredits,
  };
}

async function grantExtraCredits({clientId, paymentId, creditsAmount}) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();

  const clientRef = db.collection("clients").doc(clientId);

  await db.runTransaction(async (tx) => {
    const clientSnap = await tx.get(clientRef);

    if (!clientSnap.exists) {
      throw new Error("Client not found for extra credit allocation");
    }

    const clientData = clientSnap.data() || {};
    const extraCredits = Array.isArray(clientData.extraCredits) ?
      [...clientData.extraCredits] : [];
    const balances = currentBalancesFromClient(clientData, nowMillis);

    const unused = extraCredits
        .filter((pack) => validPackCredits(pack, nowMillis))
        .reduce((sum, pack) => sum + Number(pack.creditsRemaining || 0), 0);

    if (unused + creditsAmount > 20) {
      throw new Error("Cannot exceed 20 unused extra credits");
    }

    const packId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiryDate = admin.firestore.Timestamp.fromMillis(
        nowMillis + (30 * 24 * 60 * 60 * 1000),
    );

    const newPack = {
      packId,
      credits: creditsAmount,
      purchaseDate: now,
      expiryDate,
      creditsUsed: 0,
      creditsRemaining: creditsAmount,
      paymentId,
    };

    const nextExtraCredits = [...extraCredits, newPack];

    tx.update(clientRef, {
      extraCredits: nextExtraCredits,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const txRef = db.collection("creditTransactions").doc();
    tx.set(txRef, {
      clientId,
      projectId: null,
      type: "extra_pack_purchase",
      source: "extra_pack",
      amount: creditsAmount,
      creditsAmount,
      balanceBefore: balances.totalCredits,
      balanceAfter: balances.totalCredits + creditsAmount,
      packId,
      expiryDate,
      description: `Purchased extra pack (${creditsAmount} credits)`,
      createdAt: now,
      createdBy: "system",
    });
  });
}

async function handleSubscriptionPayment({clientId, paymentId}) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const clientRef = db.collection("clients").doc(clientId);

  await db.runTransaction(async (tx) => {
    const clientSnap = await tx.get(clientRef);
    if (!clientSnap.exists) {
      throw new Error("Client not found for subscription payment");
    }

    const clientData = clientSnap.data() || {};
    const currentTier = clientData?.subscription?.tier || "starter";
    const creditsPerMonth = Number(clientData?.subscription?.creditsPerMonth || 0);
    const balances = currentBalancesFromClient(clientData, nowMillis);
    const nextPeriodEnd = admin.firestore.Timestamp.fromMillis(
        nowMillis + (30 * 24 * 60 * 60 * 1000),
    );
    const nextTotal = creditsPerMonth + balances.extraCredits;

    tx.update(clientRef, {
      ["subscription.status"]: "active",
      ["subscription.currentPeriodStart"]: now,
      ["subscription.currentPeriodEnd"]: nextPeriodEnd,
      ["subscription.renewalDate"]: nextPeriodEnd,
      ["subscription.creditsUsed"]: 0,
      ["subscription.creditsRemaining"]: creditsPerMonth,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(db.collection("creditTransactions").doc(), {
      clientId,
      projectId: null,
      type: "allocation",
      source: "subscription",
      amount: creditsPerMonth,
      creditsAmount: creditsPerMonth,
      balanceBefore: balances.totalCredits,
      balanceAfter: nextTotal,
      description: `Subscription renewal allocation (${currentTier})`,
      createdAt: now,
      createdBy: "system",
      paymentId,
    });
  });
}

async function sendPaymentNotification({
  clientId,
  status,
  amount,
  errorMessage,
  paymentId,
  provider,
  reason,
}) {
  if (!clientId) return;
  const success = status === "completed";
  const title = success ? "Payment confirmed" : "Payment failed";
  const message = success ?
    `Your ${provider || "payment"} for ${reason || "transaction"} (${amount}) was successful.` :
    `Your ${provider || "payment"} for ${reason || "transaction"} failed. ${errorMessage || "Please retry."}`;

  await admin.firestore().collection("notifications").add({
    recipientId: clientId,
    type: success ? "system" : "payment_reminder",
    title,
    message,
    relatedIds: {
      paymentId: paymentId || null,
      clientId,
    },
    channels: {
      inApp: true,
      email: true,
      sms: false,
    },
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "system",
  });
}

async function applySuccessfulPayment(paymentDoc) {
  const data = paymentDoc.data();

  if (!data) {
    throw new Error("Payment payload missing");
  }

  if (data.reason === "subscription_renewal") {
    await handleSubscriptionPayment({
      clientId: data.clientId,
      paymentId: paymentDoc.id,
    });
    return;
  }

  if (data.reason === "extra_credits" || data.reason === "bundle_purchase") {
    const creditsAmount = Number(data.metadata?.creditsAmount || 10);
    await grantExtraCredits({
      clientId: data.clientId,
      paymentId: paymentDoc.id,
      creditsAmount,
    });
  }
}

module.exports = {
  applySuccessfulPayment,
  handleSubscriptionPayment,
  sendPaymentNotification,
};
