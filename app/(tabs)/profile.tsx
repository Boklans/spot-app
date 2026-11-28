import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthModal } from '@/components/auth/AuthModal';
import { BetaAccessModal } from '@/components/profile/BetaAccessModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { LanguagePickerModal } from '@/components/profile/LanguagePickerModal';
import { PreferencePickerModal } from '@/components/profile/PreferencePickerModal';
import { PrivacyPolicyModal } from '@/components/profile/PrivacyPolicyModal';
import { ProfileBackupModal } from '@/components/profile/ProfileBackupModal';
import { ProfileNotesModal } from '@/components/profile/ProfileNotesModal';
import { ProfileSettingsModal, type ProfilePickerType } from '@/components/profile/ProfileSettingsModal';
import { ProPaywallModal } from '@/components/profile/ProPaywallModal';
import { ReminderTimePickerModal } from '@/components/profile/ReminderTimePickerModal';
import { RestTimePickerModal } from '@/components/profile/RestTimePickerModal';
import { useWorkoutBarBottomInset } from '@/components/ui/Screen';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { getSyncStatus, subscribeSyncStatus, syncUp, wipeAllCloudUserData, type SyncStatus } from '@/lib/cloudSync';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { requestNotificationPermissions } from '@/lib/notificationService';
import { countWorkoutsThisWeek } from '@/lib/progressCalculator';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useWeightUnit } from '@/lib/weightUtils';
import { useAuthStore } from '@/store/authStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useCustomExercisesStore } from '@/store/customExercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  BEAST_AVATARS,
  useUserProfileStore,
  type UserExperience,
  type UserGoal,
} from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import {
  clearOnboardingCache,
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.4';

const GOAL_OPTIONS: UserGoal[] = [
  'Build Muscle',
  'Lose Fat',
  'Get Stronger',
  'Recomposition',
];

const EXPERIENCE_OPTIONS: UserExperience[] = ['Beginner', 'Intermediate', 'Advanced'];
const WORKOUTS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];
const SPLIT_OPTIONS = ['Full Body', 'Upper / Lower', 'Push / Pull / Legs', 'Custom Routine'];

export const IS_BETA_MODE = true;

export default function Profile() {
  const { language } = useI18n();
  const isUk = language === 'uk';
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomBarInset = useWorkoutBarBottomInset(40);
  const { formatVolume } = useWeightUnit();

  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);
  const program = useProgramStore((state) => state.program);
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const notes = useExerciseNotesStore((state) => state.notes);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [activePicker, setActivePicker] = useState<ProfilePickerType | null>(null);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [appSettingsVisible, setAppSettingsVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    useUserProfileStore.getState().loadProfile();
    useWorkoutHistoryStore.getState().loadHistory();
    useExerciseNotesStore.getState().loadNotes();
    useBodyWeightStore.getState().loadHistory();
    return subscribeSyncStatus(setSyncStatus);
  }, []);

  const notesCount = useMemo(
    () => Object.values(notes).filter((text) => text && text.trim().length > 0).length,
    [notes]
  );

  const totalVolumeAllTime = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0),
    [workouts]
  );

  const workoutsThisWeek = useMemo(() => countWorkoutsThisWeek(workouts), [workouts]);
  const isAuthenticated = Boolean(user);
  const currentBeast = BEAST_AVATARS[profile.avatar] ?? BEAST_AVATARS.gorilla;
  const heightM = profile.heightCm / 100;
  const bmi =
    heightM > 0 && profile.weightKg > 0
      ? (profile.weightKg / (heightM * heightM)).toFixed(1)
      : '24.0';

  const translateGoal = (g: string) => {
    if (!isUk) return g;
    if (g === 'Build Muscle') return 'Набір м’язів';
    if (g === 'Lose Fat') return 'Зниження ваги';
    if (g === 'Get Stronger') return 'Розвиток сили';
    if (g === 'Recomposition') return 'Рекомпозиція';
    return g;
  };

  const translateExperience = (exp: string) => {
    if (!isUk) return exp;
    if (exp === 'Beginner') return 'Початківець';
    if (exp === 'Intermediate') return 'Середній';
    if (exp === 'Advanced') return 'Досвідчений';
    return exp;
  };

  const translateSplit = (s: string) => {
    if (!isUk) return s;
    if (s === 'Full Body') return 'Все тіло (Full Body)';
    if (s === 'Upper / Lower') return 'Верх / Низ';
    if (s === 'Push / Pull / Legs') return 'Жим / Тяга / Ноги';
    if (s === 'Custom Routine') return 'Власна програма';
    return s;
  };

  const currentSplitLabel =
    program.splitType === 'full_body'
      ? 'Full Body'
      : program.splitType === 'push_pull_legs'
        ? 'Push / Pull / Legs'
        : program.splitType === 'custom'
          ? 'Custom Routine'
          : 'Upper / Lower';

  const handleManualSync = async () => {
    hapticMedium();
    const res = await syncUp();
    if (res.success) {
      hapticSuccess();
    } else {
      Alert.alert(
        isUk ? 'Помилка синхронізації' : 'Sync Error',
        res.error || (isUk ? 'Перевірте інтернет-з’язок' : 'Check network connection')
      );
    }
  };

  const handleSignOut = () => {
    hapticMedium();
    Alert.alert(
      isUk ? 'Вийти з акаунта?' : 'Sign Out?',
      isUk
        ? 'Ваші тренування залишаться на цьому телефоні і будуть збережені в хмарі.'
        : 'Your workouts will remain on this device and saved in the cloud.',
      [
        { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isUk ? 'Вийти' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            hapticLight();
          },
        },
      ]
    );
  };

  const confirmProgramRebuild = (onConfirm: () => Promise<void>) => {
    Alert.alert(
      isUk ? 'Оновити програму тренувань?' : 'Rebuild training program?',
      isUk
        ? 'Бажаєте перегенерувати активну програму під нові параметри? Поточну чергу тренувань буде скинуто до Дня 1.'
        : 'Would you like to regenerate your active program for these new settings? Your workout rotation will reset to Day 1.',
      [
        {
          text: isUk ? 'Залишити поточну' : 'Keep current',
          style: 'cancel',
          onPress: () => {
            hapticLight();
          },
        },
        {
          text: isUk ? 'Оновити програму' : 'Rebuild program',
          style: 'destructive',
          onPress: () => {
            void onConfirm();
          },
        },
      ]
    );
  };

  const handleSelectGoal = async (goal: UserGoal) => {
    if (profile.goal === goal) return;
    await updateProfile({ goal });
    const goalKeyMap: Record<UserGoal, 'build_muscle' | 'lose_fat' | 'get_stronger' | 'recomposition'> = {
      'Build Muscle': 'build_muscle',
      'Lose Fat': 'lose_fat',
      'Get Stronger': 'get_stronger',
      Recomposition: 'recomposition',
    };
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, goal: goalKeyMap[goal] || 'build_muscle' };
    await saveOnboarding(updated);
    confirmProgramRebuild(async () => {
      await useProgramStore.getState().refreshProgram(updated);
      const newProgram = useProgramStore.getState().program;
      await useProgramProgressStore.getState().resetProgress(newProgram.id, newProgram.workouts[0]?.id);
      hapticSuccess();
    });
  };

  const handleSelectExperience = async (experience: UserExperience) => {
    if (profile.experience === experience) return;
    await updateProfile({ experience });
    const expKeyMap: Record<UserExperience, 'beginner' | 'intermediate' | 'advanced'> = {
      Beginner: 'beginner',
      Intermediate: 'intermediate',
      Advanced: 'advanced',
    };
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, experience: expKeyMap[experience] || 'beginner' };
    await saveOnboarding(updated);
    confirmProgramRebuild(async () => {
      await useProgramStore.getState().refreshProgram(updated);
      const newProgram = useProgramStore.getState().program;
      await useProgramProgressStore.getState().resetProgress(newProgram.id, newProgram.workouts[0]?.id);
      hapticSuccess();
    });
  };

  const handleSelectWorkoutsPerWeek = async (count: number) => {
    if (profile.workoutsPerWeek === count) return;
    await updateProfile({ workoutsPerWeek: count });
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, trainingFrequency: count };
    await saveOnboarding(updated);
    confirmProgramRebuild(async () => {
      await useProgramStore.getState().refreshProgram(updated);
      const newProgram = useProgramStore.getState().program;
      await useProgramProgressStore.getState().resetProgress(newProgram.id, newProgram.workouts[0]?.id);
      hapticSuccess();
    });
  };

  const handleSelectSplit = async (selectedLabel: string) => {
    const s = String(selectedLabel).toLowerCase().trim();
    let splitKey: WorkoutSplitPreference = 'upper_lower';
    if (s.includes('full') || s.includes('все тіло') || s.includes('фул')) splitKey = 'full_body';
    else if (s.includes('push') || s.includes('pull') || s.includes('ppl') || s.includes('жим') || s.includes('тяга')) {
      splitKey = 'push_pull_legs';
    } else if (s.includes('custom') || s.includes('власн')) splitKey = 'custom';
    else if (s.includes('upper') || s.includes('lower') || s.includes('верх') || s.includes('низ')) {
      splitKey = 'upper_lower';
    }

    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    if ((currentOnboarding.splitPreference ?? program.splitType) === splitKey) return;

    Alert.alert(
      isUk ? 'Змінити спліт програми?' : 'Switch program split?',
      isUk
        ? 'Перемикання спліту замінить активну програму тренувань та скине чергу до Дня 1.'
        : 'Switching splits will replace your active training program and reset your rotation to Day 1.',
      [
        { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isUk ? 'Змінити' : 'Switch',
          style: 'destructive',
          onPress: async () => {
            const updated = { ...currentOnboarding, splitPreference: splitKey };
            await saveOnboarding(updated);
            await useProgramStore.getState().refreshProgram(updated);
            const newProgram = useProgramStore.getState().program;
            await useProgramProgressStore.getState().resetProgress(newProgram.id, newProgram.workouts[0]?.id);
            hapticSuccess();
          },
        },
      ]
    );
  };

  const handleToggleNotifications = async (val: boolean) => {
    hapticLight();
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          isUk ? 'Потрібен дозвіл' : 'Permission Required',
          isUk
            ? 'Будь ласка, увімкніть дозвіл на сповіщення в системних налаштуваннях телефона.'
            : 'Please allow notification permissions in your device settings.'
        );
      }
    }
    await updateProfile({ notifications: val });
  };

  const handleContactSupport = () => {
    hapticMedium();
    const email = 'vanzalabs@gmail.com';
    const subject = encodeURIComponent(isUk ? 'Підтримка SPOT — Запит' : 'SPOT Support Request');
    Linking.openURL(`mailto:${email}?subject=${subject}`).catch(() => {
      Alert.alert(
        isUk ? 'Служба підтримки' : 'Support',
        `${isUk ? 'Напишіть нам на електронну пошту:\n\n' : 'Please email us at:\n\n'}${email}`
      );
    });
  };

  const handleOpenTelegram = () => {
    hapticMedium();
    Linking.openURL('https://t.me/vanzalabs').catch(() => {
      Alert.alert(
        'Telegram',
        isUk ? 'Зв’яжіться з нами в Telegram: @vanzalabs' : 'Reach out to us on Telegram: @vanzalabs'
      );
    });
  };

  const handleRestartOnboarding = async () => {
    hapticMedium();
    try {
      clearOnboardingCache();
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

  const handleResetPress = () => {
    hapticMedium();
    Alert.alert(
      isAuthenticated
        ? isUk
          ? 'Видалити акаунт та всі дані?'
          : 'Delete Account & All Data?'
        : isUk
          ? 'Скинути всі дані додатку?'
          : 'Reset App Data?',
      isAuthenticated
        ? isUk
          ? 'Це назавжди видалить ваш хмарний акаунт, історію тренувань, створені програми та весь прогрес. Цю дію неможливо скасувати.'
          : 'This will permanently delete your cloud account, workout history, custom programs, and all progress. This action cannot be undone.'
        : isUk
          ? 'Це назавжди видалить історію тренувань, створені кастомні програми та весь прогрес. Цю дію неможливо скасувати.'
          : 'This will permanently delete your workout history, custom programs, and training progress. This action cannot be undone.',
      [
        { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isAuthenticated
            ? isUk
              ? 'Видалити акаунт'
              : 'Delete Account'
            : isUk
              ? 'Скинути все'
              : 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isSupabaseConfigured()) {
                await wipeAllCloudUserData();
              }
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                (k) =>
                  k.startsWith('spot') ||
                  k.includes('workout') ||
                  k.includes('program') ||
                  k.includes('onboarding') ||
                  k.includes('profile') ||
                  k.includes('body-weight') ||
                  k.includes('session') ||
                  k.includes('notes')
              );
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }
              clearOnboardingCache();
              useWorkoutSessionStore.getState().clearSession();
              await useWorkoutHistoryStore.getState().clearHistory();
              await useUserProfileStore.getState().resetProfile();
              await useBodyWeightStore.getState().clearHistory();
              await useProgramStore.getState().resetProgram();
              await useExerciseNotesStore.getState().clearNotes();
              await useCustomExercisesStore.getState().clearCustomExercises();
              await hapticSuccess();
              setAppSettingsVisible(false);
              router.replace('/onboarding/welcome');
            } catch {
              Alert.alert(
                isUk ? 'Помилка' : 'Error',
                isUk
                  ? 'Не вдалося скинути деякі дані додатку. Будь ласка, перезапустіть додаток.'
                  : 'Failed to reset some app data. Please restart the app.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Clean Header with Quick Settings Trigger */}
      <View style={styles.topHeader}>
        <Text style={styles.screenTitle}>{isUk ? 'Профіль' : 'Profile'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="App Settings"
          onPress={() => {
            hapticLight();
            setAppSettingsVisible(true);
          }}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomBarInset }]}
      >
        <View>
          {/* 1. Athlete Identity Hero Card + Key Telemetry Strip */}
          <View style={styles.heroCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Profile"
              onPress={() => {
                hapticLight();
                setEditProfileVisible(true);
              }}
              style={({ pressed }) => [styles.heroTopRow, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, { backgroundColor: currentBeast.color }]}>
                  {profile.customAvatarUri ? (
                    <Image
                      source={{ uri: profile.customAvatarUri }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarEmoji}>{currentBeast.emoji}</Text>
                  )}
                </View>
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={11} color={colors.text} />
                </View>
              </View>

              <View style={styles.headerInfo}>
                <Text style={styles.userName}>{profile.name}</Text>
                <Text style={styles.userSubtitle}>
                  {translateExperience(profile.experience)} · {translateGoal(profile.goal)}
                </Text>
                <Text style={styles.statsText}>
                  {profile.weightUnit === 'lbs'
                    ? `${Math.round(profile.weightKg * 2.20462)} lbs`
                    : `${profile.weightKg} ${isUk ? 'кг' : 'kg'}`}
                  {' · '}
                  {profile.heightUnit === 'ft'
                    ? `${(profile.heightCm / 30.48).toFixed(1)} ft`
                    : `${profile.heightCm} ${isUk ? 'см' : 'cm'}`}
                  {' · '}
                  {isUk ? 'ІМТ' : 'BMI'} {bmi}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>

            {/* Athlete Lifetime Telemetry Strip */}
            <View style={styles.athleteStatsBar}>
              <View style={styles.athleteStatCol}>
                <Text style={styles.athleteStatVal}>{workouts.length}</Text>
                <Text style={styles.athleteStatLbl}>{isUk ? 'Сесій' : 'Sessions'}</Text>
              </View>
              <View style={styles.athleteStatDivider} />
              <View style={styles.athleteStatCol}>
                <Text style={styles.athleteStatVal}>
                  {totalVolumeAllTime > 0 ? formatVolume(totalVolumeAllTime) : isUk ? '0 кг' : '0 kg'}
                </Text>
                <Text style={styles.athleteStatLbl}>{isUk ? 'Тоннаж' : 'Volume'}</Text>
              </View>
              <View style={styles.athleteStatDivider} />
              <View style={styles.athleteStatCol}>
                <Text style={[styles.athleteStatVal, { color: colors.primaryText }]}>
                  {workoutsThisWeek}/{program.daysPerWeek || 3}
                </Text>
                <Text style={styles.athleteStatLbl}>{isUk ? 'Цей тиждень' : 'This Week'}</Text>
              </View>
            </View>
          </View>

          {/* 2. Quick Access Hub: Workout History & Exercise Notes */}
          <View style={styles.hubRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                router.push('/history');
              }}
              style={({ pressed }) => [styles.quickHubCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.quickHubTopRow}>
                <View style={styles.quickHubIconWrap}>
                  <Ionicons name="time-outline" size={18} color={colors.text} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
              <View>
                <Text style={styles.quickHubTitle}>
                  {isUk ? 'Історія тренувань' : 'Workout History'}
                </Text>
                <Text style={styles.quickHubSub}>
                  {isUk
                    ? `${workouts.length} сесій · Тоді vs Зараз`
                    : `${workouts.length} ${workouts.length === 1 ? 'session' : 'sessions'} · Compare`}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setNotesModalVisible(true);
              }}
              style={({ pressed }) => [styles.quickHubCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.quickHubTopRow}>
                <View style={styles.quickHubIconWrap}>
                  <Ionicons name="bookmark-outline" size={17} color={colors.text} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
              <View>
                <Text style={styles.quickHubTitle}>
                  {isUk ? 'Мої нотатки' : 'Exercise Notes'}
                </Text>
                <Text style={styles.quickHubSub}>
                  {isUk ? `${notesCount} збережених підказок` : `${notesCount} saved cues`}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 3. Cloud Account & Sync Card */}
          <View style={styles.cloudCard}>
            <View style={styles.cloudCardLeft}>
              <View style={[styles.cloudIconWrap, isAuthenticated && styles.cloudIconWrapActive]}>
                <Ionicons
                  name={isAuthenticated ? 'cloud-done-outline' : 'cloud-outline'}
                  size={20}
                  color={isAuthenticated ? colors.primaryText : colors.secondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cloudTitle} numberOfLines={1}>
                  {isAuthenticated
                    ? user?.email || (isUk ? 'Хмарний акаунт' : 'Cloud Account')
                    : isUk
                      ? 'Хмарна синхронізація'
                      : 'Cloud Backup & Sync'}
                </Text>
                <Text style={styles.cloudSubtitle}>
                  {isAuthenticated
                    ? syncStatus.isSyncing
                      ? isUk
                        ? 'Синхронізація...'
                        : 'Syncing...'
                      : syncStatus.lastSyncedAt
                        ? (isUk ? 'Оновлено: ' : 'Synced: ') +
                          new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : isUk
                          ? 'Дані синхронізовано'
                          : 'Data is up to date'
                    : isUk
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
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Ionicons name="sync" size={17} color={colors.text} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  onPress={handleSignOut}
                  style={({ pressed }) => [styles.cloudSignOutBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="log-out-outline" size={17} color={colors.danger} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                onPress={() => setAuthModalVisible(true)}
                style={({ pressed }) => [styles.cloudLoginBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.cloudLoginBtnText}>{isUk ? 'Увійти' : 'Sign In'}</Text>
              </Pressable>
            )}
          </View>

          {/* 4. Settings, Backup & Community Card */}
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
                  <Ionicons name="options-outline" size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Налаштування застосунку' : 'App Preferences & Units'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {profile.language === 'uk' ? 'УКР' : 'EN'} · {profile.weightUnit.toUpperCase()} ·{' '}
                    {Math.floor(profile.defaultRestSeconds / 60)}:
                    {(profile.defaultRestSeconds % 60).toString().padStart(2, '0')} ·{' '}
                    {isUk ? 'Сповіщення та тема' : 'Alerts & Theme'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setBackupModalVisible(true);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeftWithIcon}>
                <View style={styles.rowIconBox}>
                  <Ionicons name="archive-outline" size={17} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Резервна копія даних (JSON)' : 'Data Backup & Restore (JSON)'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {isUk
                      ? 'Експорт історії, програми й нотаток або імпорт із файлу'
                      : 'Export workouts, program & notes or import backup'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Telegram Community"
              onPress={handleOpenTelegram}
              style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeftWithIcon}>
                <View style={styles.rowIconBox}>
                  <Ionicons name="paper-plane-outline" size={17} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Спільнота та підтримка в Telegram' : 'Telegram Community & Support'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    @vanzalabs · {isUk ? 'Зворотний зв’язок та ідеї' : 'Feedback & direct contact'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={styles.versionText}>SPOT v{APP_VERSION} · VanzaLabs</Text>
        </View>
      </ScrollView>

      {/* Modular Modals */}
      <ProfileBackupModal visible={backupModalVisible} onClose={() => setBackupModalVisible(false)} />
      <ProfileNotesModal visible={notesModalVisible} onClose={() => setNotesModalVisible(false)} />
      <ProfileSettingsModal
        visible={appSettingsVisible}
        profile={profile}
        isAuthenticated={isAuthenticated}
        currentSplitLabel={currentSplitLabel}
        translateGoal={translateGoal}
        translateExperience={translateExperience}
        translateSplit={translateSplit}
        onClose={() => setAppSettingsVisible(false)}
        onUpdateProfile={(u) => updateProfile(u)}
        onToggleNotifications={handleToggleNotifications}
        onOpenRestPicker={() => setRestModalVisible(true)}
        onOpenReminderTimePicker={() => setReminderModalVisible(true)}
        onOpenPicker={(p) => {
          hapticLight();
          setActivePicker(p);
        }}
        onOpenPrivacy={() => setPrivacyModalVisible(true)}
        onContactSupport={handleContactSupport}
        onRestartOnboarding={handleRestartOnboarding}
        onResetAll={handleResetPress}
      />

      {IS_BETA_MODE ? (
        <BetaAccessModal visible={proModalVisible} onClose={() => setProModalVisible(false)} />
      ) : (
        <ProPaywallModal
          visible={proModalVisible}
          onClose={() => setProModalVisible(false)}
          onOpenPrivacy={() => setPrivacyModalVisible(true)}
        />
      )}

      <PreferencePickerModal
        visible={activePicker === 'goal'}
        title={isUk ? 'Основна ціль' : 'Select Primary Goal'}
        options={GOAL_OPTIONS}
        selectedValue={profile.goal}
        onSelect={handleSelectGoal}
        onClose={() => setActivePicker(null)}
      />
      <PreferencePickerModal
        visible={activePicker === 'experience'}
        title={isUk ? 'Рівень досвіду' : 'Select Experience Level'}
        options={EXPERIENCE_OPTIONS}
        selectedValue={profile.experience}
        onSelect={handleSelectExperience}
        onClose={() => setActivePicker(null)}
      />
      <PreferencePickerModal
        visible={activePicker === 'workoutsPerWeek'}
        title={isUk ? 'Тренувань на тиждень' : 'Workouts Per Week'}
        options={WORKOUTS_PER_WEEK_OPTIONS}
        selectedValue={profile.workoutsPerWeek}
        onSelect={(count) => handleSelectWorkoutsPerWeek(count as number)}
        onClose={() => setActivePicker(null)}
      />
      <PreferencePickerModal
        visible={activePicker === 'split'}
        title={isUk ? 'Структура програми' : 'Select Training Split'}
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
      <EditProfileModal visible={editProfileVisible} onClose={() => setEditProfileVisible(false)} />
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      <PrivacyPolicyModal visible={privacyModalVisible} onClose={() => setPrivacyModalVisible(false)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 10,
    },
    screenTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 27,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...cardElevation(colors),
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 40,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 16,
      marginBottom: 12,
      ...cardElevation(colors),
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarWrap: {
      position: 'relative',
      marginRight: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
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
    userName: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 19,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    userSubtitle: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12.5,
      fontWeight: '500',
      marginTop: 2,
    },
    statsText: {
      fontFamily: fonts.semiBold,
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
      fontVariant: ['tabular-nums'],
    },
    athleteStatsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    athleteStatCol: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    athleteStatVal: {
      fontFamily: fonts.bold,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    athleteStatLbl: {
      fontFamily: fonts.medium,
      fontSize: 11,
      fontWeight: '500',
      color: colors.secondary,
    },
    athleteStatDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.divider,
    },
    hubRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    quickHubCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md + 2,
      padding: 14,
      gap: 10,
      ...cardElevation(colors),
    },
    quickHubTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    quickHubIconWrap: {
      width: 34,
      height: 34,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickHubTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    quickHubSub: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 11.5,
      fontWeight: '500',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    cloudCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii.md + 2,
      padding: 14,
      marginBottom: 14,
      ...cardElevation(colors),
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
      borderRadius: radii.sm,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cloudIconWrapActive: {
      backgroundColor: colors.primaryMuted,
    },
    cloudTitle: {
      fontFamily: fonts.bold,
      fontSize: 14.5,
      fontWeight: '700',
      color: colors.text,
    },
    cloudSubtitle: {
      fontFamily: fonts.medium,
      fontSize: 12,
      fontWeight: '500',
      color: colors.secondary,
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
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cloudSignOutBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.xs + 2,
      backgroundColor: 'rgba(248, 113, 113, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cloudLoginBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.xs + 2,
    },
    cloudLoginBtnText: {
      fontFamily: fonts.bold,
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.md + 2,
      marginBottom: 16,
      overflow: 'hidden',
      ...cardElevation(colors),
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
      backgroundColor: colors.elevated,
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
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 14.5,
      fontWeight: '600',
    },
    rowSubtitle: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    versionText: {
      fontFamily: fonts.semiBold,
      color: colors.muted,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.6,
      marginTop: 12,
    },
  });
