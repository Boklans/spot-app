import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Platform,
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
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import {
  generateProgram,
  getWorkoutDayLabel,
  type GeneratedProgram,
} from '@/lib/programGenerator';
import { useProgramStore } from '@/store/programStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';
import type { UserProgram, UserWorkout } from '@/types/userProgram';

interface SplitChoice {
  id: WorkoutSplitPreference;
  labelUk: string;
  labelEn: string;
  subUk: string;
  subEn: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const SPLIT_CHOICES: SplitChoice[] = [
  {
    id: 'full_body',
    labelUk: 'Фулбоді',
    labelEn: 'Full Body',
    subUk: '1–3 дні · Все тіло',
    subEn: '1–3 days · Entire body',
    icon: 'human',
  },
  {
    id: 'upper_lower',
    labelUk: 'Верх / Низ',
    labelEn: 'Upper / Lower',
    subUk: '3–4 дні · Баланс сил',
    subEn: '3–4 days · Balanced',
    icon: 'weight-lifter',
  },
  {
    id: 'push_pull_legs',
    labelUk: 'Спліт (PPL)',
    labelEn: 'Split (PPL)',
    subUk: '3–6 днів · Жим / Тяга / Ноги',
    subEn: '3–6 days · Push / Pull / Legs',
    icon: 'arm-flex',
  },
  {
    id: 'custom',
    labelUk: 'Кастом (Свій)',
    labelEn: 'Custom Plan',
    subUk: 'Скласти свій план',
    subEn: 'Build from scratch',
    icon: 'tune',
  },
];

interface DurationChoiceOption {
  minutes: number;
  labelUk: string;
  labelEn: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const DURATION_CHOICES: DurationChoiceOption[] = [
  {
    minutes: 30,
    labelUk: '30 хв (4 впр)',
    labelEn: '30 min (4 ex)',
    icon: 'lightning-bolt',
  },
  {
    minutes: 45,
    labelUk: '45 хв (5 впр)',
    labelEn: '45 min (5 ex)',
    icon: 'timer-sand',
  },
  {
    minutes: 60,
    labelUk: '60 хв (6+ впр)',
    labelEn: '60 min (6+ ex)',
    icon: 'fire',
  },
];

export default function ProgramReady() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboarding);
  const [program, setProgram] = useState<GeneratedProgram>(() =>
    generateProgram(defaultOnboarding)
  );
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);
  // Track whether user manually edited the program so we persist edits instead of regenerating
  const [hasEdits, setHasEdits] = useState(false);

  const syncProgramState = React.useCallback(async () => {
    const data = (await loadOnboarding()) ?? defaultOnboarding;
    setOnboarding(data);

    const storeProg = await useProgramStore.getState().getOrLoadProgram();
    if (storeProg && storeProg.splitType === 'custom') {
      setProgram(storeProg as unknown as GeneratedProgram);
      setHasEdits(false);
    } else {
      setProgram(generateProgram(data));
      setHasEdits(false);
    }
  }, []);

  useEffect(() => {
    syncProgramState();
  }, [syncProgramState]);

  useFocusEffect(
    React.useCallback(() => {
      syncProgramState();
    }, [syncProgramState])
  );

  const handleSelectDuration = async (minutes: number) => {
    hapticMedium();
    const updated: OnboardingData = {
      ...onboarding,
      sessionDurationMinutes: minutes,
    };
    setOnboarding(updated);
    if (updated.splitPreference === 'custom' && hasEdits) {
      setProgram((prev) => ({
        ...prev,
        estimatedWorkoutMinutes: minutes,
        workouts: prev.workouts.map((w) => ({
          ...w,
          estimatedMinutes: minutes,
        })),
      }));
    } else {
      setProgram(generateProgram(updated));
    }
    await saveOnboarding(updated);
  };

  const handleSelectSplit = async (splitId: WorkoutSplitPreference) => {
    hapticMedium();
    const updated: OnboardingData = {
      ...onboarding,
      splitPreference: splitId,
    };
    setOnboarding(updated);
    if (splitId === 'custom') {
      const storeProg = useProgramStore.getState().program;
      if (storeProg && storeProg.splitType === 'custom') {
        setProgram(storeProg as unknown as GeneratedProgram);
        setHasEdits(true);
      } else {
        setProgram(generateProgram(updated));
      }
    } else {
      setProgram(generateProgram(updated));
      setHasEdits(false);
    }
    await saveOnboarding(updated);
  };

  const handleAddNewWorkoutDay = () => {
    hapticMedium();
    const count = program.workouts.length;
    const letter = String.fromCharCode(65 + count);
    const newWorkout: GeneratedProgram['workouts'][0] = {
      id: `custom-w-${Date.now()}`,
      name: language === 'uk' ? `Тренування ${letter}` : `Workout ${letter}`,
      dayLabel: `Day ${count + 1}`,
      muscleGroups: [],
      estimatedMinutes: 45,
      exercises: [],
    };

    const nextProgram: GeneratedProgram = {
      ...program,
      daysPerWeek: Math.min(7, program.workouts.length + 1),
      workouts: [...program.workouts, newWorkout],
    };

    setProgram(nextProgram);
    setHasEdits(true);
    setEditingWorkout(newWorkout as unknown as UserWorkout);
  };

  const handleSaveEditedWorkout = (updatedWorkout: UserWorkout) => {
    const nextWorkouts = program.workouts.map((w) =>
      w.id === updatedWorkout.id ? (updatedWorkout as typeof w) : w
    );
    setProgram({
      ...program,
      workouts: nextWorkouts,
    });
    setHasEdits(true);
  };

  const currentSplit = onboarding.splitPreference ?? program.splitType;
  const isCustom = currentSplit === 'custom';

  // Build a UserProgram from current local program state (for persisting manual edits)
  const buildUserProgramFromLocal = () => ({
    id: program.id,
    name: program.name,
    description: program.description ?? '',
    daysPerWeek: program.daysPerWeek,
    estimatedWorkoutMinutes: program.estimatedWorkoutMinutes,
    splitType: 'custom' as const,
    workouts: program.workouts.map((w) => ({
      id: w.id,
      name: w.name,
      dayLabel: w.dayLabel,
      muscleGroups: w.muscleGroups,
      estimatedMinutes: w.estimatedMinutes,
      defaultRestSeconds: w.defaultRestSeconds ?? 90,
      exercises: w.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets,
        recommendedWeight: ex.recommendedWeight,
        targetRepRange: ex.targetRepRange ?? '8-12',
        equipment: ex.equipment,
        weightIncrement: ex.weightIncrement ?? 2.5,
        restSeconds: ex.restSeconds,
      })),
    })),
  });

  const handleOpenFullBuilder = async () => {
    hapticMedium();
    const updated = { ...onboarding, completed: true, splitPreference: 'custom' as WorkoutSplitPreference };
    await saveOnboarding(updated);
    const storeProg = useProgramStore.getState().program;
    if (storeProg?.splitType === 'custom' && !hasEdits) {
      // Custom program already in store
    } else {
      await useProgramStore.getState().setCustomProgram(buildUserProgramFromLocal() as unknown as UserProgram);
    }
    setHasEdits(false);
    router.push('/program/edit');
  };

  const handleStartTraining = async () => {
    hapticSuccess();
    const updated = { ...onboarding, completed: true };
    await saveOnboarding(updated);
    const storeProgram = useProgramStore.getState().program;
    if (onboarding.splitPreference === 'custom' || storeProgram?.splitType === 'custom') {
      if (hasEdits) {
        await useProgramStore.getState().setCustomProgram(buildUserProgramFromLocal() as unknown as UserProgram);
      }
    } else {
      await useProgramStore.getState().refreshProgram(updated);
    }
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
          <Text style={styles.aiBadgeText}>
            {language === 'uk' ? 'СПОТ ПЛАН' : 'SPOT PLAN'}
          </Text>
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
          <Text style={styles.eyebrow}>
            {language === 'uk' ? 'ВАШ ПЛАН ГОТОВИЙ' : 'YOUR PLAN IS READY'}
          </Text>
          <Text style={styles.title}>{program.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="calendar-outline" size={14} color="#8E9BAE" />
              <Text style={styles.metaText}>
                {program.daysPerWeek}{' '}
                {language === 'uk' ? 'ДНІВ / ТИЖДЕНЬ' : 'DAYS / WEEK'}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color="#8E9BAE" />
              <Text style={styles.metaText}>
                ~{program.estimatedWorkoutMinutes} {language === 'uk' ? 'ХВ' : 'MIN'}
              </Text>
            </View>
            <View style={[styles.metaPill, styles.goalPill]}>
              <Text style={styles.goalText}>
                {language === 'uk' ? 'КАЛІБРОВАНО' : 'CALIBRATED'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2.5 Workout Duration Filter */}
        <View style={styles.durationFilterWrap}>
          <View style={styles.durationFilterHeader}>
            <Text style={styles.durationFilterLabel}>
              {language === 'uk' ? 'БАЖАНА ТРИВАЛІСТЬ' : 'TARGET DURATION'}
            </Text>
            <View style={styles.durationFilterActiveBadge}>
              <Text style={styles.durationFilterActiveBadgeText}>
                {language === 'uk'
                  ? `${onboarding.sessionDurationMinutes ?? 45} ХВ · ${(onboarding.sessionDurationMinutes ?? 45) <= 30 ? 4 : (onboarding.sessionDurationMinutes ?? 45) <= 45 ? 5 : 6} ВПРАВ`
                  : `${onboarding.sessionDurationMinutes ?? 45} MIN · ${(onboarding.sessionDurationMinutes ?? 45) <= 30 ? 4 : (onboarding.sessionDurationMinutes ?? 45) <= 45 ? 5 : 6} EX`}
              </Text>
            </View>
          </View>
          <View style={styles.durationFilterRow}>
            {DURATION_CHOICES.map((choice) => {
              const isSelected = (onboarding.sessionDurationMinutes ?? 45) === choice.minutes;
              return (
                <Pressable
                  key={choice.minutes}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.minutes} min`}
                  onPress={() => handleSelectDuration(choice.minutes)}
                  style={[
                    styles.durationFilterBtn,
                    isSelected && styles.durationFilterBtnActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={choice.icon}
                    size={16}
                    color={isSelected ? '#0B0D0F' : '#8E9BAE'}
                  />
                  <Text
                    style={[
                      styles.durationFilterBtnText,
                      isSelected && styles.durationFilterBtnTextActive,
                    ]}
                  >
                    {language === 'uk' ? choice.labelUk : choice.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Split Switcher Carousel (Фулбоді, Верх/Низ, Спліт, Кастом) */}
        <View style={styles.splitSwitchWrap}>
          <Text style={styles.splitSwitchLabel}>
            {language === 'uk' ? 'ОБЕРІТЬ ПРОГРАМУ ТРЕНУВАНЬ' : 'CHOOSE TRAINING PROGRAM'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.splitSwitchRow}
          >
            {SPLIT_CHOICES.map((split) => {
              const isActive = currentSplit === split.id;
              return (
                <Pressable
                  key={split.id}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'uk' ? split.labelUk : split.labelEn}
                  onPress={() => handleSelectSplit(split.id)}
                  style={[
                    styles.splitPill,
                    isActive && styles.splitPillActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={split.icon}
                    size={16}
                    color={isActive ? '#0B0D0F' : '#8E9BAE'}
                  />
                  <Text
                    style={[
                      styles.splitPillText,
                      isActive && styles.splitPillTextActive,
                    ]}
                  >
                    {language === 'uk' ? split.labelUk : split.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 3.5 Custom Plan Builder Banner (if Custom is chosen) */}
        {isCustom && (
          <View style={styles.customBanner}>
            <View style={styles.customBannerHeader}>
              <View style={styles.customBannerIconWrap}>
                <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customBannerTitle}>
                  {language === 'uk' ? 'Складіть свій план' : 'Build Your Custom Plan'}
                </Text>
                <Text style={styles.customBannerSub}>
                  {language === 'uk'
                    ? 'Додавайте свої дні та будь-які вправи з каталогу'
                    : 'Add your own days and any exercises from library'}
                </Text>
              </View>
            </View>
            <View style={styles.customBannerBtns}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add workout day"
                onPress={handleAddNewWorkoutDay}
                style={styles.addDayBtn}
              >
                <Ionicons name="add" size={16} color="#0B0D0F" />
                <Text style={styles.addDayBtnText}>
                  {language === 'uk' ? '+ Додати день' : '+ Add Day'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open plan builder"
                onPress={handleOpenFullBuilder}
                style={styles.builderBtn}
              >
                <Ionicons name="create-outline" size={15} color={colors.primary} />
                <Text style={styles.builderBtnText}>
                  {language === 'uk' ? 'Конструктор' : 'Full Editor'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 4. Sequence Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {language === 'uk' ? 'СТРУКТУРА ТРЕНУВАНЬ' : 'WORKOUT SEQUENCE'}
          </Text>
          <Text style={styles.sectionSub}>
            {program.workouts.length} {language === 'uk' ? 'ТРЕНУВАНЬ' : 'SESSIONS'}
          </Text>
        </View>

        {/* 5. Workout Cards */}
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
                      ~{workout.estimatedMinutes ?? program.estimatedWorkoutMinutes} {language === 'uk' ? 'хв' : 'min'} · {workout.exercises.length} {language === 'uk' ? 'вправ' : 'exercises'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Редагувати тренування"
                      onPress={() => setEditingWorkout(workout as unknown as UserWorkout)}
                      style={styles.editWorkoutBtn}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                      <Text style={styles.editWorkoutBtnText}>
                        {language === 'uk' ? 'Редагувати' : 'Edit'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.workoutName}>{tw(workout.name)}</Text>

                <View style={styles.muscleRow}>
                  {workout.muscleGroups.map((muscle) => (
                    <View key={muscle} style={styles.musclePill}>
                      <Text style={styles.musclePillText}>{tm(muscle)}</Text>
                    </View>
                  ))}
                </View>

                {workout.exercises.length === 0 ? (
                  <Pressable
                    onPress={() => setEditingWorkout(workout as unknown as UserWorkout)}
                    style={styles.emptyExercisesPrompt}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyExercisesText}>
                      {language === 'uk'
                        ? 'Порожнє тренування. Натисніть, щоб додати вправи'
                        : 'Empty workout. Tap to add exercises'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.exPreviewList}>
                    {workout.exercises.slice(0, 3).map((ex, exIdx) => (
                      <View key={ex.id || `${ex.name}-${exIdx}`} style={styles.exPreviewRow}>
                        <View style={styles.exPreviewDot} />
                        <Text style={styles.exPreviewName} numberOfLines={1}>
                          {te(ex.name)}
                        </Text>
                        <Text style={styles.exPreviewSets}>
                          {ex.sets} × {ex.recommendedWeight ? formatWithUnit(ex.recommendedWeight) : (language === 'uk' ? 'ВТ' : 'BW')}
                        </Text>
                      </View>
                    ))}
                    {workout.exercises.length > 3 && (
                      <Text style={styles.exPreviewMore}>
                        + ще {workout.exercises.length - 3}{' '}
                        {language === 'uk' ? 'вправи' : 'exercises'}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 6. Bottom CTA Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === 'uk' ? 'Застосувати план' : 'Apply Plan'}
          onPress={handleStartTraining}
          style={({ pressed }) => [
            styles.startBtn,
            pressed && styles.startBtnPressed,
          ]}
        >
          <Text style={styles.startBtnText}>
            {language === 'uk' ? 'Застосувати план' : 'Apply Plan'}
          </Text>
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
    height: 44,
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
    paddingTop: 6,
    paddingBottom: 24,
  },
  header: {
    marginTop: 8,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    letterSpacing: 0.5,
  },
  goalPill: {
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  goalText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  durationFilterWrap: {
    marginBottom: 16,
  },
  durationFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  durationFilterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.2,
  },
  durationFilterActiveBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  durationFilterActiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  durationFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationFilterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  durationFilterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E9BAE',
  },
  durationFilterBtnTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  splitSwitchWrap: {
    marginBottom: 16,
  },
  splitSwitchLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  splitSwitchRow: {
    gap: 8,
    paddingVertical: 2,
  },
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  splitPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  splitPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E9BAE',
  },
  splitPillTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  customBanner: {
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    gap: 12,
  },
  customBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customBannerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  customBannerBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addDayBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0B0D0F',
  },
  builderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161B22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  builderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.2,
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5565',
  },
  workoutList: {
    gap: 12,
    marginBottom: 20,
  },
  workoutCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1D2430',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: '#161B22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C38',
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E9BAE',
  },
  editWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  editWorkoutBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  musclePill: {
    backgroundColor: '#161B22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  musclePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E9BAE',
  },
  emptyExercisesPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.2)',
  },
  emptyExercisesText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  exPreviewList: {
    backgroundColor: '#0E1115',
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  exPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exPreviewDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  exPreviewName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#C8D2DE',
  },
  exPreviewSets: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
  },
  exPreviewMore: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
    paddingLeft: 10,
  },
  bottomBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 26,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  startBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  startBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
