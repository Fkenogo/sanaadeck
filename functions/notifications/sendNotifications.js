const admin = require("firebase-admin");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onRequest} = require("firebase-functions/v2/https");

function timestampNow() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function htmlTemplate({title, message, unsubscribeUrl}) {
  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.4;">
      <h2 style="margin:0 0 8px 0;">${title}</h2>
      <p style="margin:0 0 12px 0;">${message}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">
        You can manage notification preferences in your account settings.
      </p>
      <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">
        Unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a>
      </p>
    </div>
  `;
}

async function sendEmailViaSendGrid({
  to,
  subject,
  text,
  html,
  customArgs = {},
}) {
  const apiKey = normalizeString(process.env.SENDGRID_API_KEY);
  const fromEmail = normalizeString(process.env.SENDGRID_FROM_EMAIL);
  if (!apiKey || !fromEmail) {
    return {status: "skipped", reason: "sendgrid_not_configured"};
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{to: [{email: to}]}],
      from: {email: fromEmail},
      subject,
      content: [
        {type: "text/plain", value: text},
        {type: "text/html", value: html},
      ],
      tracking_settings: {
        click_tracking: {enable: true, enable_text: true},
        open_tracking: {enable: true},
      },
      custom_args: customArgs,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid failed (${response.status}): ${body}`);
  }
  return {status: "sent"};
}

async function sendSmsViaAfricasTalking({to, message}) {
  const apiKey = normalizeString(process.env.AFRICAS_TALKING_API_KEY);
  const username = normalizeString(process.env.AFRICAS_TALKING_USERNAME);
  if (!apiKey || !username) {
    return {status: "skipped", reason: "africas_talking_not_configured"};
  }

  const params = new URLSearchParams({
    username,
    to,
    message: String(message || "").slice(0, 160),
  });

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      "apiKey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: params.toString(),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Africa's Talking failed (${response.status}): ${bodyText}`);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch (error) {
    parsed = {};
  }

  const recipients = parsed?.SMSMessageData?.Recipients || [];
  const totalCostRaw = recipients.reduce((sum, recipient) => {
    const costText = String(recipient?.cost || "").replace(/[^\d.-]/g, "");
    const cost = Number(costText);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);

  return {status: "sent", totalCost: totalCostRaw, raw: parsed};
}

async function loadRecipientData(recipientId) {
  if (!recipientId) return null;
  const [userSnap, prefSnap] = await Promise.all([
    admin.firestore().collection("users").doc(recipientId).get(),
    admin.firestore().collection("userNotificationPreferences").doc(recipientId).get(),
  ]);

  return {
    user: userSnap.exists ? userSnap.data() : {},
    preferences: prefSnap.exists ? prefSnap.data() : {},
  };
}

const sendNotifications = onDocumentCreated(
    {
      document: "notifications/{notificationId}",
      region: "europe-west1",
    },
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) return null;

      const data = snapshot.data() || {};
      const notificationId = snapshot.id;
      const recipientId = data.recipientId || "";
      const channels = data.channels || {};
      const title = data.title || "SanaaDeck notification";
      const message = data.message || "";
      const unsubscribeUrl = normalizeString(process.env.NOTIFICATION_UNSUBSCRIBE_URL) ||
        "https://sanaadeck.com/notifications/preferences";

      const deliveryUpdate = {
        deliveryStatus: "processed",
        deliveryProcessedAt: timestampNow(),
        updatedAt: timestampNow(),
      };

      const recipientData = await loadRecipientData(recipientId);
      const user = recipientData?.user || {};
      const preferences = recipientData?.preferences || {};

      const emailEnabled = channels.email === true && preferences.emailEnabled !== false;
      const smsEnabled = channels.sms === true && preferences.smsEnabled !== false;

      if (emailEnabled) {
        try {
          if (!user.email) {
            deliveryUpdate.emailSent = false;
            deliveryUpdate.emailSkippedReason = "missing_recipient_email";
          } else {
            const result = await sendEmailViaSendGrid({
              to: user.email,
              subject: title,
              text: message,
              html: htmlTemplate({title, message, unsubscribeUrl}),
              customArgs: {
                notificationId,
                recipientId,
              },
            });
            if (result.status === "sent") {
              deliveryUpdate.emailSent = true;
              deliveryUpdate.emailSentAt = timestampNow();
            } else {
              deliveryUpdate.emailSent = false;
              deliveryUpdate.emailSkippedReason = result.reason;
            }
          }
        } catch (error) {
          deliveryUpdate.emailSent = false;
          deliveryUpdate.emailError = error.message || "email_send_failed";
          deliveryUpdate.deliveryStatus = "partial_failure";
        }
      } else {
        deliveryUpdate.emailSent = false;
        deliveryUpdate.emailSkippedReason = "disabled_or_not_requested";
      }

      if (smsEnabled) {
        try {
          if (!user.phoneNumber) {
            deliveryUpdate.smsSent = false;
            deliveryUpdate.smsSkippedReason = "missing_recipient_phone";
          } else {
            const result = await sendSmsViaAfricasTalking({
              to: user.phoneNumber,
              message,
            });
            if (result.status === "sent") {
              deliveryUpdate.smsSent = true;
              deliveryUpdate.smsSentAt = timestampNow();
              deliveryUpdate.smsCostEstimate = Number(result.totalCost || 0);
              deliveryUpdate.smsCurrency = "unknown";
            } else {
              deliveryUpdate.smsSent = false;
              deliveryUpdate.smsSkippedReason = result.reason;
            }
          }
        } catch (error) {
          deliveryUpdate.smsSent = false;
          deliveryUpdate.smsError = error.message || "sms_send_failed";
          deliveryUpdate.deliveryStatus = "partial_failure";
        }
      } else {
        deliveryUpdate.smsSent = false;
        deliveryUpdate.smsSkippedReason = "disabled_or_not_requested";
      }

      await admin.firestore().collection("notifications").doc(notificationId).set(deliveryUpdate, {merge: true});
      return {ok: true, notificationId};
    },
);

module.exports = {
  sendNotifications,
  sendgridEventsWebhook: onRequest(
      {
        region: "europe-west1",
      },
      async (req, res) => {
        if (req.method !== "POST") {
          res.status(405).json({ok: false, error: "method_not_allowed"});
          return;
        }

        const events = Array.isArray(req.body) ? req.body : [];
        if (events.length === 0) {
          res.status(200).json({ok: true, processed: 0});
          return;
        }

        const grouped = new Map();
        events.forEach((entry) => {
          const args = entry?.custom_args || {};
          const notificationId = args.notificationId || entry?.notificationId;
          if (!notificationId) return;
          if (!grouped.has(notificationId)) grouped.set(notificationId, []);
          grouped.get(notificationId).push(entry);
        });

        const db = admin.firestore();
        const updates = [];

        for (const [notificationId, items] of grouped.entries()) {
          const payload = {
            updatedAt: timestampNow(),
            emailEventsLastSyncedAt: timestampNow(),
          };

          let opens = 0;
          let clicks = 0;
          let delivered = false;

          items.forEach((entry) => {
            const eventType = String(entry?.event || "").toLowerCase();
            if (eventType === "open") opens += 1;
            if (eventType === "click") clicks += 1;
            if (eventType === "delivered") delivered = true;
          });

          if (delivered) payload.emailDeliveredAt = timestampNow();
          if (opens > 0) payload.emailOpenCount = admin.firestore.FieldValue.increment(opens);
          if (clicks > 0) payload.emailClickCount = admin.firestore.FieldValue.increment(clicks);

          updates.push(
              db.collection("notifications").doc(notificationId).set(payload, {merge: true}),
          );
        }

        await Promise.all(updates);
        res.status(200).json({ok: true, processed: updates.length});
      },
  ),
};
