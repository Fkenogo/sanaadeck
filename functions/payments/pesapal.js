const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

// Pesapal Configuration (firebase-functions v7 compatible)
const PESAPAL_CONSUMER_KEY = getEnv("PESAPAL_CONSUMER_KEY");
const PESAPAL_CONSUMER_SECRET = getEnv("PESAPAL_CONSUMER_SECRET");
const PESAPAL_ENV = getEnv("PESAPAL_ENV") || "live"; // 'live' or 'sandbox'
const PESAPAL_IPN_ID = getEnv("PESAPAL_IPN_ID");
const APP_URL = getEnv("APP_URL");

const PESAPAL_API_URL = PESAPAL_ENV === "live" ?
  "https://pay.pesapal.com/v3" :
  "https://cybqa.pesapal.com/pesapalv3";

/**
 * Request a bearer auth token from Pesapal for subsequent API calls.
 * @return {Promise<string>} Pesapal bearer token.
 * @example
 * const token = await getPesapalAuthToken();
 */
async function getPesapalAuthToken() {
  if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
    throw new Error("Missing Pesapal credentials: set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET");
  }

  try {
    const response = await axios.post(`${PESAPAL_API_URL}/api/Auth/RequestToken`, {
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET,
    }, {
      headers: {"Content-Type": "application/json"},
    });

    return response.data.token;
  } catch (error) {
    console.error("Pesapal auth error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Pesapal");
  }
}

/**
 * Register the platform IPN callback URL in Pesapal (one-time setup endpoint).
 * @param {import("firebase-functions").https.Request} req - Express request object.
 * @param {import("firebase-functions").Response} res - Express response object.
 * @return {Promise<void>} JSON response with registered IPN details.
 * @example
 * // HTTP: GET/POST /registerPesapalIPN
 */
exports.registerPesapalIPN = functions.https.onRequest(async (req, res) => {
  try {
    if (!APP_URL) {
      return res.status(500).json({success: false, error: "Missing APP_URL environment variable"});
    }
    const token = await getPesapalAuthToken();
    const ipnUrl = `${APP_URL}/api/pesapal-ipn`;

    const response = await axios.post(
        `${PESAPAL_API_URL}/api/URLSetup/RegisterIPN`,
        {
          url: ipnUrl,
          ipn_notification_type: "POST",
        },
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
    );

    console.log("IPN registered:", response.data);

    res.json({
      success: true,
      ipn_id: response.data.ipn_id,
      url: ipnUrl,
    });
  } catch (error) {
    console.error("IPN registration error:", error.response?.data || error.message);
    res.status(500).json({success: false, error: error.message});
  }
});

/**
 * Create a payment record and initiate checkout with Pesapal.
 * @param {object} data - Callable payload from client.
 * @param {string} data.clientId - Client profile document ID.
 * @param {number} data.amount - Charge amount in local currency.
 * @param {string} data.currency - ISO currency code.
 * @param {string} data.email - Payer email address.
 * @param {string} [data.phoneNumber] - Payer phone in international format.
 * @param {string} [data.firstName] - Payer first name.
 * @param {string} [data.lastName] - Payer last name.
 * @param {string} [data.reason] - Human-readable payment reason.
 * @param {string} [data.country] - Country code (KE/UG/RW/BI/TZ).
 * @param {string} [data.tier] - Subscription tier where relevant.
 * @param {("subscription"|"extra_credits"|"one_off_bundle")} [data.paymentType]
 * Payment type classifier.
 * @param {import("firebase-functions").https.CallableContext} context - Callable context.
 * @return {Promise<{success: boolean, paymentId: string, redirectUrl: string, orderTrackingId: string, message: string}>}
 * Checkout initialization payload.
 * @example
 * const fn = httpsCallable(functions, 'initiatePesapalPayment')
 * const res = await fn({ clientId, amount: 48860, currency: 'KES', email, paymentType: 'subscription' })
 */
exports.initiatePesapalPayment = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const {
    clientId,
    amount,
    currency,
    email,
    phoneNumber,
    firstName,
    lastName,
    reason,
    country,
    tier,
    paymentType, // 'subscription' | 'extra_credits' | 'one_off_bundle'
  } = data;

  // Validate inputs
  if (!clientId || !amount || !currency || !email) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  try {
    if (!APP_URL || !PESAPAL_IPN_ID) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "Missing APP_URL or PESAPAL_IPN_ID environment variable",
      );
    }

    const token = await getPesapalAuthToken();

    // Create payment record first
    const paymentRef = admin.firestore().collection("payments").doc();
    const paymentId = paymentRef.id;

    // Prepare order request
    const orderRequest = {
      id: paymentId, // Use Firestore payment ID as merchant reference
      currency: currency,
      amount: parseFloat(amount),
      description: reason || `SanaaDeck ${tier || "Subscription"}`,
      callback_url: `${APP_URL}/payment-success?payment_id=${paymentId}`,
      notification_id: PESAPAL_IPN_ID,
      billing_address: {
        email_address: email,
        phone_number: phoneNumber || "",
        country_code: country || "KE",
        first_name: firstName || email.split("@")[0],
        last_name: lastName || "",
        line_1: "",
        line_2: "",
        city: "",
        state: "",
        postal_code: "",
        zip_code: "",
      },
    };

    console.log("Submitting Pesapal order:", orderRequest);

    // Submit order to Pesapal
    const response = await axios.post(
        `${PESAPAL_API_URL}/api/Transactions/SubmitOrderRequest`,
        orderRequest,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
    );

    console.log("Pesapal response:", response.data);

    // Save payment record
    await paymentRef.set({
      paymentId,
      clientId,
      type: paymentType,
      tier: tier || null,
      amount,
      currency,
      country: country || null,
      paymentMethod: "pesapal",
      provider: "pesapal",
      transactionRef: response.data.order_tracking_id,
      merchantRef: response.data.merchant_reference,
      status: "pending",
      callbackReceived: false,
      initiatedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      providerResponse: response.data,
      email,
      phoneNumber: phoneNumber || null,
    });

    return {
      success: true,
      paymentId,
      redirectUrl: response.data.redirect_url,
      orderTrackingId: response.data.order_tracking_id,
      message: "Payment initiated. Redirecting to Pesapal...",
    };
  } catch (error) {
    console.error("Pesapal payment error:", error.response?.data || error.message);
    throw new functions.https.HttpsError("internal", `Payment initiation failed: ${error.message}`);
  }
});

/**
 * Receive Pesapal IPN callbacks, fetch final transaction status, and update payment state.
 * @param {import("firebase-functions").https.Request} req - HTTP callback request body from Pesapal.
 * @param {import("firebase-functions").Response} res - HTTP callback response.
 * @return {Promise<void>} Plain text acknowledgement response.
 * @example
 * // HTTP POST callback invoked by Pesapal with OrderTrackingId.
 */
exports.pesapalIPN = functions.https.onRequest(async (req, res) => {
  console.log("Pesapal IPN received:", JSON.stringify(req.body));

  try {
    const {OrderTrackingId, OrderMerchantReference} = req.body;

    if (!OrderTrackingId) {
      console.error("Missing OrderTrackingId in IPN");
      return res.status(400).send("Missing OrderTrackingId");
    }

    // Get auth token
    const token = await getPesapalAuthToken();

    // Get transaction status from Pesapal
    const statusResponse = await axios.get(
        `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
    );

    const status = statusResponse.data;
    console.log("Transaction status:", status);

    // Find payment record by merchant reference (our payment ID)
    const paymentId = OrderMerchantReference || status.merchant_reference;

    if (!paymentId) {
      console.error("Cannot find payment ID from IPN");
      return res.status(404).send("Payment ID not found");
    }

    const paymentRef = admin.firestore().collection("payments").doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      console.error("Payment not found:", paymentId);
      return res.status(404).send("Payment not found");
    }

    const paymentData = paymentDoc.data();

    // Check payment status
    const paymentStatus = status.payment_status_description || status.status_code;

    if (paymentStatus === "Completed" || status.payment_status_code === 1) {
      // Payment successful
      await paymentRef.update({
        status: "completed",
        completedAt: admin.firestore.Timestamp.now(),
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        transactionRef: status.confirmation_code || OrderTrackingId,
        paymentMethod: status.payment_method || "pesapal",
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log("Payment completed:", paymentId);

      // Process payment based on type
      if (paymentData.type === "subscription") {
        await handleSubscriptionPayment(paymentData.clientId, paymentId, paymentData);
      } else if (paymentData.type === "extra_credits") {
        await handleExtraCreditsPayment(paymentData.clientId, paymentId, paymentData);
      } else if (paymentData.type === "one_off_bundle") {
        await handleOneOffBundlePayment(paymentData.clientId, paymentId, paymentData);
      }

      // Send success notification
      await sendPaymentNotification(
          paymentData.clientId,
          "success",
          paymentData.amount,
          paymentData.currency,
      );
    } else if (paymentStatus === "Failed" || status.payment_status_code === 2) {
      // Payment failed
      await paymentRef.update({
        status: "failed",
        failedAt: admin.firestore.Timestamp.now(),
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        failureReason: status.description || "Payment failed",
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log("Payment failed:", paymentId);

      // Send failure notification
      await sendPaymentNotification(
          paymentData.clientId,
          "failed",
          paymentData.amount,
          paymentData.currency,
          status.description,
      );
    } else {
      // Payment still pending or other status
      await paymentRef.update({
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log("Payment status:", paymentStatus);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Pesapal IPN error:", error);
    res.status(500).send("Internal error");
  }
});

/**
 * Apply successful subscription payment effects to client account and credit ledger.
 * @param {string} clientId - Client profile ID.
 * @param {string} paymentId - Payment document ID.
 * @param {{amount: number, currency: string}} paymentData - Persisted payment metadata.
 * @return {Promise<void>} Resolves after profile and transaction updates.
 * @example
 * await handleSubscriptionPayment(clientId, paymentId, { amount: 48860, currency: 'KES' })
 */
async function handleSubscriptionPayment(clientId, paymentId, paymentData) {
  const clientRef = admin.firestore().collection("clients").doc(clientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    throw new Error("Client not found");
  }

  const data = clientDoc.data();
  const subscription = data.subscription;

  // Extend subscription period by 30 days
  const newPeriodStart = admin.firestore.Timestamp.now();
  const newPeriodEnd = admin.firestore.Timestamp.fromMillis(
      newPeriodStart.toMillis() + (30 * 24 * 60 * 60 * 1000),
  );

  await clientRef.update({
    "subscription.status": "active",
    "subscription.currentPeriodStart": newPeriodStart,
    "subscription.currentPeriodEnd": newPeriodEnd,
    "subscription.renewalDate": newPeriodEnd,
    "subscription.creditsUsed": 0,
    "subscription.creditsRemaining": subscription.creditsPerMonth,
    "updatedAt": admin.firestore.Timestamp.now(),
  });

  // Log credit allocation
  await admin.firestore().collection("creditTransactions").add({
    clientId,
    projectId: null,
    type: "allocation",
    creditsAmount: subscription.creditsPerMonth,
    balanceBefore: 0,
    balanceAfter: subscription.creditsPerMonth,
    description: `Monthly credit allocation: ${subscription.tier} plan - ${paymentData.currency} ${paymentData.amount}`,
    paymentId,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: "system",
  });

  console.log(`Subscription renewed for client ${clientId}`);
}

/**
 * Apply successful extra-credit payment and append a new expiring pack.
 * @param {string} clientId - Client profile ID.
 * @param {string} paymentId - Payment document ID.
 * @param {{amount: number, currency: string}} paymentData - Persisted payment metadata.
 * @return {Promise<void>} Resolves after pack and ledger updates.
 * @example
 * await handleExtraCreditsPayment(clientId, paymentId, { amount: 35000, currency: 'KES' })
 */
async function handleExtraCreditsPayment(clientId, paymentId, paymentData) {
  const clientRef = admin.firestore().collection("clients").doc(clientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    throw new Error("Client not found");
  }

  const data = clientDoc.data();
  const extraCredits = data.extraCredits || [];

  // Create new credit pack (10 credits)
  const newPack = {
    packId: `pack_${Date.now()}`,
    credits: 10,
    purchaseDate: admin.firestore.Timestamp.now(),
    expiryDate: admin.firestore.Timestamp.fromMillis(
        Date.now() + (30 * 24 * 60 * 60 * 1000),
    ),
    creditsUsed: 0,
    creditsRemaining: 10,
    paymentId,
    amount: paymentData.amount,
    currency: paymentData.currency,
  };

  await clientRef.update({
    extraCredits: [...extraCredits, newPack],
    updatedAt: admin.firestore.Timestamp.now(),
  });

  // Log credit transaction
  await admin.firestore().collection("creditTransactions").add({
    clientId,
    projectId: null,
    type: "extra_pack_purchase",
    creditsAmount: 10,
    packId: newPack.packId,
    expiryDate: newPack.expiryDate,
    description: `Purchased 10 extra credits - ${paymentData.currency} ${paymentData.amount}`,
    paymentId,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: "system",
  });

  console.log(`Extra credits added for client ${clientId}`);
}

/**
 * Handle one-off bundle fulfillment (currently mapped to extra-credit behavior).
 * @param {string} clientId - Client profile ID.
 * @param {string} paymentId - Payment document ID.
 * @param {{amount: number, currency: string}} paymentData - Persisted payment metadata.
 * @return {Promise<void>} Resolves when bundle effects have been applied.
 * @example
 * await handleOneOffBundlePayment(clientId, paymentId, { amount: 35000, currency: 'KES' })
 */
async function handleOneOffBundlePayment(clientId, paymentId, paymentData) {
  // Same as extra credits for now
  await handleExtraCreditsPayment(clientId, paymentId, paymentData);
}

/**
 * Create an in-app payment notification after success or failure.
 * @param {string} clientId - Client profile ID.
 * @param {"success"|"failed"} status - Payment outcome.
 * @param {number} amount - Transaction amount.
 * @param {string} currency - Transaction currency code.
 * @param {?string} [errorMessage] - Optional failure detail text.
 * @return {Promise<void>} Resolves when notification document is written.
 * @example
 * await sendPaymentNotification(clientId, 'success', 48860, 'KES')
 */
async function sendPaymentNotification(clientId, status, amount, currency, errorMessage = null) {
  const clientDoc = await admin.firestore().collection("clients").doc(clientId).get();
  const clientData = clientDoc.data();

  const userDoc = await admin.firestore().collection("users").doc(clientData.userId).get();
  const userData = userDoc.data();

  const title = status === "success" ?
    "Payment Successful" :
    "Payment Failed";

  const message = status === "success" ?
    `Your payment of ${currency} ${amount.toLocaleString()} has been received successfully.` :
    `Your payment of ${currency} ${amount.toLocaleString()} failed. ${errorMessage || "Please try again."}`;

  await admin.firestore().collection("notifications").add({
    notificationId: `notif_${Date.now()}`,
    userId: userData.uid,
    type: "payment_reminder",
    title,
    message,
    channels: {
      inApp: true,
      email: true,
      sms: false,
    },
    read: false,
    dismissed: false,
    emailSent: false,
    smsSent: false,
    createdAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Query Pesapal for current payment state by order tracking ID.
 * @param {{orderTrackingId: string}} data - Callable payload.
 * @param {import("firebase-functions").https.CallableContext} context - Callable context.
 * @return {Promise<{success: boolean, status: object}>} Status payload from Pesapal.
 * @example
 * const fn = httpsCallable(functions, 'checkPesapalPaymentStatus')
 * const result = await fn({ orderTrackingId })
 */
exports.checkPesapalPaymentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const {orderTrackingId} = data;

  if (!orderTrackingId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing orderTrackingId");
  }

  try {
    const token = await getPesapalAuthToken();

    const response = await axios.get(
        `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
    );

    return {
      success: true,
      status: response.data,
    };
  } catch (error) {
    console.error("Status check error:", error);
    throw new functions.https.HttpsError("internal", "Failed to check payment status");
  }
});
