import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { PreferencePickerModal } from '@/components/profile/PreferencePickerModal';
import { RestTimePickerModal } from '@/components/profile/RestTimePickerModal';
import { LanguagePickerModal } from '@/components/profile/LanguagePickerModal';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  BEAST_AVATARS,
  useUserProfileStore,
  type UserExperience,
  type UserGoal,
} from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
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

export default function Profile() {
  const { t, language } = useI18n();
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);
  const program = useProgramStore((state) => state.program);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // Modals
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);

  useEffect(() => {
    useUserProfileStore.getState().loadProfile();
  }, []);

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

  const handleResetPress = () => {
    hapticMedium();
    Alert.alert(
      'Reset App Data?',
      'This will permanently delete your workout history, custom programs, and training progress. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'spot-onboarding',
                'spot-user-program',
                'spot-active-program',
                'spot-workout-history',
                'spot-program-progress',
                'spot-user-profile',
                'spot-active-workout-session',
              ]);

              await useWorkoutHistoryStore.getState().clearHistory();
              await useUserProfileStore.getState().resetProfile();
              await useProgramStore.getState().refreshProgram();
              const freshProgram = useProgramStore.getState().program;
              await useProgramProgressStore
                .getState()
                .resetProgress(freshProgram.id, freshProgram.workouts[0]?.id);

              await hapticSuccess();
              router.replace('/onboarding/welcome');
            } catch {
              Alert.alert('Error', 'Failed to reset some app data. Please restart the app.');
            }
          },
        },
      ]
    );
  };

  const handleRestartOnboarding = async () => {
    hapticMedium();
    await AsyncStorage.removeItem('spot-onboarding');
    router.replace('/onboarding/welcome');
  };

  const handleSelectSplit = async (selectedLabel: string) => {
    let splitKey: WorkoutSplitPreference = 'upper_lower';
    if (selectedLabel === 'Full Body') splitKey = 'full_body';
    else if (selectedLabel === 'Push / Pull / Legs') splitKey = 'push_pull_legs';
    else if (selectedLabel === 'Custom Routine') splitKey = 'custom';

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

  return (
    <SafeAreaView style={styles.safe}>
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
              <Ionicons name="pencil" size={10} color="#0B0D0F" />
            </View>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{profile.name.toUpperCase()}</Text>
              <View style={[styles.beastPill, { borderColor: currentBeast.color }]}>
                <Text style={[styles.beastPillText, { color: currentBeast.color }]}>
                  {currentBeast.label}
                </Text>
              </View>
            </View>

            <Text style={styles.userSubtitle}>
              {profile.experience} • {profile.goal}
            </Text>

            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {profile.weightUnit === 'lbs'
                  ? `${Math.round(profile.weightKg * 2.20462)} lbs`
                  : `${profile.weightKg} kg`}
                {' • '}
                {profile.heightUnit === 'ft'
                  ? `${(profile.heightCm / 30.48).toFixed(1)} ft`
                  : `${profile.heightCm} cm`}
                {' • '}
                BMI {bmi}
              </Text>
            </View>
          </View>

          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </View>
        </Pressable>

        {/* 2. TRAINING Section */}
        <Text style={styles.sectionTitle}>{t('training')}</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker('split')}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View>
              <Text style={styles.rowTitle}>{currentSplitLabel}</Text>
              <Text style={styles.rowSubtitle}>
                {program.splitType === 'full_body'
                  ? `3 full body ${t('sessions').toLowerCase()} / week`
                  : program.splitType === 'push_pull_legs'
                  ? 'Push / Pull / Legs rotation'
                  : program.splitType === 'custom'
                  ? t('customizedRoutine')
                  : 'Upper / Lower balanced split'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker('workoutsPerWeek')}
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
          >
            <View>
              <Text style={styles.rowTitle}>{t('frequency')}</Text>
              <Text style={styles.rowSubtitle}>{profile.workoutsPerWeek} {t('daysPerWeek')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </Pressable>
        </View>

        {/* 3. PREFERENCES Section */}
        <Text style={styles.sectionTitle}>{t('preferences')}</Text>
        <View style={styles.card}>
          {/* Weight Unit */}
          <View style={styles.row}>
            <View style={styles.rowLeftWithIcon}>
              <MaterialCommunityIcons name="weight-kilogram" size={20} color="#8E9BAE" />
              <View>
                <Text style={styles.rowTitle}>{t('weightUnit')}</Text>
                <Text style={styles.rowSubtitle}>
                  {profile.weightUnit === 'kg'
                    ? (language === 'uk' ? 'Кілограми (кг)' : 'Kilograms (kg)')
                    : (language === 'uk' ? 'Фунти (lbs)' : 'Pounds (lbs)')}
                </Text>
              </View>
            </View>
            <View style={styles.segmentWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set Kilograms"
                onPress={() => {
                  hapticLight();
                  updateProfile({ weightUnit: 'kg' });
                }}
                style={[styles.segmentBtn, profile.weightUnit === 'kg' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    profile.weightUnit === 'kg' && styles.segmentBtnTextActive,
                  ]}
                >
                  KG
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set Pounds"
                onPress={() => {
                  hapticLight();
                  updateProfile({ weightUnit: 'lbs' });
                }}
                style={[styles.segmentBtn, profile.weightUnit === 'lbs' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    profile.weightUnit === 'lbs' && styles.segmentBtnTextActive,
                  ]}
                >
                  LBS
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Height / Body Unit */}
          <View style={styles.row}>
            <View style={styles.rowLeftWithIcon}>
              <MaterialCommunityIcons name="ruler" size={20} color="#8E9BAE" />
              <View>
                <Text style={styles.rowTitle}>{t('heightUnit')}</Text>
                <Text style={styles.rowSubtitle}>
                  {profile.heightUnit === 'cm'
                    ? (language === 'uk' ? 'Сантиметри (см)' : 'Centimeters (cm)')
                    : (language === 'uk' ? 'Фути та дюйми (фути)' : 'Feet & Inches (ft)')}
                </Text>
              </View>
            </View>
            <View style={styles.segmentWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set Centimeters"
                onPress={() => {
                  hapticLight();
                  updateProfile({ heightUnit: 'cm' });
                }}
                style={[styles.segmentBtn, profile.heightUnit === 'cm' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    profile.heightUnit === 'cm' && styles.segmentBtnTextActive,
                  ]}
                >
                  CM
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set Feet"
                onPress={() => {
                  hapticLight();
                  updateProfile({ heightUnit: 'ft' });
                }}
                style={[styles.segmentBtn, profile.heightUnit === 'ft' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    profile.heightUnit === 'ft' && styles.segmentBtnTextActive,
                  ]}
                >
                  FT
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Rest Timer */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change Rest Timer"
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
                  {Math.floor(profile.defaultRestSeconds / 60)}:{(profile.defaultRestSeconds % 60).toString().padStart(2, '0')} {t('min')}
                </Text>
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valuePill}>
                {Math.floor(profile.defaultRestSeconds / 60)}:{(profile.defaultRestSeconds % 60).toString().padStart(2, '0')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
            </View>
          </Pressable>

          {/* Language Selector */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change Language"
            onPress={() => {
              hapticLight();
              setLangModalVisible(true);
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
            <View style={styles.valueRow}>
              <Text style={styles.valuePill}>
                {profile.language === 'uk' ? '🇺🇦 UK' : '🇺🇸 EN'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
            </View>
          </Pressable>

          {/* Notifications */}
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowLeftWithIcon}>
              <Ionicons name="notifications-outline" size={20} color="#8E9BAE" />
              <Text style={styles.rowTitle}>{t('notifications')}</Text>
            </View>
            <Switch
              trackColor={{ false: '#1A212B', true: colors.primary }}
              thumbColor={profile.notifications ? '#0B0D0F' : '#8E9BAE'}
              ios_backgroundColor="#1A212B"
              onValueChange={(val) => {
                hapticLight();
                updateProfile({ notifications: val });
              }}
              value={profile.notifications}
            />
          </View>

          {/* Sound Effects */}
          <View style={[styles.row, styles.rowLast]}>
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
          </View>
        </View>

        {/* 4. ACCOUNT Section */}
        <Text style={styles.sectionTitle}>{t('account')}</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setProModalVisible(true);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowTitle}>{t('subscription')}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              Alert.alert('Purchases Restored', 'Your account has been synced.');
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowTitle}>{t('restorePurchases')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              Alert.alert('Privacy Policy', 'Your workout data stays secure on your device.');
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowTitle}>{t('privacy')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              Alert.alert('Support', 'Contact SPOT team at support@spotapp.fit');
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowTitle}>{t('support')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E9BAE" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart Onboarding"
            onPress={handleRestartOnboarding}
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
          >
            <View>
              <Text style={[styles.rowTitle, { color: colors.primary }]}>{t('restartOnboarding')}</Text>
              <Text style={styles.rowSubtitle}>{t('restartSubtitle')}</Text>
            </View>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* 5. Danger Zone */}
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('dangerZone')}</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <Pressable
            accessibilityRole="button"
            onPress={handleResetPress}
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
          >
            <View>
              <Text style={styles.dangerText}>{t('resetAppData')}</Text>
              <Text style={styles.dangerSubText}>
                {t('resetSubtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#F87171" />
          </Pressable>
        </View>

        <Text style={styles.versionText}>SPOT 1.0.0 • AI-POWERED TRAINING</Text>
      </ScrollView>

      {/* Screen 17: GETTING SMARTER PRO PAYWALL MODAL */}
      <Modal
        visible={proModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setProModalVisible(false)}
      >
        <SafeAreaView style={styles.proModalSafe}>
          <View style={styles.proModalHeader}>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setProModalVisible(false)}
              style={styles.proCloseBtn}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.proModalContent}>
            {/* Banner with gradient aesthetic */}
            <View style={styles.proHeroCard}>
              <View style={styles.proBrainWrap}>
                <MaterialCommunityIcons name="brain" size={32} color="#7C5CFF" />
              </View>
              <Text style={styles.proKicker}>YOUR TRAINING IS</Text>
              <Text style={styles.proHeroTitle}>GETTING SMARTER</Text>
              <Text style={styles.proHeroSub}>
                SPOT found 7 patterns in your training.
              </Text>
            </View>

            {/* Unlock Feature List */}
            <View style={styles.unlockList}>
              <Text style={styles.unlockHeader}>Unlock:</Text>

              {[
                'Adaptive progression',
                'AI Coach',
                'Recovery insights',
                'Weekly AI reviews',
                'Advanced analytics',
              ].map((item) => (
                <View key={item} style={styles.unlockRow}>
                  <View style={styles.checkCircleSmall}>
                    <Ionicons name="checkmark" size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.unlockItemText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Trial & Pricing */}
            <View style={styles.pricingCard}>
              <Text style={styles.pricingDays}>7 DAYS FREE</Text>
              <Text style={styles.pricingSub}>$49.99 / YEAR</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticSuccess();
                setProModalVisible(false);
                Alert.alert('Welcome to SPOT Pro', 'All AI features unlocked!');
              }}
              style={styles.startProBtn}
            >
              <Text style={styles.startProBtnText}>Start</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Preference Picker Modals */}
      <PreferencePickerModal
        visible={activePicker === 'goal'}
        title="Select Primary Goal"
        options={GOAL_OPTIONS}
        selectedValue={profile.goal}
        onSelect={(goal) => updateProfile({ goal })}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'experience'}
        title="Select Experience Level"
        options={EXPERIENCE_OPTIONS}
        selectedValue={profile.experience}
        onSelect={(experience) => updateProfile({ experience })}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'workoutsPerWeek'}
        title="Workouts Per Week"
        options={WORKOUTS_PER_WEEK_OPTIONS}
        selectedValue={profile.workoutsPerWeek}
        onSelect={(workoutsPerWeek) => handleSelectWorkoutsPerWeek(workoutsPerWeek as number)}
        onClose={() => setActivePicker(null)}
      />

      <PreferencePickerModal
        visible={activePicker === 'split'}
        title="Select Training Split"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#12161D',
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
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  beastPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  beastPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  userSubtitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    marginTop: 4,
  },
  statsText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chevronWrap: {
    marginLeft: 8,
  },
  sectionTitle: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  dangerTitle: {
    color: '#F87171',
    marginTop: 18,
  },
  card: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(248, 113, 113, 0.25)',
    backgroundColor: 'rgba(248, 113, 113, 0.04)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowLeftWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
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
    backgroundColor: 'rgba(124, 92, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7C5CFF',
  },
  proBadgeText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '900',
  },
  dangerText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '800',
  },
  dangerSubText: {
    color: '#6C7A8E',
    fontSize: 12,
    marginTop: 2,
  },
  versionText: {
    color: '#4B5565',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
  },
  segmentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: 108,
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 14,
  },
  segmentBtnTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valuePill: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  // Pro Modal Styles
  proModalSafe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
});
