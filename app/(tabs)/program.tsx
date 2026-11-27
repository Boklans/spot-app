import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { AnatomyPreview } from '@/components/progress/AnatomyPreview';
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import { useWorkoutBarBottomInset } from '@/components/ui/Screen';
import { useUserProfileStore } from '@/store/userProfileStore';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { generateUUID } from '@/lib/programMigration';
import { getNextAvailableWeekday, getWorkoutDayLabel } from '@/lib/programGenerator';
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomBarInset = useWorkoutBarBottomInset(40);
  const { formatWithUnit } = useWeightUnit();
  const program = useProgramStore((state) => state.program);
  const progress = useProgramProgressStore((state) => state.progress);
  const profileSex = useUserProfileStore((state) => state.profile.sex);
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
      syncProgramAndOnboarding();
    }, [syncProgramAndOnboarding])
  );

  const applySplitSwitch = async (splitId: WorkoutSplitPreference) => {
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

  const handleSwitchSplit = (splitId: WorkoutSplitPreference) => {
    const activeSplit = onboarding?.splitPreference ?? program.splitType;
    if (activeSplit === splitId) return;
    Alert.alert(
      language === 'uk' ? 'Змінити програму?' : 'Switch program split?',
      program.splitType === 'custom' && splitId !== 'custom'
        ? language === 'uk'
          ? 'Поточну чергу тренувань буде скинуто до першого дня нового спліту. Ваша кастомна програма залишиться збереженою у вкладці Custom.'
          : 'Your current workout rotation will reset to Day 1 of the new split. Your custom routine remains saved under Custom.'
        : language === 'uk'
          ? 'Перемикання спліту замінить поточну активну програму та скине чергу тренувань до Дня 1.'
          : 'Switching splits will replace your current active program and reset your workout rotation to Day 1.',
      [
        { text: language === 'uk' ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: language === 'uk' ? 'Змінити' : 'Switch',
          style: 'destructive',
          onPress: () => {
            void applySplitSwitch(splitId);
          },
        },
      ]
    );
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

  const handleDeleteWorkout = (workoutId: string) => {
    if (program.workouts.length <= 1) {
      Alert.alert(
        language === 'uk' ? 'Неможливо видалити' : 'Cannot delete',
        language === 'uk'
          ? 'У вашій програмі має бути хоча б одне тренування.'
          : 'Your program must have at least one workout.'
      );
      return;
    }

    Alert.alert(
      language === 'uk' ? 'Видалити тренування?' : 'Delete workout day?',
      language === 'uk'
        ? 'Цей день тренування та всі його вправи будуть видалені з програми.'
        : 'This workout day and all its exercises will be removed from your program.',
      [
        { text: language === 'uk' ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: language === 'uk' ? 'Видалити' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            const updatedWorkouts = program.workouts.filter((w) => w.id !== workoutId);
            const updatedProg: UserProgram = {
              ...program,
              splitType: 'custom',
              daysPerWeek: Math.min(updatedWorkouts.length, program.daysPerWeek),
              workouts: updatedWorkouts,
            };
            await useProgramStore.getState().setCustomProgram(updatedProg);
            setEditingWorkout(null);
          },
        },
      ]
    );
  };

  const scheduledWorkout = getScheduledWorkout(program, progress);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('yourProgram')}</Text>
        <Text style={styles.subtitle}>
          {`${program.name}  ·  ${program.daysPerWeek} ${t('daysPerWeek')}  ·  ${program.workouts.length} ${t('sessions')}`}
        </Text>
      </View>

      {/* Routine Schedule */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.routineScroll, { paddingBottom: bottomBarInset }]}
      >
        {/* Clean Split Switcher */}
        <View style={styles.splitSwitcherWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.splitChipRow}
          >
            {[
              { id: 'full_body', label: language === 'uk' ? 'Фулбоді' : 'Full Body' },
              { id: 'upper_lower', label: language === 'uk' ? 'Верх / Низ' : 'Upper / Lower' },
              { id: 'push_pull_legs', label: language === 'uk' ? 'Спліт (PPL)' : 'Split (PPL)' },
              { id: 'custom', label: language === 'uk' ? 'Власний план' : 'Custom Plan' },
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.customProgramTitle}>
                    {language === 'uk' ? 'Власний план тренувань' : 'Custom Routine'}
                  </Text>
                  <Text style={styles.customProgramSubtitle}>
                    {language === 'uk'
                      ? 'Налаштуйте дні та порядок вправ під себе'
                      : 'Customize days and exercise order'}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open program editor"
                onPress={() => router.push('/program/edit')}
                style={styles.openBuilderBtn}
              >
                <Text style={styles.openBuilderBtnText}>
                  {language === 'uk' ? 'Конструктор' : 'Builder'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {program.workouts.map((workout, index) => {
          const isUpNext = workout.id === scheduledWorkout?.id;
          const musclesLine = workout.muscleGroups.map((m) => tm(m)).join(' · ');
          const workoutAnatomyMuscles = Array.from(
            new Set([
              ...(workout.muscleGroups ?? []),
              ...workout.exercises.map((e) => e.muscleGroup).filter(Boolean),
            ])
          );

          return (
            <View
              key={workout.id}
              style={[styles.workoutCard, isUpNext && styles.workoutCardUpNext]}
            >
              <View style={styles.workoutCardHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tw(workout.name)}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/preview',
                      params: { workoutId: workout.id },
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <View style={styles.workoutLabelRow}>
                    <Text style={styles.workoutNumber}>
                      {td(getWorkoutDayLabel(workout.dayLabel, index, onboarding?.trainingDays, program.workouts.length))}
                    </Text>
                    {isUpNext && (
                      <View style={styles.upNextBadge}>
                        <View style={styles.upNextDot} />
                        <Text style={styles.upNextBadgeText}>{t('upNext')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workoutName}>{tw(workout.name)}</Text>
                  {musclesLine ? (
                    <Text style={styles.workoutMusclesText}>
                      {musclesLine}
                    </Text>
                  ) : null}
                  <Text style={styles.workoutMusclesText}>
                    {workout.exercises.length} {t('exercises').toLowerCase()} · ~{workout.estimatedMinutes} {t('min')}
                  </Text>
                </Pressable>
                <View style={styles.cardActionsRight}>
                  {isUpNext && workoutAnatomyMuscles.length > 0 ? (
                    <View style={styles.miniAnatomyChip}>
                      <AnatomyPreview
                        muscles={workoutAnatomyMuscles}
                        sex={profileSex}
                        height={60}
                        showBack={false}
                      />
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Customize workout"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setEditingWorkout(workout);
                    }}
                    style={({ pressed }) => [styles.routineEditBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="options-outline" size={16} color={colors.secondary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open workout preview"
                    hitSlop={8}
                    onPress={() =>
                      router.push({
                        pathname: '/workout/preview',
                        params: { workoutId: workout.id },
                      })
                    }
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${tw(workout.name)}`}
                onPress={() =>
                  router.push({
                    pathname: '/workout/preview',
                    params: { workoutId: workout.id },
                  })
                }
                style={styles.exerciseList}
              >
                {workout.exercises.map((exercise, exIndex) => {
                  const isSupersetA1 = Boolean(
                    exercise.supersetWithNext && exIndex < workout.exercises.length - 1
                  );
                  const isSupersetA2 = Boolean(
                    exIndex > 0 && workout.exercises[exIndex - 1]?.supersetWithNext
                  );

                  return (
                    <View key={`${exercise.name}-${exIndex}`} style={styles.exerciseRow}>
                      <View style={styles.exerciseRowLeft}>
                        <View style={styles.exerciseThumbMini}>
                          <Image
                            source={getExerciseImage(exercise.name, (exercise as any).customImageUri)}
                            style={styles.exerciseThumb}
                            resizeMode="cover"
                          />
                        </View>
                        {(isSupersetA1 || isSupersetA2) && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 2,
                              backgroundColor: 'rgba(168, 85, 247, 0.16)',
                              borderWidth: 1,
                              borderColor: 'rgba(168, 85, 247, 0.35)',
                              borderRadius: 5,
                              paddingHorizontal: 5,
                              paddingVertical: 1.5,
                            }}
                          >
                            <Ionicons name="link" size={9} color="#A855F7" />
                            <Text style={{ color: '#A855F7', fontSize: 9.5, fontWeight: '800' }}>
                              {isSupersetA1 ? 'A1' : 'A2'}
                            </Text>
                          </View>
                        )}
                        <Text numberOfLines={1} style={styles.exerciseNameText}>
                          {te(exercise.name)}
                        </Text>
                      </View>
                      <Text style={styles.exerciseMetaText}>
                        {exercise.sets} × {exercise.targetRepRange}
                      </Text>
                    </View>
                  );
                })}
              </Pressable>
            </View>
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
              const nextWeekday = getNextAvailableWeekday(program.workouts, onboarding?.trainingDays);
              const newWorkout: UserWorkout = {
                id: generateUUID(),
                name: language === 'uk' ? `Тренування ${letter}` : `Workout ${letter}`,
                dayLabel: nextWeekday,
                muscleGroups: [],
                estimatedMinutes: onboarding?.sessionDurationMinutes ?? 45,
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
            <Ionicons name="add" size={18} color="#A0A8B4" />
            <Text style={styles.addCustomWorkoutBtnText}>
              {language === 'uk' ? 'Додати день тренування' : 'Add Workout Day'}
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
          onDeleteWorkout={handleDeleteWorkout}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.medium,
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  routineScroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  splitSwitcherWrap: {
    marginBottom: 2,
  },
  splitChipRow: {
    gap: 8,
  },
  splitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitChipActive: {
    backgroundColor: colors.activeChipBg,
    borderColor: colors.activeChipBg,
  },
  splitChipText: {
    fontFamily: fonts.semiBold,
    color: colors.secondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  splitChipTextActive: {
    fontFamily: fonts.bold,
    color: colors.activeChipText,
    fontWeight: '700',
  },
  customProgramHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 12,
    gap: 12,
    ...cardElevation(colors),
  },
  customProgramLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customProgramTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  customProgramSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '400',
    color: colors.secondary,
    marginTop: 2,
  },
  openBuilderBtn: {
    backgroundColor: colors.elevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  openBuilderBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    ...cardElevation(colors),
  },
  workoutCardUpNext: {
    borderColor: colors.isDark ? 'rgba(200, 255, 61, 0.25)' : 'rgba(21, 128, 61, 0.28)',
  },
  workoutCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniAnatomyChip: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radii.xs + 2,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routineEditBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.xs + 2,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutNumber: {
    fontFamily: fonts.bold,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  upNextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  upNextDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: colors.accentLine,
  },
  upNextBadgeText: {
    fontFamily: fonts.bold,
    color: colors.primaryText,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  workoutName: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 5,
    letterSpacing: -0.35,
  },
  workoutMusclesText: {
    fontFamily: fonts.medium,
    color: colors.secondary,
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  exerciseList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    borderRadius: radii.xs,
    backgroundColor: colors.elevated,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseNameText: {
    fontFamily: fonts.medium,
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  exerciseMetaText: {
    fontFamily: fonts.semiBold,
    color: colors.secondary,
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  addCustomWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: radii.md,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addCustomWorkoutBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
});
