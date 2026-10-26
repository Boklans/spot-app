import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthModal } from '@/components/auth/AuthModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { PreferencePickerModal } from '@/components/profile/PreferencePickerModal';
import { RestTimePickerModal } from '@/components/profile/RestTimePickerModal';
import { ReminderTimePickerModal } from '@/components/profile/ReminderTimePickerModal';
import { LanguagePickerModal } from '@/components/profile/LanguagePickerModal';
import { PrivacyPolicyModal } from '@/components/profile/PrivacyPolicyModal';
import { ProPaywallModal } from '@/components/profile/ProPaywallModal';
import { BetaAccessModal } from '@/components/profile/BetaAccessModal';
import { ExerciseNoteModal } from '@/components/workout/ExerciseNoteModal';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { getSyncStatus, subscribeSyncStatus, syncUp, type SyncStatus } from '@/lib/cloudSync';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import {
  requestNotificationPermissions,
  sendTestNotification,
} from '@/lib/notificationService';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  BEAST_AVATARS,
  getTrialStatus,
  useUserProfileStore,
  type UserExperience,
  type UserGoal,
} from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';

const GOAL_OPTIONS: UserGoal[] = [
  'Build Muscle',
  'Lose Fat',
  'Get Stronger',
  'Recomposition',
];

const EXPERIENCE_OPTIONS: UserExperience[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
];

const WORKOUTS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

const SPLIT_OPTIONS = [
  'Full Body',
  'Upper / Lower',
  'Push / Pull / Legs',
  'Custom Routine',
];

type ActivePicker = 'goal' | 'experience' | 'workoutsPerWeek' | 'split' | null;

// Free Beta Testing mode for initial 100-300 users. Switch to false when ready to monetize.
export const IS_BETA_MODE = true;
const SHOW_PRO_SUBSCRIPTION = true;

export default function Profile() {
  const { t, te, language } = useI18n();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);
  const program = useProgramStore((state) => state.program);
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const notes = useExerciseNotesStore((state) => state.notes);
  const setNote = useExerciseNotesStore((state) => state.setNote);
  const isPurchasedPro = useSubscriptionStore((state) => state.isPro);
  const trialStatus = getTrialStatus(profile.trialStartedAt);
  const isPro = isPurchasedPro || trialStatus.inTrial;
  const restorePurchasesAction = useSubscriptionStore((state) => state.restore);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // Modals & Collapsible States
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [appSettingsVisible, setAppSettingsVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [editingNoteExercise, setEditingNoteExercise] = useState<string | null>(null);
  const [showTrainingParams, setShowTrainingParams] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Auth & Sync State
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    useUserProfileStore.getState().loadProfile();
    useWorkoutHistoryStore.getState().loadHistory();
    useExerciseNotesStore.getState().loadNotes();
    return subscribeSyncStatus(setSyncStatus);
  }, []);

  const notesEntries = Object.entries(notes).filter(([, text]) => text && text.trim().length > 0);

  const translateGoal = (g: string) => {
    if (language !== 'uk') return g;
    if (g === 'Build Muscle') return 'Набір м’язів';
    if (g === 'Lose Fat') return 'Зниження ваги';
    if (g === 'Get Stronger') return 'Розвиток сили';
    if (g === 'Recomposition') return 'Рекомпозиція';
    return g;
  };

  const translateExperience = (exp: string) => {
    if (language !== 'uk') return exp;
    if (exp === 'Beginner') return 'Початківець';
    if (exp === 'Intermediate') return 'Середній';
    if (exp === 'Advanced') return 'Досвідчений';
    return exp;
  };

  const translateSplit = (s: string) => {
    if (language !== 'uk') return s;
    if (s === 'Full Body') return 'Все тіло (Full Body)';
    if (s === 'Upper / Lower') return 'Верх / Низ';
    if (s === 'Push / Pull / Legs') return 'Жим / Тяга / Ноги';
    if (s === 'Custom Routine') return 'Власна програма';
    return s;
  };

  const isAuthenticated = Boolean(user);

  const handleManualSync = async () => {
    hapticMedium();
    const res = await syncUp();
    if (res.success) {
      hapticSuccess();
    } else {
      Alert.alert(
        language === 'uk' ? 'Помилка синхронізації' : 'Sync Error',
        res.error || (language === 'uk' ? 'Перевірте інтернет-зв’язок' : 'Check network connection')
      );
    }
  };

  const handleSignOut = () => {
    hapticMedium();
    Alert.alert(
      language === 'uk' ? 'Вийти з акаунта?' : 'Sign Out?',
      language === 'uk'
        ? 'Ваші тренування залишаться на цьому телефоні і будуть збережені в хмарі.'
        : 'Your workouts will remain on this device and saved in the cloud.',
      [
        { text: language === 'uk' ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: language === 'uk' ? 'Вийти' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            hapticLight();
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    hapticLight();
    setRestoringPurchases(true);
    try {
      const res = await restorePurchasesAction();
      if (res.success && res.isPro) {
        hapticSuccess();
        Alert.alert(
          language === 'uk' ? 'Успішно відновлено!' : 'Purchases Restored!',
          language === 'uk' ? 'Ваш SPOT PRO статус активний.' : 'Your SPOT PRO status is active.'
        );
      } else if (res.success) {
        hapticLight();
        Alert.alert(
          language === 'uk' ? 'Підписок не знайдено' : 'No Subscriptions Found',
          language === 'uk'
            ? 'Активних підписок SPOT PRO для цього акаунта не виявлено.'
            : 'No active subscriptions found for this store account.'
        );
      } else {
        hapticError();
        Alert.alert(
          language === 'uk' ? 'Помилка відновлення' : 'Restore Failed',
          res.error || (language === 'uk' ? 'Спробуйте пізніше' : 'Please try again later')
        );
      }
    } finally {
      setRestoringPurchases(false);
    }
  };

  const currentBeast = BEAST_AVATARS[profile.avatar] ?? BEAST_AVATARS.gorilla;
  const heightM = profile.heightCm / 100;
  const bmi =
    heightM > 0 && profile.weightKg > 0
      ? (profile.weightKg / (heightM * heightM)).toFixed(1)
      : '24.0';

  const handleOpenPicker = (picker: ActivePicker) => {
    hapticLight();
    setActivePicker(picker);
  };

  const handleSelectGoal = async (goal: UserGoal) => {
    await updateProfile({ goal });
    const goalKeyMap: Record<UserGoal, 'build_muscle' | 'lose_fat' | 'get_stronger' | 'recomposition'> = {
      'Build Muscle': 'build_muscle',
      'Lose Fat': 'lose_fat',
      'Get Stronger': 'get_stronger',
      'Recomposition': 'recomposition',
    };
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, goal: goalKeyMap[goal] || 'build_muscle' };
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
    hapticSuccess();
  };

  const handleSelectExperience = async (experience: UserExperience) => {
    await updateProfile({ experience });
    const expKeyMap: Record<UserExperience, 'beginner' | 'intermediate' | 'advanced'> = {
      Beginner: 'beginner',
      Intermediate: 'intermediate',
      Advanced: 'advanced',
    };
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, experience: expKeyMap[experience] || 'beginner' };
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
    hapticSuccess();
  };

  const handleSelectWorkoutsPerWeek = async (count: number) => {
    await updateProfile({ workoutsPerWeek: count });
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, trainingFrequency: count };
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
    hapticSuccess();
  };

  const handleContactSupport = () => {
    hapticMedium();
    const email = 'vanzalabs@gmail.com';
    const subject = encodeURIComponent(
      language === 'uk' ? 'Підтримка SPOT — Запит' : 'SPOT Support Request'
    );
    Linking.openURL(`mailto:${email}?subject=${subject}`).catch(() => {
      Alert.alert(
        language === 'uk' ? 'Служба підтримки' : 'Support',
        language === 'uk'
          ? `Напишіть нам на електронну пошту:\n\n${email}`
          : `Please email us at:\n\n${email}`
      );
    });
  };

  const handleSendFeedback = () => {
    hapticMedium();
    const email = 'vanzalabs@gmail.com';
    const subject = encodeURIComponent(
      language === 'uk' ? 'SPOT — Ідея / Відгук' : 'SPOT — Feature Idea / Feedback'
    );
    const body = encodeURIComponent(
      language === 'uk'
        ? `Привіт, VanzaLabs!\n\nЧого мені не вистачає в SPOT:\n- \n\nЩо сподобалося / Що покращити:\n- \n\nВерсія: SPOT v1.0.0 (${Platform.OS})`
        : `Hi VanzaLabs team!\n\nWhat I would love to see in SPOT:\n- \n\nWhat I like / Suggestions:\n- \n\nVersion: SPOT v1.0.0 (${Platform.OS})`
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert(
        language === 'uk' ? 'Надіслати відгук' : 'Send Feedback',
        `${language === 'uk' ? 'Напишіть нам на' : 'Please email us at'} ${email}`
      );
    });
  };

  const handleOpenTelegram = () => {
    hapticMedium();
    Linking.openURL('https://t.me/vanzalabs').catch(() => {
      Alert.alert(
        'Telegram',
        language === 'uk'
          ? 'Зв’яжіться з нами в Telegram: @vanzalabs'
          : 'Reach out to us on Telegram: @vanzalabs'
      );
    });
  };

  const handleResetPress = () => {
    hapticMedium();
    Alert.alert(
      isAuthenticated
        ? language === 'uk'
          ? 'Видалити акаунт та всі дані?'
          : 'Delete Account & All Data?'
        : language === 'uk'
        ? 'Скинути всі дані додатку?'
        : 'Reset App Data?',
      isAuthenticated
        ? language === 'uk'
          ? 'Це назавжди видалить ваш хмарний акаунт, історію тренувань, створені програми та весь прогрес. Цю дію неможливо скасувати.'
          : 'This will permanently delete your cloud account, workout history, custom programs, and all progress. This action cannot be undone.'
        : language === 'uk'
        ? 'Це назавжди видалить історію тренувань, створені кастомні програми та весь прогрес. Цю дію неможливо скасувати.'
        : 'This will permanently delete your workout history, custom programs, and training progress. This action cannot be undone.',
      [
        { text: language === 'uk' ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isAuthenticated
            ? language === 'uk'
              ? 'Видалити акаунт'
              : 'Delete Account'
            : language === 'uk'
            ? 'Скинути все'
            : 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Fetch all storage keys and remove every SPOT-related key
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                (k) =>
                  k.startsWith('spot') ||
                  k.includes('workout') ||
                  k.includes('program') ||
                  k.includes('onboarding') ||
                  k.includes('profile') ||
                  k.includes('body-weight') ||
                  k.includes('session')
              );
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }

              // 2. Also explicitly remove known storage keys directly
              await AsyncStorage.multiRemove([
                'spot-onboarding',
                'spot-user-program',
                'spot-custom-program',
                'spot-active-program',
                'spot-program',
                'spot-workout-history',
                'spot-program-progress',
                'spot-user-profile',
                'spot_active_workout_session',
                'spot-active-workout-session',
                'spot-body-weight-history',
              ]);

              // 3. Clear cloud data if authenticated
              if (isSupabaseConfigured()) {
                const user = useAuthStore.getState().user;
                if (user) {
                  try {
                    await supabase.from('user_programs').delete().eq('user_id', user.id);
                    await supabase.from('workout_history').delete().eq('user_id', user.id);
                    await supabase.from('body_weight_logs').delete().eq('user_id', user.id);
                    await signOut();
                  } catch {
                    // Cloud delete error ignored
                  }
                }
              }

              // 4. Reset in-memory stores
              useWorkoutSessionStore.getState().clearSession();
              await useWorkoutHistoryStore.getState().clearHistory();
              await useUserProfileStore.getState().resetProfile();
              await useBodyWeightStore.getState().clearHistory();
              await useProgramStore.getState().resetProgram();
              await useExerciseNotesStore.getState().clearNotes();

              await hapticSuccess();
              router.replace('/onboarding/welcome');
            } catch {
              Alert.alert(
                language === 'uk' ? 'Помилка' : 'Error',
                language === 'uk'
                  ? 'Не вдалося скинути деякі дані додатку. Будь ласка, перезапустіть додаток.'
                  : 'Failed to reset some app data. Please restart the app.'
              );
            }
          },
        },
      ]
    );
  };

  const handleRestartOnboarding = async () => {
    hapticMedium();
    try {
      await AsyncStorage.multiRemove([
        'spot-onboarding',
        'spot-custom-program',
        'spot-user-program',
        'spot-active-program',
        'spot-program',
      ]);
      await useProgramStore.getState().resetProgram();
    } catch {
      // Storage error ignored
    }
    router.replace('/onboarding/welcome');
  };

  const handleSelectSplit = async (selectedLabel: string) => {
    const s = String(selectedLabel).toLowerCase().trim();
    let splitKey: WorkoutSplitPreference = 'upper_lower';
    if (s.includes('full') || s.includes('все тіло') || s.includes('фул')) splitKey = 'full_body';
    else if (s.includes('push') || s.includes('pull') || s.includes('ppl') || s.includes('жим') || s.includes('тяга')) splitKey = 'push_pull_legs';
    else if (s.includes('custom') || s.includes('власн')) splitKey = 'custom';
    else if (s.includes('upper') || s.includes('lower') || s.includes('верх') || s.includes('низ')) splitKey = 'upper_lower';

    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, splitPreference: splitKey };
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
    hapticSuccess();
  };

  const currentSplitLabel =
    program.splitType === 'full_body'
      ? 'Full Body'
      : program.splitType === 'push_pull_legs'
      ? 'Push / Pull / Legs'
      : program.splitType === 'custom'
      ? 'Custom Routine'
      : 'Upper / Lower';

  const handleToggleNotifications = async (val: boolean) => {
    hapticLight();
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          language === 'uk' ? 'Потрібен дозвіл' : 'Permission Required',
          language === 'uk'
            ? 'Будь ласка, увімкніть дозвіл на сповіщення в системних налаштуваннях телефона.'
            : 'Please allow notification permissions in your device settings.'
        );
      }
    }
    await updateProfile({ notifications: val });
  };

  const handleSendTestNotification = async () => {
    hapticMedium();
    setIsSendingTest(true);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        hapticSuccess();
        Alert.alert(
          language === 'uk' ? '⚡ Тестове сповіщення' : '⚡ Test Notification',
          language === 'uk'
            ? `Сповіщення спрацює за 1-2 секунди:\n\n"${res.message}"`
            : `Notification will arrive in 1-2 seconds:\n\n"${res.message}"`
        );
      } else if (res.error === 'permission_denied') {
        Alert.alert(
          language === 'uk' ? 'Потрібен дозвіл' : 'Permission Required',
          language === 'uk'
            ? 'Будь ласка, дозвольте сповіщення для SPOT у налаштуваннях пристрою.'
            : 'Please enable notifications for SPOT in system settings.'
        );
      } else {
        Alert.alert(
          language === 'uk' ? 'Помилка' : 'Error',
          res.error || t('testNotificationError')
        );
      }
    } catch {
      Alert.alert(language === 'uk' ? 'Помилка' : 'Error', t('testNotificationError'));
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Clean Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>
          {language === 'uk' ? 'Профіль' : 'Profile'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Interactive Profile Header Card with Beast Avatar */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
          onPress={() => {
            hapticLight();
            setEditProfileVisible(true);
          }}
          style={({ pressed }) => [styles.headerCard, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: currentBeast.color }]}>
              <Text style={styles.avatarEmoji}>{currentBeast.emoji}</Text>
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={10} color="#E2E8F0" />
            </View>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{profile.name}</Text>
            </View>

            <Text style={styles.userSubtitle}>
              {translateExperience(profile.experience)} · {translateGoal(profile.goal)}
            </Text>

            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {profile.weightUnit === 'lbs'
                  ? `${Math.round(profile.weightKg * 2.20462)} lbs`
                  : `${profile.weightKg} ${language === 'uk' ? 'кг' : 'kg'}`}
                {' · '}
                {profile.heightUnit === 'ft'
                  ? `${(profile.heightCm / 30.48).toFixed(1)} ft`
                  : `${profile.heightCm} ${language === 'uk' ? 'см' : 'cm'}`}
                {' · '}
                {language === 'uk' ? 'ІМТ' : 'BMI'} {bmi}
              </Text>
            </View>
          </View>

          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={17} color="#64748B" />
          </View>
        </Pressable>

        {/* 2. Quick Access Hub: Workout History & Saved Exercise Notes */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              router.push('/history');
            }}
            style={({ pressed }) => [
              styles.quickHubCard,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.quickHubTopRow}>
              <View style={styles.quickHubIconWrap}>
                <MaterialCommunityIcons name="history" size={18} color="#E2E8F0" />
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </View>
            <View>
              <Text style={styles.quickHubTitle}>
                {language === 'uk' ? 'Історія тренувань' : 'Workout History'}
              </Text>
              <Text style={styles.quickHubSub}>
                {language === 'uk'
                  ? `${workouts.length} сесій · Тоді vs Зараз`
                  : `${workouts.length} sessions · Compare`}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setNotesModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.quickHubCard,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.quickHubTopRow}>
              <View style={styles.quickHubIconWrap}>
                <Ionicons name="bookmark-outline" size={17} color="#E2E8F0" />
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </View>
            <View>
              <Text style={styles.quickHubTitle}>
                {language === 'uk' ? 'Мої нотатки' : 'Exercise Notes'}
              </Text>
              <Text style={styles.quickHubSub}>
                {language === 'uk'
                  ? `${notesEntries.length} збережених підказок`
                  : `${notesEntries.length} saved cues`}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 3. Cloud Account & Backup Section */}
        <View style={[styles.cloudCard, { marginBottom: 14 }]}>
          <View style={styles.cloudCardLeft}>
            <View style={[styles.cloudIconWrap, isAuthenticated && styles.cloudIconWrapActive]}>
              <Ionicons
                name={isAuthenticated ? 'cloud-done-outline' : 'cloud-outline'}
                size={20}
                color={isAuthenticated ? colors.primary : '#94A3B8'}
              />
            </View>
            <View style={styles.cloudInfo}>
              <Text style={styles.cloudTitle}>
                {isAuthenticated
                  ? user?.email || (language === 'uk' ? 'Хмарний акаунт' : 'Cloud Account')
                  : language === 'uk'
                  ? 'Хмарна синхронізація'
                  : 'Cloud Backup & Sync'}
              </Text>
              <Text style={styles.cloudSubtitle}>
                {isAuthenticated
                  ? syncStatus.isSyncing
                    ? language === 'uk' ? 'Синхронізація...' : 'Syncing...'
                    : syncStatus.lastSyncedAt
                    ? (language === 'uk' ? 'Оновлено: ' : 'Synced: ') +
                      new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : language === 'uk' ? 'Дані синхронізовано' : 'Data is up to date'
                  : language === 'uk'
                  ? 'Увійдіть, щоб зберігати прогрес'
                  : 'Sign in to keep workouts safe'}
              </Text>
            </View>
          </View>

          {isAuthenticated ? (
            <View style={styles.cloudActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sync now"
                onPress={handleManualSync}
                disabled={syncStatus.isSyncing}
                style={({ pressed }) => [styles.cloudSyncBtn, pressed && { opacity: 0.7 }]}
              >
                {syncStatus.isSyncing ? (
                  <ActivityIndicator size="small" color="#E2E8F0" />
                ) : (
                  <Ionicons name="sync" size={17} color="#E2E8F0" />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={handleSignOut}
                style={({ pressed }) => [styles.cloudSignOutBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="log-out-outline" size={17} color="#F87171" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={() => setAuthModalVisible(true)}
              style={({ pressed }) => [styles.cloudLoginBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.cloudLoginBtnText}>
                {language === 'uk' ? 'Увійти' : 'Sign In'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* 4. Single Clean App Settings & Support Card */}
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setAppSettingsVisible(true);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeftWithIcon}>
              <View style={styles.rowIconBox}>
                <Ionicons name="options-outline" size={18} color="#E2E8F0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {language === 'uk' ? 'Налаштування застосунку' : 'App Preferences & Units'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {profile.language === 'uk' ? 'УКР' : 'EN'} · {profile.weightUnit.toUpperCase()} ·{' '}
                  {Math.floor(profile.defaultRestSeconds / 60)}:
                  {(profile.defaultRestSeconds % 60).toString().padStart(2, '0')} ·{' '}
                  {language === 'uk' ? 'Сповіщення та дані' : 'Alerts & Data'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#64748B" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Telegram Community"
            onPress={handleOpenTelegram}
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeftWithIcon}>
              <View style={styles.rowIconBox}>
                <Ionicons name="paper-plane-outline" size={17} color="#E2E8F0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {language === 'uk' ? 'Спільнота та підтримка в Telegram' : 'Telegram Community & Support'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  @vanzalabs · {language === 'uk' ? 'Зворотний зв’язок та ідеї' : 'Feedback & direct contact'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#64748B" />
          </Pressable>
        </View>

        <Text style={styles.versionText}>SPOT v1.0.2 · VanzaLabs</Text>
      </ScrollView>

      {/* Saved Exercise Notes Modal */}
      <Modal
        visible={notesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          <SafeAreaView
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '82%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                  {language === 'uk' ? 'Мої нотатки до вправ' : 'My Exercise Notes'}
                </Text>
                <Text style={{ color: '#8E9BAE', fontSize: 12, marginTop: 2 }}>
                  {language === 'uk'
                    ? 'Зберігаються між тренуваннями й показуються під назвою вправи'
                    : 'Saved across workouts and shown under the exercise name'}
                </Text>
              </View>
              <Pressable
                onPress={() => setNotesModalVisible(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.elevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
              {notesEntries.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                  <Ionicons name="bookmark-outline" size={28} color="#64748B" />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                    {language === 'uk' ? 'Поки немає збережених нотаток' : 'No saved notes yet'}
                  </Text>
                  <Text style={{ color: '#8E9BAE', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                    {language === 'uk'
                      ? 'Під час тренування натисніть «Нотатка» біля будь-якої вправи, щоб записати рівень сидіння, хват або підказку.'
                      : 'Tap "Note" on any exercise during a workout to save seat settings, grip, or cues.'}
                  </Text>
                </View>
              ) : (
                notesEntries.map(([exKey, noteText]) => (
                  <Pressable
                    key={exKey}
                    onPress={() => {
                      hapticLight();
                      setEditingNoteExercise(exKey);
                    }}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      padding: 14,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                        {te(exKey)}
                      </Text>
                      <Ionicons name="create-outline" size={16} color="#64748B" />
                    </View>
                    <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 18 }}>{noteText}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {editingNoteExercise && (
        <ExerciseNoteModal
          visible={Boolean(editingNoteExercise)}
          exerciseName={te(editingNoteExercise)}
          initialNote={notes[editingNoteExercise] || ''}
          language={language}
          onClose={() => setEditingNoteExercise(null)}
          onSave={(newNote) => setNote(editingNoteExercise, newNote)}
        />
      )}

      {/* App Settings Modal (One-time preferences tucked cleanly) */}
      <Modal
        visible={appSettingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAppSettingsVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          <SafeAreaView
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '88%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                {language === 'uk' ? 'Налаштування застосунку' : 'App Preferences'}
              </Text>
              <Pressable
                onPress={() => setAppSettingsVisible(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.elevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.sectionTitle}>{t('preferences')}</Text>
              <View style={styles.card}>
                {/* Weight Unit */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    updateProfile({ weightUnit: profile.weightUnit === 'kg' ? 'lbs' : 'kg' });
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <MaterialCommunityIcons name="weight-kilogram" size={20} color="#8E9BAE" />
                    <View>
                      <Text style={styles.rowTitle}>{t('weightUnit')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {profile.weightUnit === 'kg'
                          ? language === 'uk' ? 'Кілограми (кг)' : 'Kilograms (kg)'
                          : language === 'uk' ? 'Фунти (lbs)' : 'Pounds (lbs)'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.segmentWrap}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ weightUnit: 'kg' });
                      }}
                      style={[styles.segmentBtn, profile.weightUnit === 'kg' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.weightUnit === 'kg' && styles.segmentBtnTextActive]}>
                        KG
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ weightUnit: 'lbs' });
                      }}
                      style={[styles.segmentBtn, profile.weightUnit === 'lbs' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.weightUnit === 'lbs' && styles.segmentBtnTextActive]}>
                        LBS
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>

                {/* Height Unit */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    updateProfile({ heightUnit: profile.heightUnit === 'cm' ? 'ft' : 'cm' });
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <MaterialCommunityIcons name="ruler" size={20} color="#8E9BAE" />
                    <View>
                      <Text style={styles.rowTitle}>{t('heightUnit')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {profile.heightUnit === 'cm'
                          ? language === 'uk' ? 'Сантиметри (см)' : 'Centimeters (cm)'
                          : language === 'uk' ? 'Фути та дюйми (ft)' : 'Feet & Inches (ft)'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.segmentWrap}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ heightUnit: 'cm' });
                      }}
                      style={[styles.segmentBtn, profile.heightUnit === 'cm' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.heightUnit === 'cm' && styles.segmentBtnTextActive]}>
                        CM
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ heightUnit: 'ft' });
                      }}
                      style={[styles.segmentBtn, profile.heightUnit === 'ft' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.heightUnit === 'ft' && styles.segmentBtnTextActive]}>
                        FT
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>

                {/* Rest Timer */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setRestModalVisible(true);
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <MaterialCommunityIcons name="timer-outline" size={20} color="#8E9BAE" />
                    <View>
                      <Text style={styles.rowTitle}>{t('restTimerSetting')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {Math.floor(profile.defaultRestSeconds / 60)}:
                        {(profile.defaultRestSeconds % 60).toString().padStart(2, '0')} {t('min')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.valueRow}>
                    <Text style={styles.valuePill}>
                      {Math.floor(profile.defaultRestSeconds / 60)}:
                      {(profile.defaultRestSeconds % 60).toString().padStart(2, '0')}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                  </View>
                </Pressable>

                {/* Theme / Appearance */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    updateProfile({ theme: profile.theme === 'light' ? 'dark' : 'light' });
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <Ionicons
                      name={profile.theme === 'light' ? 'sunny-outline' : 'moon-outline'}
                      size={20}
                      color="#8E9BAE"
                    />
                    <View>
                      <Text style={styles.rowTitle}>{t('theme')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {profile.theme === 'light' ? t('themeLight') : t('themeDark')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.segmentWrap}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ theme: 'dark' });
                      }}
                      style={[styles.segmentBtn, (profile.theme ?? 'dark') === 'dark' && styles.segmentBtnActive]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          (profile.theme ?? 'dark') === 'dark' && styles.segmentBtnTextActive,
                        ]}
                      >
                        {t('themeDark')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ theme: 'light' });
                      }}
                      style={[styles.segmentBtn, profile.theme === 'light' && styles.segmentBtnActive]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          profile.theme === 'light' && styles.segmentBtnTextActive,
                        ]}
                      >
                        {t('themeLight')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>

                {/* Language Selector */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    updateProfile({ language: profile.language === 'uk' ? 'en' : 'uk' });
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <Ionicons name="globe-outline" size={20} color="#8E9BAE" />
                    <View>
                      <Text style={styles.rowTitle}>{t('language')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {profile.language === 'uk' ? 'Українська' : 'English'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.segmentWrap}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ language: 'uk' });
                      }}
                      style={[styles.segmentBtn, profile.language === 'uk' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.language === 'uk' && styles.segmentBtnTextActive]}>
                        УКР
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        updateProfile({ language: 'en' });
                      }}
                      style={[styles.segmentBtn, profile.language === 'en' && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentBtnText, profile.language === 'en' && styles.segmentBtnTextActive]}>
                        EN
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>

                {/* Notifications Toggle */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleToggleNotifications(!profile.notifications)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <Ionicons name="notifications-outline" size={20} color="#8E9BAE" />
                    <View>
                      <Text style={styles.rowTitle}>{t('notifications')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {profile.notifications
                          ? language === 'uk' ? 'Розумні нагадування' : 'Smart workout reminders'
                          : language === 'uk' ? 'Вимкнено' : 'Disabled'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    trackColor={{ false: '#1A212B', true: colors.primary }}
                    thumbColor={profile.notifications ? '#0B0D0F' : '#8E9BAE'}
                    ios_backgroundColor="#1A212B"
                    onValueChange={handleToggleNotifications}
                    value={profile.notifications}
                  />
                </Pressable>

                {/* Sound Effects */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    updateProfile({ soundEnabled: !profile.soundEnabled });
                  }}
                  style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeftWithIcon}>
                    <MaterialCommunityIcons name="volume-high" size={20} color="#8E9BAE" />
                    <Text style={styles.rowTitle}>{t('soundEffects')}</Text>
                  </View>
                  <Switch
                    trackColor={{ false: '#1A212B', true: colors.primary }}
                    thumbColor={profile.soundEnabled ? '#0B0D0F' : '#8E9BAE'}
                    ios_backgroundColor="#1A212B"
                    onValueChange={(val) => {
                      hapticLight();
                      updateProfile({ soundEnabled: val });
                    }}
                    value={profile.soundEnabled}
                  />
                </Pressable>
              </View>

              {/* Program & Goal Preferences */}
              <Text style={styles.sectionTitle}>{language === 'uk' ? 'Ціль та параметри програми' : 'Goal & Program Preferences'}</Text>
              <View style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenPicker('goal')}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View>
                    <Text style={styles.rowTitle}>{language === 'uk' ? 'Основна ціль' : 'Primary Goal'}</Text>
                    <Text style={styles.rowSubtitle}>{translateGoal(profile.goal)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenPicker('experience')}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View>
                    <Text style={styles.rowTitle}>{language === 'uk' ? 'Рівень досвіду' : 'Experience Level'}</Text>
                    <Text style={styles.rowSubtitle}>{translateExperience(profile.experience)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenPicker('workoutsPerWeek')}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View>
                    <Text style={styles.rowTitle}>{language === 'uk' ? 'Тренувань на тиждень' : 'Workouts Per Week'}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.workoutsPerWeek} {language === 'uk' ? 'днів / тиждень' : 'days / week'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenPicker('split')}
                  style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
                >
                  <View>
                    <Text style={styles.rowTitle}>{language === 'uk' ? 'Структура спліту' : 'Training Split'}</Text>
                    <Text style={styles.rowSubtitle}>{translateSplit(currentSplitLabel)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>
              </View>

              {/* Account & Privacy */}
              <Text style={styles.sectionTitle}>{t('account')}</Text>
              <View style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setAppSettingsVisible(false);
                    setPrivacyModalVisible(true);
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowTitle}>{t('privacy')}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleContactSupport}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowTitle}>{t('support')}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setAppSettingsVisible(false);
                    handleRestartOnboarding();
                  }}
                  style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
                >
                  <View>
                    <Text style={[styles.rowTitle, { color: colors.primary }]}>{t('restartOnboarding')}</Text>
                    <Text style={styles.rowSubtitle}>{t('restartSubtitle')}</Text>
                  </View>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                </Pressable>
              </View>

              {/* Danger Zone */}
              <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('dangerZone')}</Text>
              <View style={[styles.card, styles.dangerCard]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setAppSettingsVisible(false);
                    handleResetPress();
                  }}
                  style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.dangerText}>
                      {isAuthenticated ? t('deleteAccountAndData') : t('resetAppData')}
                    </Text>
                    <Text style={styles.dangerSubText}>
                      {isAuthenticated ? t('deleteAccountSubtitle') : t('resetSubtitle')}
                    </Text>
                  </View>
                  <Ionicons name="trash-outline" size={18} color="#F87171" />
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* SPOT Access Modal: Beta Access or Pro Paywall */}
      {IS_BETA_MODE ? (
        <BetaAccessModal
          visible={proModalVisible}
          onClose={() => setProModalVisible(false)}
        />
      ) : (
        <ProPaywallModal
          visible={proModalVisible}
          onClose={() => setProModalVisible(false)}
          onOpenPrivacy={() => setPrivacyModalVisible(true)}
        />
      )}

      {/* Preference Picker Modals */}
      <PreferencePickerModal
        visible={activePicker === 'goal'}
        title={language === 'uk' ? 'Основна ціль' : 'Select Primary Goal'}
        options={GOAL_OPTIONS}
        selectedValue={profile.goal}
        onSelect={handleSelectGoal}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'experience'}
        title={language === 'uk' ? 'Рівень досвіду' : 'Select Experience Level'}
        options={EXPERIENCE_OPTIONS}
        selectedValue={profile.experience}
        onSelect={handleSelectExperience}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'workoutsPerWeek'}
        title={language === 'uk' ? 'Тренувань на тиждень' : 'Workouts Per Week'}
        options={WORKOUTS_PER_WEEK_OPTIONS}
        selectedValue={profile.workoutsPerWeek}
        onSelect={(workoutsPerWeek) => handleSelectWorkoutsPerWeek(workoutsPerWeek as number)}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'split'}
        title={language === 'uk' ? 'Структура програми' : 'Select Training Split'}
        options={SPLIT_OPTIONS}
        selectedValue={currentSplitLabel}
        onSelect={handleSelectSplit}
        onClose={() => setActivePicker(null)}
      />

      <RestTimePickerModal
        visible={restModalVisible}
        currentSeconds={profile.defaultRestSeconds}
        onSelect={(seconds) => updateProfile({ defaultRestSeconds: seconds })}
        onClose={() => setRestModalVisible(false)}
      />

      <ReminderTimePickerModal
        visible={reminderModalVisible}
        currentTime={profile.notificationTime || '09:00'}
        onSelect={(time) => updateProfile({ notificationTime: time })}
        onClose={() => setReminderModalVisible(false)}
      />

      <LanguagePickerModal
        visible={langModalVisible}
        currentLanguage={profile.language}
        onSelect={(lang) => updateProfile({ language: lang })}
        onClose={() => setLangModalVisible(false)}
      />

      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
      />

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
      />

      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  quickHubCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  quickHubTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickHubIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickHubTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quickHubSub: {
    color: '#8E9BAE',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  cloudCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 24,
  },
  cloudCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cloudIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudIconWrapActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  cloudInfo: {
    flex: 1,
  },
  cloudTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  cloudSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  cloudActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloudSyncBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudSignOutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudLoginBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cloudLoginBtnText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  beastPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  beastPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  userSubtitle: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  statsRow: {
    marginTop: 4,
  },
  statsText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chevronWrap: {
    marginLeft: 8,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  dangerTitle: {
    color: '#F87171',
    marginTop: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dangerCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.06)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 58,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  subRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingLeft: 22,
  },
  rowLeftWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.16)',
  },
  betaBadgeActive: {
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
  },
  proBadgeText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '800',
  },
  proBadgeTextActive: {
    color: colors.primary,
  },
  betaBadgeTextActive: {
    color: '#C4B5FD',
  },
  dangerText: {
    color: '#F87171',
    fontSize: 14.5,
    fontWeight: '700',
  },
  dangerSubText: {
    color: '#6C7A8E',
    fontSize: 12,
    marginTop: 2,
  },
  versionText: {
    color: '#475569',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 20,
  },
  segmentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
    width: 104,
  },
  segmentBtn: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentBtnText: {
    color: '#8E9BAE',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 14,
  },
  segmentBtnTextActive: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valuePill: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: colors.elevated,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    fontVariant: ['tabular-nums'],
  },
  // Pro Modal Styles
  proModalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  proModalHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  proCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proModalContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  proHeroCard: {
    width: '100%',
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.4)',
    marginVertical: 16,
  },
  proBrainWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 92, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  proKicker: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  proHeroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  proHeroSub: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  unlockList: {
    width: '100%',
    marginVertical: 16,
    gap: 12,
  },
  unlockHeader: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockItemText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pricingCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 20,
    marginBottom: 16,
  },
  pricingDays: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pricingSub: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  startProBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  startProBtnText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
});
