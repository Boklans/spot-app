import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import { generateProgram, getWorkoutDayLabel, type GeneratedProgram } from '@/lib/programGenerator';
import { useProgramStore } from '@/store/programStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
} from '@/store/workoutStore';
import type { UserWorkout } from '@/types/userProgram';

const GOAL_LABELS: Record<OnboardingData['goal'], string> = {
  build_muscle: 'Hypertrophy & Size',
  get_stronger: 'Maximal Strength',
  lose_fat: 'Fat Loss & Conditioning',
  recomposition: 'Recomposition',
};

export default function ProgramReady() {
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboarding);
  const [program, setProgram] = useState<GeneratedProgram>(() =>
    generateProgram(defaultOnboarding)
  );
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);

  useEffect(() => {
    loadOnboarding().then((data) => {
      const next = data ?? defaultOnboarding;
      setOnboarding(next);
      setProgram(generateProgram(next));
    });
  }, []);

  const handleSaveEditedWorkout = (updatedWorkout: UserWorkout) => {
    const nextWorkouts = program.workouts.map((w) =>
      w.id === updatedWorkout.id ? (updatedWorkout as typeof w) : w
    );
    setProgram({
      ...program,
      workouts: nextWorkouts,
    });
  };

  const handleStartTraining = async () => {
    hapticSuccess();
    const updated = { ...onboarding, completed: true };
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.aiBadge}>
          <MaterialCommunityIcons
            name="creation"
            size={14}
            color={colors.primary}
          />
          <Text style={styles.aiBadgeText}>AI OPTIMIZED</Text>
        </View>
        <View style={styles.topBarPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Header Section */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR PLAN IS READY</Text>
          <Text style={styles.title}>{program.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="calendar-outline" size={14} color="#8E9BAE" />
              <Text style={styles.metaText}>
                {program.daysPerWeek} DAYS / WEEK
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color="#8E9BAE" />
              <Text style={styles.metaText}>
                ~{program.estimatedWorkoutMinutes} MIN
              </Text>
            </View>
            <View style={[styles.metaPill, styles.goalPill]}>
              <Text style={styles.goalText}>
                {GOAL_LABELS[onboarding.goal] ?? 'STRENGTH'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2.5 Split Switcher Carousel */}
        <View style={styles.splitSwitchWrap}>
          <Text style={styles.splitSwitchLabel}>CHOOSE SPLIT STYLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.splitSwitchRow}
          >
            {[
              { id: 'full_body', label: 'Full Body' },
              { id: 'upper_lower', label: 'Upper / Lower' },
              { id: 'push_pull_legs', label: 'Push / Pull / Legs' },
              { id: 'custom', label: 'Custom' },
            ].map((split) => {
              const isActive = (onboarding.splitPreference ?? program.splitType) === split.id;
              return (
                <Pressable
                  key={split.id}
                  accessibilityRole="button"
                  accessibilityLabel={split.label}
                  onPress={() => {
                    hapticMedium();
                    const updated = {
                      ...onboarding,
                      splitPreference: split.id as OnboardingData['splitPreference'],
                    };
                    setOnboarding(updated);
                    setProgram(generateProgram(updated));
                    saveOnboarding(updated);
                  }}
                  style={[
                    styles.splitPill,
                    isActive && styles.splitPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.splitPillText,
                      isActive && styles.splitPillTextActive,
                    ]}
                  >
                    {split.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Sequence Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>WORKOUT SEQUENCE</Text>
          <Text style={styles.sectionSub}>
            {program.workouts.length} SESSIONS
          </Text>
        </View>

        {/* 4. Workout Cards */}
        <View style={styles.workoutList}>
          {program.workouts.map((workout, index) => {
            const dayLabel = getWorkoutDayLabel(workout.dayLabel, index, onboarding.trainingDays, program.workouts.length);
            return (
              <View key={workout.id} style={styles.workoutCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{dayLabel}</Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <Text style={styles.exerciseCount}>
                      {workout.exercises.length} Exercises
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit workout"
                      onPress={() => setEditingWorkout(workout as unknown as UserWorkout)}
                      style={styles.editWorkoutBtn}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                      <Text style={styles.editWorkoutBtnText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.workoutName}>{workout.name}</Text>

                <View style={styles.muscleRow}>
                  {workout.muscleGroups.map((muscle) => (
                    <View key={muscle} style={styles.musclePill}>
                      <Text style={styles.musclePillText}>{muscle}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* 5. SPOT Smart Engine Banner */}
        <View style={styles.aiBanner}>
          <View style={styles.aiBannerIcon}>
            <Ionicons name="flash" size={20} color="#0B0D0F" />
          </View>
          <View style={styles.aiBannerTextWrap}>
            <Text style={styles.aiBannerTitle}>Dynamic Progressive Overload</Text>
            <Text style={styles.aiBannerDesc}>
              SPOT adjusts weights, sets, and rest intervals automatically based
              on your recovery and RPE feedback after every workout.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 6. Pinned CTA Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start training"
          onPress={handleStartTraining}
          style={({ pressed }) => [
            styles.startBtn,
            pressed && styles.startBtnPressed,
          ]}
        >
          <Text style={styles.startBtnText}>Start Training</Text>
          <Ionicons name="arrow-forward" size={20} color="#0B0D0F" />
        </Pressable>
      </View>

      {/* 7. Workout Editor Modal */}
      <WorkoutEditorModal
        visible={editingWorkout !== null}
        workout={editingWorkout}
        onSaveWorkout={handleSaveEditedWorkout}
        onClose={() => setEditingWorkout(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#161B22',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  topBarPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    marginTop: 20,
    marginBottom: 28,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#161B22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C38',
  },
  metaText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  goalPill: {
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
    borderColor: 'rgba(124, 92, 255, 0.3)',
  },
  goalText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  splitSwitchWrap: {
    marginBottom: 24,
  },
  splitSwitchLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  splitSwitchRow: {
    gap: 8,
  },
  splitPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242C38',
  },
  splitPillActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
  },
  splitPillText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  splitPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionSub: {
    color: '#4B5565',
    fontSize: 11,
    fontWeight: '700',
  },
  workoutList: {
    gap: 12,
    marginBottom: 20,
  },
  workoutCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2733',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#161B22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C38',
  },
  editWorkoutBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  dayBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  exerciseCount: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  musclePill: {
    backgroundColor: '#161B22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1D2430',
  },
  musclePillText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#151922',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242C38',
    padding: 16,
    marginTop: 6,
  },
  aiBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiBannerTextWrap: {
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  aiBannerDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: '#161B22',
  },
  startBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  startBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  startBtnText: {
    color: '#0B0D0F',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
