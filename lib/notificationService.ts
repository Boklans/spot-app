import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { translateExercise, translateWorkoutName } from '@/lib/i18n';
import { calculateMuscleRecovery, normalizeMuscleGroup } from '@/lib/recoveryEngine';
import { formatWeight } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getScheduledWorkout } from '@/store/programProgressStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore, type AppLanguage } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding } from '@/store/workoutStore';
import type { UserProgram, UserWorkout } from '@/types/userProgram';
import type { CompletedWorkout } from '@/types/workout';

const NOTIFICATION_CHANNEL_ID = 'workout-reminders';
const REST_TIMER_CHANNEL_ID = 'rest-timer-channel';
// Fresh v2 silent channel ID so Android does not reuse cached HIGH importance settings
const LIVE_SESSION_CHANNEL_ID = 'spot-live-workout-silent-v2';
const REMINDER_ID_PREFIX = 'spot-workout-reminder-';
export const REST_TIMER_NOTIFICATION_ID = 'spot-rest-timer';
export const ACTIVE_REST_NOTIFICATION_ID = 'spot-active-rest-notification';
export const ACTIVE_SESSION_NOTIFICATION_ID = 'spot-active-workout-session';

export const REST_ACTION_CATEGORY_ID = 'rest-timer-actions';
export const ACTIVE_SET_CATEGORY_ID = 'active-workout-set-actions';

export const ACTION_SUB_15S = 'ACTION_SUB_15S';
export const ACTION_ADD_30S = 'ACTION_ADD_30S';
export const ACTION_SKIP_REST = 'ACTION_SKIP_REST';
export const ACTION_COMPLETE_SET = 'ACTION_COMPLETE_SET';
export const ACTION_OPEN_WORKOUT = 'ACTION_OPEN_WORKOUT';

// Day key to Expo weekday number (1 = Sunday, 2 = Monday, ..., 7 = Saturday)
const DAY_KEY_TO_EXPO_WEEKDAY: Record<string, number> = {
  SUN: 1,
  MON: 2,
  TUE: 3,
  WED: 4,
  THU: 5,
  FRI: 6,
  SAT: 7,
};

let isHandlerConfigured = false;
let isResponseListenerConfigured = false;
let isLiveSyncConfigured = false;
let restEndTransitionTimeout: ReturnType<typeof setTimeout> | null = null;
let syncDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let lastScheduledRestEndTimestamp: number | null = null;
let lastSyncedShadeSignature: string | null = null;
let lastCategoriesLang: AppLanguage | null = null;

function formatTimerClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(mins)}:${pad(secs)}`;
}

function formatEndTimeClock(timestampMs: number, lang: AppLanguage): string {
  try {
    return new Date(timestampMs).toLocaleTimeString(lang === 'uk' ? 'uk-UA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export async function setupNotificationCategories(lang: AppLanguage = 'uk'): Promise<void> {
  if (Platform.OS === 'web') return;
  if (lastCategoriesLang === lang) return;
  lastCategoriesLang = lang;
  try {
    // 1. Category when Rest Timer is active: [-15s] [+30s] [Skip]
    await Notifications.setNotificationCategoryAsync(REST_ACTION_CATEGORY_ID, [
      {
        identifier: ACTION_SUB_15S,
        buttonTitle: lang === 'uk' ? '-15 сек' : '-15s',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_ADD_30S,
        buttonTitle: lang === 'uk' ? '+30 сек' : '+30s',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_SKIP_REST,
        buttonTitle: lang === 'uk' ? 'Пропустити' : 'Skip',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    // 2. Category when Active Set is in progress: [✓ Complete Set] [Open Workout]
    await Notifications.setNotificationCategoryAsync(ACTIVE_SET_CATEGORY_ID, [
      {
        identifier: ACTION_COMPLETE_SET,
        buttonTitle: lang === 'uk' ? '✓ Завершити сет' : '✓ Complete Set',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_OPEN_WORKOUT,
        buttonTitle: lang === 'uk' ? 'До тренування' : 'Open Workout',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  } catch {
    // Fail gracefully on web/unsupported
  }
}

async function handleNotificationAction(actionIdentifier: string, data?: Record<string, any>): Promise<void> {
  try {
    if (actionIdentifier === ACTION_SUB_15S) {
      useWorkoutSessionStore.getState().addRestTime(-15);
      await syncActiveWorkoutNotification(true);
      return;
    }

    if (actionIdentifier === ACTION_ADD_30S) {
      useWorkoutSessionStore.getState().addRestTime(30);
      await syncActiveWorkoutNotification(true);
      return;
    }

    if (actionIdentifier === ACTION_SKIP_REST) {
      useWorkoutSessionStore.getState().skipRest();
      await cancelRestTimerNotification();
      await syncActiveWorkoutNotification(true);
      return;
    }

    if (actionIdentifier === ACTION_COMPLETE_SET) {
      useWorkoutSessionStore.getState().completeCurrentSet();
      const updatedSession = useWorkoutSessionStore.getState().session;
      if (updatedSession && updatedSession.completed) {
        await dismissActiveWorkoutNotification();
        await finalizeWorkoutSession(updatedSession);
        router.replace('/workout/complete');
      } else {
        await syncActiveWorkoutNotification(true);
      }
      return;
    }

    const targetScreen = data?.screen;
    if (
      actionIdentifier === ACTION_OPEN_WORKOUT ||
      actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
      targetScreen === '/workout/active' ||
      targetScreen === '/workout/rest'
    ) {
      const session = useWorkoutSessionStore.getState().session;
      if (session && !session.completed) {
        router.replace('/workout/active');
      } else {
        router.replace('/(tabs)');
      }
    } else if (targetScreen === '/(tabs)' || data?.isTest || data?.workoutName) {
      router.replace('/(tabs)');
    }
  } catch {
    // Ignore navigation errors on background tap
  }
}

function setupNotificationResponseListener(): void {
  if (Platform.OS === 'web' || isResponseListenerConfigured) return;
  isResponseListenerConfigured = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    const actionIdentifier = response.actionIdentifier;
    const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
    void handleNotificationAction(actionIdentifier, data);
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      const actionIdentifier = response.actionIdentifier;
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      void handleNotificationAction(actionIdentifier, data);
    })
    .catch(() => undefined);
}

/**
 * Configure notifications handler and Android notification channels.
 */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  setupNotificationResponseListener();

  if (!isHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // While user is actively in the app, NEVER pop up any banner or alert over the screen!
        if (AppState.currentState === 'active') {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
        const id = notification.request.identifier;
        const isSilentShadeUpdate =
          id === ACTIVE_SESSION_NOTIFICATION_ID || id === ACTIVE_REST_NOTIFICATION_ID;
        const isRestFinishedAlert = id === REST_TIMER_NOTIFICATION_ID;
        const isAppInForeground = AppState.currentState === 'active';

        // 1. Live ongoing shade card: NEVER pop up a banner or play sound; only sit quietly in the shade list
        if (isSilentShadeUpdate) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: true,
          };
        }

        // 2. Rest timer completion alert: if user is already looking at the app in foreground,
        // the in-app timer already plays the sound & haptic, so don't double-popup a banner over the screen
        if (isRestFinishedAlert && isAppInForeground) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
    isHandlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Workout Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C8FF3D',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
        name: 'Rest Timer Alert',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#C8FF3D',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync(LIVE_SESSION_CHANNEL_ID, {
        name: 'Active Workout Status (Silent)',
        importance: Notifications.AndroidImportance.LOW,
        enableVibrate: false,
        showBadge: false,
        lightColor: '#C8FF3D',
        sound: null,
      });
    } catch {
      // Ignore Android channel errors
    }
  }
}

/**
 * Request notification permissions from the OS.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Natural language muscle naming in Ukrainian / English.
 */
function getMuscleDisplayName(muscle: string, lang: AppLanguage): string {
  const lower = muscle.trim().toLowerCase();
  if (lang === 'uk') {
    switch (lower) {
      case 'chest':
      case 'pecs':
      case 'pectorals':
        return 'груди';
      case 'triceps':
        return 'трицепс';
      case 'biceps':
        return 'біцепс';
      case 'arms':
      case 'forearms':
        return 'руки';
      case 'back':
      case 'lats':
      case 'traps':
      case 'upper back':
      case 'lower back':
        return 'спина';
      case 'legs':
        return 'ноги';
      case 'quads':
      case 'quadriceps':
        return 'квадрицепси';
      case 'hamstrings':
        return 'біцепс стегна';
      case 'calves':
        return 'литки';
      case 'glutes':
        return 'сідниці';
      case 'shoulders':
      case 'delts':
      case 'deltoids':
        return 'плечі';
      case 'core':
      case 'abs':
      case 'abdominals':
      case 'obliques':
        return 'прес';
      default:
        return muscle.toLowerCase();
    }
  }

  switch (lower) {
    case 'chest':
    case 'pecs':
      return 'chest';
    case 'triceps':
      return 'triceps';
    case 'biceps':
      return 'biceps';
    case 'arms':
      return 'arms';
    case 'back':
    case 'lats':
      return 'back';
    case 'legs':
      return 'legs';
    case 'quads':
      return 'quads';
    case 'hamstrings':
      return 'hamstrings';
    case 'calves':
      return 'calves';
    case 'glutes':
      return 'glutes';
    case 'shoulders':
    case 'delts':
      return 'shoulders';
    case 'core':
    case 'abs':
      return 'core';
    default:
      return muscle.toLowerCase();
  }
}

function formatMusclesList(muscles: string[], lang: AppLanguage): string {
  const names = [...new Set(muscles.map((m) => getMuscleDisplayName(m, lang)))].filter(Boolean);
  if (names.length === 0) {
    return lang === 'uk' ? 'м’язи' : 'muscles';
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return lang === 'uk' ? `${names[0]} та ${names[1]}` : `${names[0]} and ${names[1]}`;
  }
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(', ');
  return lang === 'uk' ? `${rest} та ${last}` : `${rest}, and ${last}`;
}

export interface ReminderNotificationContent {
  title: string;
  body: string;
  workoutName: string;
  recoveredMusclesText: string;
  readinessPercentage: number;
}

/**
 * Builds dynamic workout reminder content based on next workout and muscle recovery status.
 */
export function buildWorkoutReminderContent(
  program: UserProgram | null,
  nextWorkout: UserWorkout | null,
  history: CompletedWorkout[],
  lang: AppLanguage = 'uk'
): ReminderNotificationContent {
  const workoutName = nextWorkout?.name || (lang === 'uk' ? 'Тренування' : 'Workout');

  const exerciseMuscles = nextWorkout?.exercises
    ? nextWorkout.exercises.map((e) => e.muscleGroup).filter(Boolean)
    : [];
  const combinedMuscles = exerciseMuscles.length > 0
    ? exerciseMuscles
    : (nextWorkout?.muscleGroups || []);
  const distinctMuscles = [...new Set(combinedMuscles)];

  const recoveryStatuses = calculateMuscleRecovery(history);
  const recoveryMap = new Map<string, number>();
  for (const s of recoveryStatuses) {
    recoveryMap.set(s.muscleGroup.toLowerCase(), s.readinessPercentage);
  }

  const scoredMuscles = distinctMuscles.map((muscle) => {
    const core = normalizeMuscleGroup(muscle).toLowerCase();
    const readiness = recoveryMap.get(core) ?? 100;
    return {
      muscle,
      readiness,
    };
  });

  const fullyRecovered = scoredMuscles.filter((s) => s.readiness >= 95);
  const selectedMuscles = (fullyRecovered.length > 0 ? fullyRecovered : scoredMuscles)
    .sort((a, b) => b.readiness - a.readiness)
    .slice(0, 2);

  const avgReadiness =
    selectedMuscles.length > 0
      ? Math.round(
          selectedMuscles.reduce((acc, curr) => acc + curr.readiness, 0) /
            selectedMuscles.length
        )
      : 100;

  const targetMuscleNames = selectedMuscles.map((s) => s.muscle);
  const musclesText = formatMusclesList(targetMuscleNames, lang);

  const title = lang === 'uk' ? 'Сьогодні день тренування! ⚡' : 'Training Day Today! ⚡';
  let body: string;

  if (lang === 'uk') {
    if (avgReadiness >= 95) {
      body = `Сьогодні ${workoutName}! Твої ${musclesText} на 100% відновилися. Час тренуватися! 🔥`;
    } else {
      body = `Сьогодні ${workoutName}! Твої ${musclesText} відновилися на ${avgReadiness}%. Час показати результат! 💪`;
    }
  } else {
    if (avgReadiness >= 95) {
      body = `Today is ${workoutName}! Your ${musclesText} are 100% recovered. Time to crush it! 🔥`;
    } else {
      body = `Today is ${workoutName}! Your ${musclesText} are ${avgReadiness}% recovered. Ready to push! 💪`;
    }
  }

  return {
    title,
    body,
    workoutName,
    recoveredMusclesText: musclesText,
    readinessPercentage: avgReadiness,
  };
}

/**
 * Schedule weekly notifications for all configured workout days.
 */
export async function scheduleWorkoutDayReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  await initNotifications();

  const profile = useUserProfileStore.getState().profile;
  if (!profile.notifications) {
    await cancelAllWorkoutReminders();
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  await cancelAllWorkoutReminders();

  const onboarding = await loadOnboarding();
  const trainingDays =
    onboarding?.trainingDays && onboarding.trainingDays.length > 0
      ? onboarding.trainingDays
      : ['MON', 'WED', 'FRI'];

  const program = useProgramStore.getState().program;
  const progress = useProgramProgressStore.getState().progress;
  const history = useWorkoutHistoryStore.getState().workouts;
  const lang = profile.language || 'uk';

  const nextWorkout = program && program.workouts?.length
    ? getScheduledWorkout(program, progress)
    : null;

  const reminderContent = buildWorkoutReminderContent(program, nextWorkout, history, lang);

  const reminderTime = profile.notificationTime || '09:00';
  const [hourStr, minStr] = reminderTime.split(':');
  const hour = parseInt(hourStr || '9', 10);
  const minute = parseInt(minStr || '0', 10);

  for (const dayKey of trainingDays) {
    const weekday = DAY_KEY_TO_EXPO_WEEKDAY[dayKey.toUpperCase()];
    if (!weekday) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_ID_PREFIX}${dayKey.toLowerCase()}`,
        content: {
          title: reminderContent.title,
          body: reminderContent.body,
          sound: true,
          data: {
            screen: '/(tabs)',
            workoutName: reminderContent.workoutName,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });
    } catch {
      // Ignored if scheduling fails on a specific device
    }
  }
}

/**
 * Cancel all previously scheduled workout reminders.
 */
export async function cancelAllWorkoutReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.identifier.startsWith(REMINDER_ID_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch {
    // Ignored
  }
}

/**
 * Triggers an immediate test notification (fires in 1-2 seconds) with real dynamic content.
 */
export async function sendTestNotification(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  if (Platform.OS === 'web') {
    return {
      success: true,
      message: 'Web platform: Notification simulated successfully.',
    };
  }

  await initNotifications();
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return {
      success: false,
      error: 'permission_denied',
    };
  }

  try {
    const profile = useUserProfileStore.getState().profile;
    const program = useProgramStore.getState().program;
    const progress = useProgramProgressStore.getState().progress;
    const history = useWorkoutHistoryStore.getState().workouts;
    const lang = profile.language || 'uk';

    const nextWorkout =
      program && program.workouts?.length ? getScheduledWorkout(program, progress) : null;

    const content = buildWorkoutReminderContent(program, nextWorkout, history, lang);

    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_ID_PREFIX}test-${Date.now()}`,
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: {
          screen: '/(tabs)',
          isTest: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: NOTIFICATION_CHANNEL_ID,
        repeats: false,
      },
    });

    return {
      success: true,
      message: content.body,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to schedule notification';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Builds the live snapshot of the current workout session & rest timer for the OS notification shade
 * (and for the Web Preview Notification Shade Simulator).
 */
export interface LiveShadeNotificationSnapshot {
  isActive: boolean;
  mode: 'resting' | 'active_set';
  title: string;
  body: string;
  workoutName: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  weightText: string;
  reps: number;
  progressPercent: number;
  restRemainingSeconds: number;
  elapsedSeconds: number;
  lang: AppLanguage;
}

export function getLiveShadeNotificationSnapshot(nowMs: number = Date.now()): LiveShadeNotificationSnapshot | null {
  const { session, restEndsAt } = useWorkoutSessionStore.getState();
  if (!session || session.completed) return null;

  const profile = useUserProfileStore.getState().profile;
  const lang: AppLanguage = profile.language || 'uk';
  const unit = profile.weightUnit || 'kg';
  const unitLabel = unit === 'lbs' ? 'lbs' : lang === 'uk' ? 'кг' : 'kg';

  const currentEx = session.exercises[session.currentExerciseIndex] ?? session.exercises[0];
  if (!currentEx) return null;

  const currentSetIdx = Math.min(
    Math.max(0, session.currentSetIndex),
    Math.max(0, currentEx.sets.length - 1)
  );
  const currentSet = currentEx.sets[currentSetIdx] ?? currentEx.sets[0];
  const setNumber = currentSetIdx + 1;
  const totalSets = currentEx.sets.length;

  const exerciseName = translateExercise(currentEx.name, lang);
  const workoutName = translateWorkoutName(session.workoutName, lang);
  const progress = getSessionProgress(session);
  const progressPercent = Math.round(progress.percentage);

  const weightKg = currentSet?.weight ?? 0;
  const weightText =
    weightKg > 0
      ? `${formatWeight(weightKg)} ${unitLabel}`
      : lang === 'uk'
      ? 'Власна вага'
      : 'Bodyweight';
  const reps = currentSet?.reps ?? 10;

  const startedMs = new Date(session.startedAt).getTime();
  const elapsedSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0;

  const restRemainingSeconds =
    restEndsAt && restEndsAt > nowMs ? Math.max(0, Math.ceil((restEndsAt - nowMs) / 1000)) : 0;
  const isResting = restRemainingSeconds > 0;

  if (isResting) {
    const clock = formatTimerClock(restRemainingSeconds);
    const title =
      lang === 'uk'
        ? `⏱️ Відпочинок: ${clock} • ${workoutName} (${progressPercent}%)`
        : `⏱️ Rest: ${clock} • ${workoutName} (${progressPercent}%)`;
    const body =
      lang === 'uk'
        ? `Далі: ${exerciseName} • Сет ${setNumber}/${totalSets} (${weightText} × ${reps})`
        : `Next: ${exerciseName} • Set ${setNumber}/${totalSets} (${weightText} × ${reps})`;

    return {
      isActive: true,
      mode: 'resting',
      title,
      body,
      workoutName,
      exerciseName,
      setNumber,
      totalSets,
      weightText,
      reps,
      progressPercent,
      restRemainingSeconds,
      elapsedSeconds,
      lang,
    };
  }

  const title =
    lang === 'uk'
      ? `🏋️ ${workoutName} • Сет ${setNumber}/${totalSets} (${progressPercent}%)`
      : `🏋️ ${workoutName} • Set ${setNumber}/${totalSets} (${progressPercent}%)`;
  const body =
    lang === 'uk'
      ? `${exerciseName} — ${weightText} × ${reps} повт.`
      : `${exerciseName} — ${weightText} × ${reps} reps`;

  return {
    isActive: true,
    mode: 'active_set',
    title,
    body,
    workoutName,
    exerciseName,
    setNumber,
    totalSets,
    weightText,
    reps,
    progressPercent,
    restRemainingSeconds: 0,
    elapsedSeconds,
    lang,
  };
}

/**
 * Synchronizes the persistent OS notification in the Android/iOS shade
 * WITHOUT spamming or popping heads-up banners every second.
 */
export async function syncActiveWorkoutNotification(forceRescheduleAlert: boolean = false): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const snapshot = getLiveShadeNotificationSnapshot();
    if (!snapshot) {
      await dismissActiveWorkoutNotification();
      return;
    }

    await initNotifications();
    await setupNotificationCategories(snapshot.lang);

    const { session, restEndsAt } = useWorkoutSessionStore.getState();

    // 1. Manage the exact rest-completion sound alert (fires once when rest finishes)
    if (snapshot.mode === 'resting' && restEndsAt && snapshot.restRemainingSeconds > 0) {
      if (forceRescheduleAlert || lastScheduledRestEndTimestamp !== restEndsAt) {
        lastScheduledRestEndTimestamp = restEndsAt;
        await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);

        const alertTitle =
          snapshot.lang === 'uk' ? 'Час відпочинку вичерпано! ⏱️' : 'Rest time is up! ⏱️';
        const alertBody =
          snapshot.lang === 'uk'
            ? `Час виконувати: ${snapshot.exerciseName} • Сет ${snapshot.setNumber}/${snapshot.totalSets} (${snapshot.weightText} × ${snapshot.reps})`
            : `Time for: ${snapshot.exerciseName} • Set ${snapshot.setNumber}/${snapshot.totalSets} (${snapshot.weightText} × ${snapshot.reps})`;

        await Notifications.scheduleNotificationAsync({
          identifier: REST_TIMER_NOTIFICATION_ID,
          content: {
            title: alertTitle,
            body: alertBody,
            sound: true,
            categoryIdentifier: ACTIVE_SET_CATEGORY_ID,
            data: {
              screen: '/workout/active',
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.round(snapshot.restRemainingSeconds)),
            channelId: REST_TIMER_CHANNEL_ID,
            repeats: false,
          },
        });
      }
    } else if (lastScheduledRestEndTimestamp !== null) {
      lastScheduledRestEndTimestamp = null;
      await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
      await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
    }

    // 2. Deduplicate shade updates: only re-post ACTIVE_SESSION_NOTIFICATION_ID when state actually changes
    const signature = [
      session?.id ?? '',
      snapshot.mode,
      session?.currentExerciseIndex ?? 0,
      session?.currentSetIndex ?? 0,
      snapshot.weightText,
      snapshot.reps,
      snapshot.progressPercent,
      snapshot.mode === 'resting' ? String(restEndsAt ?? 0) : 'active',
      snapshot.lang,
    ].join('|');

    if (!forceRescheduleAlert && lastSyncedShadeSignature === signature) {
      return;
    }
    lastSyncedShadeSignature = signature;

    const categoryId =
      snapshot.mode === 'resting' ? REST_ACTION_CATEGORY_ID : ACTIVE_SET_CATEGORY_ID;

    // For native OS shade, show exact rest duration & finish time so we don't spam 1-second notifications
    let shadeTitle = snapshot.title;
    if (snapshot.mode === 'resting' && restEndsAt) {
      const endClock = formatEndTimeClock(restEndsAt, snapshot.lang);
      const durClock = formatTimerClock(snapshot.restRemainingSeconds);
      shadeTitle =
        snapshot.lang === 'uk'
          ? `⏱️ Відпочинок (${durClock})${endClock ? ` • до ${endClock}` : ''}`
          : `⏱️ Rest (${durClock})${endClock ? ` • until ${endClock}` : ''}`;
    }

    // Never schedule immediate active session alert on iOS while in foreground
    if (Platform.OS === 'ios' && AppState.currentState === 'active') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVE_SESSION_NOTIFICATION_ID,
      content: {
        title: shadeTitle,
        body: snapshot.body,
        sound: false,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
        autoDismiss: false,
        categoryIdentifier: categoryId,
        data: {
          screen: '/workout/active',
          mode: snapshot.mode,
        },
      },
      trigger:
        Platform.OS === 'android'
          ? {
              channelId: LIVE_SESSION_CHANNEL_ID,
            }
          : null,
    });
  } catch {
    // Fail gracefully
  }
}

/**
 * Starts global synchronization between useWorkoutSessionStore and the OS notification shade.
 * Safe to call once in root layout (_layout.tsx).
 */
export function startLiveWorkoutNotificationSync(): void {
  if (Platform.OS === 'web' || isLiveSyncConfigured) return;
  isLiveSyncConfigured = true;

  const scheduleRestEndShadeTransition = () => {
    if (restEndTransitionTimeout) {
      clearTimeout(restEndTransitionTimeout);
      restEndTransitionTimeout = null;
    }

    const { session, restEndsAt } = useWorkoutSessionStore.getState();
    if (!session || session.completed || !restEndsAt) return;

    const remainingMs = restEndsAt - Date.now();
    if (remainingMs > 0) {
      restEndTransitionTimeout = setTimeout(() => {
        restEndTransitionTimeout = null;
        void syncActiveWorkoutNotification(false);
      }, remainingMs + 250);
    }
  };

  useWorkoutSessionStore.subscribe(() => {
    scheduleRestEndShadeTransition();
    if (syncDebounceTimeout) {
      clearTimeout(syncDebounceTimeout);
    }
    syncDebounceTimeout = setTimeout(() => {
      syncDebounceTimeout = null;
      void syncActiveWorkoutNotification(false);
    }, 250);
  });

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
      scheduleRestEndShadeTransition();
      void syncActiveWorkoutNotification(false);
    }
  });
}

/**
 * Schedules a rest timer notification to fire after specified seconds in the background.
 * Kept for direct callers and delegates to syncActiveWorkoutNotification.
 */
export async function scheduleRestTimerNotification(
  _seconds?: number,
  _exerciseName?: string,
  _setNumber?: number,
  _totalSets?: number,
  _lang: AppLanguage = 'uk'
): Promise<void> {
  await syncActiveWorkoutNotification(true);
}

/**
 * Cancels only the rest timer completion alert while keeping the active workout session shade updated.
 */
export async function cancelRestTimerNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    lastScheduledRestEndTimestamp = null;
    if (restEndTransitionTimeout) {
      clearTimeout(restEndTransitionTimeout);
      restEndTransitionTimeout = null;
    }
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(ACTIVE_REST_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(ACTIVE_REST_NOTIFICATION_ID).catch(() => undefined);
    await syncActiveWorkoutNotification(false);
  } catch {
    // Fail gracefully
  }
}

/**
 * Dismisses all workout & rest notifications when a workout is completed or abandoned.
 */
export async function dismissActiveWorkoutNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    lastScheduledRestEndTimestamp = null;
    lastSyncedShadeSignature = null;
    if (restEndTransitionTimeout) {
      clearTimeout(restEndTransitionTimeout);
      restEndTransitionTimeout = null;
    }
    if (syncDebounceTimeout) {
      clearTimeout(syncDebounceTimeout);
      syncDebounceTimeout = null;
    }
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(ACTIVE_REST_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(ACTIVE_REST_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(ACTIVE_SESSION_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(ACTIVE_SESSION_NOTIFICATION_ID).catch(() => undefined);
  } catch {
    // Fail gracefully
  }
}
