import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { generateUUID } from '@/lib/programMigration';
import { getWorkoutDayLabel } from '@/lib/programGenerator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';
import type { UserProgram, UserWorkout } from '@/types/userProgram';

export default function Program() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const program = useProgramStore((state) => state.program);
  const progress = useProgramProgressStore((state) => state.progress);
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);

  const syncProgramAndOnboarding = useCallback(() => {
    useProgramStore.getState().getOrLoadProgram();
    loadOnboarding().then((data) => setOnboarding(data));
  }, []);

  useEffect(() => {
    syncProgramAndOnboarding();
  }, [syncProgramAndOnboarding]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        syncProgramAndOnboarding();
      });
      return () => task.cancel();
    }, [syncProgramAndOnboarding])
  );

  const handleSwitchSplit = async (splitId: WorkoutSplitPreference) => {
    hapticMedium();
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, splitPreference: splitId };
    setOnboarding(updated);
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
  };

  const handleSaveWorkout = async (updatedWorkout: UserWorkout) => {
    const nextWorkouts = program.workouts.map((w) =>
      w.id === updatedWorkout.id ? updatedWorkout : w
    );
    const updatedProgram: UserProgram = {
      ...program,
      splitType: 'custom',
      workouts: nextWorkouts,
    };
    await useProgramStore.getState().setCustomProgram(updatedProgram);
  };

  const scheduledWorkout = getScheduledWorkout(program, progress);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('yourProgram')}</Text>
        <Text style={styles.subtitle}>
          {`${program.name} • ${program.daysPerWeek} ${t('daysPerWeek')}`}
        </Text>
      </View>

      {/* Routine Schedule */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.routineScroll}
      >
            {/* Split Switcher in Routine */}
            <View style={styles.routineHeaderCard}>
              <View style={styles.routineTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routineProgramName}>{program.name}</Text>
                  <Text style={styles.routineDaysLabel}>
                    {program.daysPerWeek} {t('daysPerWeek').toUpperCase()} • {program.workouts.length} {t('sessions')}
                  </Text>
                </View>
                <View style={styles.splitBadge}>
                  <Text style={styles.splitBadgeText}>
                    {program.splitType === 'full_body'
                      ? 'FULL BODY'
                      : program.splitType === 'push_pull_legs'
                      ? 'PPL'
                      : program.splitType === 'custom'
                      ? 'CUSTOM'
                      : 'UPPER / LOWER'}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.splitChipRow}
              >
                {[
                  { id: 'full_body', label: language === 'uk' ? 'Фулбоді' : 'Full Body' },
                  { id: 'upper_lower', label: language === 'uk' ? 'Верх / Низ' : 'Upper / Lower' },
                  { id: 'push_pull_legs', label: language === 'uk' ? 'Спліт (PPL)' : 'Split (PPL)' },
                  { id: 'custom', label: language === 'uk' ? 'Кастом (Свій)' : 'Custom Plan' },
                ].map((item) => {
                  const isActive = program.splitType === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      onPress={() => handleSwitchSplit(item.id as WorkoutSplitPreference)}
                      style={[
                        styles.splitChip,
                        isActive && styles.splitChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.splitChipText,
                          isActive && styles.splitChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {program.splitType === 'custom' && (
                <View style={styles.customProgramHeaderBanner}>
                  <View style={styles.customProgramLeft}>
                    <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customProgramTitle}>
                        {language === 'uk' ? 'Власний план тренувань' : 'Custom Routine'}
                      </Text>
                      <Text style={styles.customProgramSubtitle}>
                        {language === 'uk'
                          ? 'Складайте програму під себе, додавайте та змінюйте дні'
                          : 'Build your routine, add days and customize exercises'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open program editor"
                    onPress={() => router.push('/program/edit')}
                    style={styles.openBuilderBtn}
                  >
                    <Ionicons name="create-outline" size={14} color="#0B0D0F" />
                    <Text style={styles.openBuilderBtnText}>
                      {language === 'uk' ? 'Конструктор' : 'Builder'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {program.workouts.map((workout, index) => {
              const isUpNext = workout.id === scheduledWorkout?.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={workout.id}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/preview',
                      params: { workoutId: workout.id },
                    })
                  }
                  style={[styles.workoutCard, isUpNext && styles.workoutCardActive]}
                >
                  <View style={styles.workoutCardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.workoutLabelRow}>
                        <Text style={styles.workoutNumber}>
                          {td(getWorkoutDayLabel(workout.dayLabel, index, onboarding?.trainingDays, program.workouts.length))}
                        </Text>
                        {isUpNext && (
                          <View style={styles.upNextBadge}>
                            <Text style={styles.upNextBadgeText}>{t('upNext')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.workoutName}>{tw(workout.name)}</Text>
                    </View>
                    <View style={styles.cardActionsRight}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Customize workout"
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          hapticLight();
                          setEditingWorkout(workout);
                        }}
                        style={styles.routineEditBtn}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.primary} />
                        <Text style={styles.routineEditBtnText}>{t('edit')}</Text>
                      </Pressable>
                      <Ionicons name="chevron-forward" size={20} color="#8E9BAE" />
                    </View>
                  </View>

                  <View style={styles.muscleTagsRow}>
                    {workout.muscleGroups.map((muscle) => (
                      <View key={muscle} style={styles.muscleTag}>
                        <Text style={styles.muscleTagText}>{tm(muscle)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.exerciseList}>
                    {workout.exercises.map((exercise, exIndex) => (
                      <View key={`${exercise.name}-${exIndex}`} style={styles.exerciseRow}>
                        <View style={styles.exerciseRowLeft}>
                          <View style={styles.exerciseThumbMini}>
                            <Image
                              source={getExerciseImage(exercise.name)}
                              style={styles.exerciseThumb}
                              resizeMode="cover"
                            />
                          </View>
                          <Text style={styles.exerciseNameText}>{te(exercise.name)}</Text>
                        </View>
                        <Text style={styles.exerciseMetaText}>
                          {exercise.sets} {t('sets').toLowerCase()} • {exercise.targetRepRange}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}

            {program.splitType === 'custom' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add workout day"
                onPress={() => {
                  hapticMedium();
                  const count = program.workouts.length;
                  const letter = String.fromCharCode(65 + count);
                  const newWorkout: UserWorkout = {
                    id: generateUUID(),
                    name: language === 'uk' ? `Тренування ${letter}` : `Workout ${letter}`,
                    dayLabel: `Day ${count + 1}`,
                    muscleGroups: [],
                    estimatedMinutes: 45,
                    defaultRestSeconds: 90,
                    exercises: [],
                  };
                  const updatedProg = {
                    ...program,
                    daysPerWeek: Math.min(7, program.workouts.length + 1),
                    workouts: [...program.workouts, newWorkout],
                  };
                  useProgramStore.getState().updateUserProgram(updatedProg);
                  setEditingWorkout(newWorkout);
                }}
                style={styles.addCustomWorkoutBtn}
              >
                <Ionicons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.addCustomWorkoutBtnText}>
                  {language === 'uk' ? '+ Додати тренування' : '+ Add Workout Day'}
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {editingWorkout && (
        <WorkoutEditorModal
          key={editingWorkout.id}
          visible={editingWorkout !== null}
          workout={editingWorkout}
          onSaveWorkout={handleSaveWorkout}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
  },
  routineScroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 14,
  },
  workoutCard: {
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  workoutCardActive: {
    borderColor: colors.primary,
  },
  workoutCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161B22',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C38',
  },
  routineEditBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  workoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutNumber: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  upNextBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upNextBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  muscleTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  muscleTag: {
    backgroundColor: '#1A212B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  muscleTagText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  exerciseRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  exerciseThumbMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  exerciseMetaText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  routineHeaderCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2733',
    padding: 16,
    marginBottom: 16,
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  routineProgramName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  routineDaysLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  splitBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  splitBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  splitChipRow: {
    gap: 8,
  },
  splitChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242C38',
  },
  splitChipActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
  },
  splitChipText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  splitChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  customProgramHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    gap: 10,
  },
  customProgramLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  customProgramTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customProgramSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 1,
  },
  openBuilderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openBuilderBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0B0D0F',
  },
  addCustomWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#151A22',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 20,
  },
  addCustomWorkoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
});
