import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PreferencePickerModal } from '@/components/profile/PreferencePickerModal';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  useUserProfileStore,
  type UserExperience,
  type UserGoal,
} from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';

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

type ActivePicker = 'goal' | 'experience' | 'workoutsPerWeek' | null;

export default function Profile() {
  const [userName, setUserName] = useState(defaultOnboarding.name);
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setUserName(data.name);
    });
    useUserProfileStore.getState().loadProfile();
  }, []);

  const handleOpenPicker = (picker: ActivePicker) => {
    hapticLight();
    setActivePicker(picker);
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
              // 1. Remove all core storage keys
              await AsyncStorage.multiRemove([
                'spot-user-program',
                'spot-active-program',
                'spot-workout-history',
                'spot-program-progress',
                'spot-user-profile',
                'spot-active-workout-session',
              ]);

              // 2. Reset in-memory states
              await useWorkoutHistoryStore.getState().clearHistory();
              await useUserProfileStore.getState().resetProfile();
              await useProgramStore.getState().refreshProgram();
              const freshProgram = useProgramStore.getState().program;
              await useProgramProgressStore
                .getState()
                .resetProgress(freshProgram.id, freshProgram.workouts[0]?.id);

              await hapticSuccess();
              Alert.alert('Reset Complete', 'App data has been reset to defaults.');
            } catch {
              Alert.alert('Error', 'Failed to reset some app data. Please restart the app.');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>PROFILE</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>

      {/* Training Preferences */}
      <Text style={styles.sectionLabel}>TRAINING PREFERENCES</Text>
      <Card style={styles.card}>
        {/* Goal */}
        <Pressable
          accessibilityRole="button"
          onPress={() => handleOpenPicker('goal')}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Primary Goal</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{profile.goal}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        {/* Experience */}
        <Pressable
          accessibilityRole="button"
          onPress={() => handleOpenPicker('experience')}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Experience Level</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{profile.experience}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        {/* Workouts / Week */}
        <Pressable
          accessibilityRole="button"
          onPress={() => handleOpenPicker('workoutsPerWeek')}
          style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Workouts / Week</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{profile.workoutsPerWeek} days</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </Card>

      {/* Danger Zone */}
      <Text style={[styles.sectionLabel, styles.dangerSectionLabel]}>DANGER ZONE</Text>
      <Card style={[styles.card, styles.dangerCard]}>
        <Pressable
          accessibilityRole="button"
          onPress={handleResetPress}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.rowPressed]}
        >
          <View>
            <Text style={styles.dangerButtonText}>Reset App Data</Text>
            <Text style={styles.dangerSubText}>
              Wipe workout history, custom programs, and progress
            </Text>
          </View>
          <Text style={styles.dangerChevron}>›</Text>
        </Pressable>
      </Card>

      <Text style={styles.versionText}>SPOT 1.0.0</Text>

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
        onSelect={(workoutsPerWeek) => updateProfile({ workoutsPerWeek })}
        onClose={() => setActivePicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.background,
    fontSize: 22,
    fontWeight: '900',
  },
  headerInfo: {
    justifyContent: 'center',
  },
  title: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  userName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.secondary,
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  dangerSectionLabel: {
    color: 'rgba(255, 92, 92, 0.8)',
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(255, 92, 92, 0.25)',
    backgroundColor: 'rgba(255, 92, 92, 0.04)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    color: colors.muted,
    fontSize: 20,
    lineHeight: 22,
  },
  dangerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
  dangerSubText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  dangerChevron: {
    color: colors.danger,
    fontSize: 20,
    lineHeight: 22,
  },
  versionText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
});
