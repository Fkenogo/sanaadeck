# Notification System Updates (Mar 4, 2026)

## Scope
Implemented and aligned the notification system with Prompt 11 requirements:
- In-app notification center with unread badge and filtering.
- Notification service expansion (create, mark read, mark all read, unread count).
- Notification hook for real-time subscriptions.
- Cloud Function trigger for email/SMS delivery handling.
- Notification preference controls (in-app/email/sms) with Firestore persistence.

## Added
- `src/components/notifications/NotificationCenter.jsx`
- `src/hooks/useNotifications.js`
- `functions/notifications/sendNotifications.js`

## Updated
- `src/services/notificationService.js`
  - Added:
    - `createNotification(userId, type, title, message, relatedIds, channels)`
    - `markAsRead(notificationId)` (alias)
    - `markAllAsRead(userId)` (alias)
    - `getUnreadCount(userId)`
    - `getPreferences(userId)`
    - `upsertPreferences(userId, preferences)`
    - Template builders:
      - `buildProjectUpdateTemplate`
      - `buildPaymentReminderTemplate`
      - `buildCreditLowTemplate`
      - `buildPerformanceAlertTemplate`
  - Kept backward-compatible methods:
    - `markNotificationRead`
    - `markAllNotificationsRead`
    - `subscribeToUserNotifications`
- `src/components/notifications/NotificationsPanel.jsx`
  - Added type filter UI.
  - Added notification channel preferences UI.
- `src/components/dashboard/ClientDashboard.jsx`
  - Integrated `NotificationCenter` into header.
  - Migrated notification state handling to `useNotifications`.
  - Added notification preference load/save.
- `src/components/dashboard/CreativeDashboard.jsx`
  - Integrated `NotificationCenter` into header.
  - Migrated notification state handling to `useNotifications`.
  - Added notification preference load/save.
- `src/components/dashboard/AdminDashboard.jsx`
  - Integrated `NotificationCenter` into header (super/admin personal inbox access).
- `src/services/adminService.js`
  - Standardized admin-sent notification types/channels.
- `src/services/projectService.js`
  - Notification payload now supports `type`, `channels`, `relatedIds`.
- `functions/index.js`
  - Exported `sendNotifications` trigger.
- `firestore.rules`
  - Added `/userNotificationPreferences/{uid}` access rules.

## Real-time behavior
- `useNotifications` uses Firestore `onSnapshot` for live updates.
- Unread badge updates automatically.
- Optional auto-mark-read on notifications module open.
- Desktop notifications supported via browser permission in `NotificationCenter`.

## Delivery channels
- In-app: always supported.
- Email: SendGrid via Cloud Function (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`).
- SMS: Africa's Talking via Cloud Function (`AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME`).
- Function writes delivery fields back to notification docs:
  - `emailSent`, `emailSentAt`, `emailError`, `emailSkippedReason`
  - `smsSent`, `smsSentAt`, `smsError`, `smsSkippedReason`
  - `smsCostEstimate`, `smsCurrency`
  - `deliveryStatus`, `deliveryProcessedAt`

## SendGrid event tracking
- Added HTTP function export:
  - `sendgridEventsWebhook` in `functions/notifications/sendNotifications.js`
- Accepts SendGrid event webhook payloads and updates notification-level metrics:
  - `emailDeliveredAt`
  - `emailOpenCount`
  - `emailClickCount`
  - `emailEventsLastSyncedAt`
- Uses `custom_args.notificationId` attached during email send to map events back to notification docs.

## Validation
- Frontend lint: passed (`npm run lint`)
- Frontend build: passed (`npm run build`)
- Functions lint: passed (`npm --prefix functions run lint`)

## Notes
- Existing dashboard notification module behavior is preserved.
- This was implemented without major dashboard architecture changes.

## 2026-03-04 Alignment Pass
- Optimized unread counting in `notificationService.getUnreadCount(...)` to use Firestore `count()` with `read == false` filter.
- Hardened delivery function `functions/notifications/sendNotifications.js`:
  - email delivery now skips cleanly when recipient email is missing (`missing_recipient_email`)
  - SMS delivery now skips cleanly when recipient phone is missing (`missing_recipient_phone`)
  - preserves partial failure semantics without throwing avoidable provider errors.
