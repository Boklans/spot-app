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
 * 3. Patches TopicSubscriptionModule.android.js so missing ExpoTopicSubscriptionModule in Expo Go
 *    does not crash the JavaScript bundle at top-level module evaluation time.
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

  if (fs.existsSync(servicePath)) {
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

  // Patch TopicSubscriptionModule.android.js for Expo Go compatibility
  const topicModulePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-notifications',
    'build',
    'TopicSubscriptionModule.android.js'
  );

  if (fs.existsSync(topicModulePath)) {
    let topicContent = fs.readFileSync(topicModulePath, 'utf8');
    if (!topicContent.includes('requireOptionalNativeModule')) {
      topicContent = `import { requireOptionalNativeModule } from 'expo';
const module = requireOptionalNativeModule('ExpoTopicSubscriptionModule') || {
  subscribeToTopicAsync: async () => {},
  unsubscribeFromTopicAsync: async () => {},
};
export default module;
`;
      fs.writeFileSync(topicModulePath, topicContent, 'utf8');
      console.log('[patch-expo-notifications] Successfully patched TopicSubscriptionModule.android.js');
    }
  }

  // Patch ExpoApplication.js for Expo Go compatibility
  const appModulePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-application',
    'build',
    'ExpoApplication.js'
  );

  if (fs.existsSync(appModulePath)) {
    let appContent = fs.readFileSync(appModulePath, 'utf8');
    if (!appContent.includes('requireOptionalNativeModule')) {
      appContent = `import { requireOptionalNativeModule } from 'expo';
const module = requireOptionalNativeModule('ExpoApplication') || {
  applicationId: 'com.spot.app',
  applicationName: 'SPOT',
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  getInstallationIdAsync: async () => 'installation-id',
  getAndroidId: () => 'android-id',
};
export default module;
`;
      fs.writeFileSync(appModulePath, appContent, 'utf8');
      console.log('[patch-expo-notifications] Successfully patched ExpoApplication.js');
    }
  }
}

try {
  patchExpoNotifications();
} catch (err) {
  console.warn('[patch-expo-notifications] Warning:', err);
}

