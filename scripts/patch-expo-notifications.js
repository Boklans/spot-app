const fs = require('fs');
const path = require('path');

/**
 * Patches critical Android native crash bugs in expo-notifications@57.0.21:
 * 1. NotificationsService.kt line 646 uses `intent.action === NOTIFICATION_EVENT_ACTION`
 *    (referential pointer equality instead of structural string equality `==`).
 *    When an Intent is delivered via Android Binder IPC (`context.sendBroadcast`),
 *    `intent.action` is a newly allocated String from Parcel, so `===` evaluates to false
 *    and throws an uncaught IllegalArgumentException on a worker thread, crashing the app.
 * 2. Wraps `onReceive` worker thread in `catch (e: Throwable)` so background notification
 *    BroadcastReceiver intents can never crash the Android application process.
 */
function patchExpoNotifications() {
  const servicePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-notifications',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'notifications',
    'service',
    'NotificationsService.kt'
  );

  if (!fs.existsSync(servicePath)) {
    console.log('[patch-expo-notifications] NotificationsService.kt not found, skipping.');
    return;
  }

  let content = fs.readFileSync(servicePath, 'utf8');
  let modified = false;

  if (content.includes('intent.action === NOTIFICATION_EVENT_ACTION')) {
    content = content.replace(
      'intent.action === NOTIFICATION_EVENT_ACTION',
      'intent.action == NOTIFICATION_EVENT_ACTION'
    );
    modified = true;
  }

  const unsafeOnReceive = `      try {
        intent?.run { handleIntent(context, intent) }
      } finally {
        pendingIntent.finish()
      }`;

  const safeOnReceive = `      try {
        intent?.run { handleIntent(context, intent) }
      } catch (e: Throwable) {
        Log.e("expo-notifications", "Unhandled error in NotificationsService", e)
      } finally {
        pendingIntent.finish()
      }`;

  if (content.includes(unsafeOnReceive)) {
    content = content.replace(unsafeOnReceive, safeOnReceive);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(servicePath, content, 'utf8');
    console.log('[patch-expo-notifications] Successfully patched NotificationsService.kt');
  } else {
    console.log('[patch-expo-notifications] NotificationsService.kt already patched.');
  }
}

try {
  patchExpoNotifications();
} catch (err) {
  console.warn('[patch-expo-notifications] Warning:', err);
}

