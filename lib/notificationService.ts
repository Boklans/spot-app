import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { calculateMuscleRecovery, normalizeMuscleGroup } from '@/lib/recoveryEngine';
import { getScheduledWorkout } from '@/store/programProgressStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore, type AppLanguage } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding } from '@/store/workoutStore';
import type { UserProgram, UserWorkout } from '@/types/userProgram';
import type { CompletedWorkout } from '@/types/workout';

const NOTIFICATION_CHANNEL_ID = 'workout-reminders';
const REST_TIMER_CHANNEL_ID = 'rest-timer-channel';
const REMINDER_ID_PREFIX = 'spot-workout-reminder-';
export const REST_TIMER_NOTIFICATION_ID = 'spot-rest-timer';
export const ACTIVE_REST_NOTIFICATION_ID = 'spot-active-rest-notification';
export const REST_ACTION_CATEGORY_ID = 'rest-timer-actions';
export const ACTION_ADD_30S = 'ACTION_ADD_30S';
export const ACTION_SKIP_REST = 'ACTION_SKIP_REST';
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

export async function setupNotificationCategories(lang: AppLanguage = 'uk'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setNotificationCategoryAsync(REST_ACTION_CATEGORY_ID, [
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
      {
        identifier: ACTION_OPEN_WORKOUT,
        buttonTitle: lang === 'uk' ? 'До вправи' : 'Open Workout',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  } catch {
    // Fail gracefully on web/unsupported
  }
}

function setupNotificationResponseListener(): void {
  if (Platform.OS === 'web' || isResponseListenerConfigured) return;
  isResponseListenerConfigured = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const actionIdentifier = response.actionIdentifier;
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;

      if (actionIdentifier === ACTION_ADD_30S) {
        useWorkoutSessionStore.getState().addRestTime(30);
        const session = useWorkoutSessionStore.getState().session;
        const restEndsAt = useWorkoutSessionStore.getState().restEndsAt;
        if (session && restEndsAt) {
          const remaining = Math.max(1, Math.round((restEndsAt - Date.now()) / 1000));
          const currentEx = session.exercises[session.currentExerciseIndex];
          const profile = useUserProfileStore.getState().profile;
          scheduleRestTimerNotification(
            remaining,
            currentEx?.name || 'Workout',
            (session.currentSetIndex ?? 0) + 1,
            currentEx?.sets.length ?? 3,
            profile.language || 'uk'
          );
        }
        return;
      }

      if (actionIdentifier === ACTION_SKIP_REST) {
        useWorkoutSessionStore.getState().skipRest();
        cancelRestTimerNotification();
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
        if (session) {
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
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      const actionIdentifier = response.actionIdentifier;
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;

      if (actionIdentifier === ACTION_ADD_30S) {
        useWorkoutSessionStore.getState().addRestTime(30);
        return;
      }
      if (actionIdentifier === ACTION_SKIP_REST) {
        useWorkoutSessionStore.getState().skipRest();
        cancelRestTimerNotification();
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
        if (session) {
          router.replace('/workout/active');
        } else {
          router.replace('/(tabs)');
        }
      } else if (targetScreen === '/(tabs)' || data?.isTest || data?.workoutName) {
        router.replace('/(tabs)');
      }
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
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
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
        name: 'Rest Timer',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#C8FF3D',
        sound: 'default',
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

  // Extract target muscles (prioritize specific exercise muscles like Triceps/Chest if available)
  const exerciseMuscles = nextWorkout?.exercises
    ? nextWorkout.exercises.map((e) => e.muscleGroup).filter(Boolean)
    : [];
  const combinedMuscles = exerciseMuscles.length > 0
    ? exerciseMuscles
    : (nextWorkout?.muscleGroups || []);
  const distinctMuscles = [...new Set(combinedMuscles)];

  // Calculate muscle recovery
  const recoveryStatuses = calculateMuscleRecovery(history);
  const recoveryMap = new Map<string, number>();
  for (const s of recoveryStatuses) {
    recoveryMap.set(s.muscleGroup.toLowerCase(), s.readinessPercentage);
  }

  // Score each candidate muscle by its core recovery status
  const scoredMuscles = distinctMuscles.map((muscle) => {
    const core = normalizeMuscleGroup(muscle).toLowerCase();
    const readiness = recoveryMap.get(core) ?? 100;
    return {
      muscle,
      readiness,
    };
  });

  // Pick fully recovered muscles (>= 95%), otherwise sort by highest recovery
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

  let title = lang === 'uk' ? 'Сьогодні день тренування! ⚡' : 'Training Day Today! ⚡';
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

  // Cancel existing workout reminders to prevent duplicates
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

  // Parse reminder time (format HH:mm, e.g. "09:00")
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
 * Schedules a rest timer notification to fire after specified seconds in the background.
 */
export async function scheduleRestTimerNotification(
  seconds: number,
  exerciseName: string,
  setNumber: number,
  totalSets: number,
  lang: AppLanguage = 'uk'
): Promise<void> {
  if (Platform.OS === 'web' || seconds <= 0) return;

  try {
    // Cancel any previous rest timer notification first
    await cancelRestTimerNotification();
    await setupNotificationCategories(lang);

    const title = lang === 'uk' ? 'Час відпочинку вичерпано! ⏱️' : 'Rest time is up! ⏱️';
    const body = lang === 'uk'
      ? `Наступний підхід: ${exerciseName} (${setNumber}/${totalSets})`
      : `Next set: ${exerciseName} (${setNumber}/${totalSets})`;

    // 1. Completion alert (fires when rest ends)
    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_ID,
      content: {
        title,
        body,
        sound: true,
        categoryIdentifier: REST_ACTION_CATEGORY_ID,
        data: {
          screen: '/workout/active',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: REST_TIMER_CHANNEL_ID,
        repeats: false,
      },
    });

    // 2. Active notification in shade with interactive action buttons [+30s / Skip]
    const activeTitle = lang === 'uk'
      ? `Відпочинок (~${Math.ceil(seconds / 60)} хв) ⏱️`
      : `Resting (~${Math.ceil(seconds / 60)} min) ⏱️`;
    const activeBody = lang === 'uk'
      ? `Готуйся: ${exerciseName} • Сет ${setNumber}/${totalSets}`
      : `Up next: ${exerciseName} • Set ${setNumber}/${totalSets}`;

    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVE_REST_NOTIFICATION_ID,
      content: {
        title: activeTitle,
        body: activeBody,
        sound: false,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        autoDismiss: false,
        categoryIdentifier: REST_ACTION_CATEGORY_ID,
        data: {
          screen: '/workout/active',
        },
      },
      trigger: null, // immediate
    });
  } catch {
    // Fail gracefully
  }
}

/**
 * Cancels any scheduled rest timer notification.
 */
export async function cancelRestTimerNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(ACTIVE_REST_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(ACTIVE_REST_NOTIFICATION_ID);
  } catch {
    // Fail gracefully
  }
}
