import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import {
  generateProgram,
  getNextAvailableWeekday,
  getWorkoutDayLabel,
  type GeneratedProgram,
} from '@/lib/programGenerator';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
  type OnboardingSex,
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

const PRESET_SPLITS: SplitChoice[] = [
  {
    id: 'full_body',
    labelUk: 'Фулбоді',
    labelEn: 'Full Body',
    subUk: 'Все тіло',
    subEn: 'Full Body',
    icon: 'human',
  },
  {
    id: 'upper_lower',
    labelUk: 'Верх / Низ',
    labelEn: 'Upper / Lower',
    subUk: 'Баланс сил',
    subEn: 'Balanced',
    icon: 'weight-lifter',
  },
  {
    id: 'push_pull_legs',
    labelUk: 'Спліт (PPL)',
    labelEn: 'Split (PPL)',
    subUk: 'Жим / Тяга / Ноги',
    subEn: 'Push / Pull / Legs',
    icon: 'arm-flex',
  },
];

export default function ProgramReady() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tm, td, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboarding);
  const [program, setProgram] = useState<GeneratedProgram>(() =>
    generateProgram(defaultOnboarding)
  );
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  const [hasEdits, setHasEdits] = useState(false);

  const toggleWorkout = (id: string) => {
    hapticLight();
    setExpandedWorkouts((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? false),
    }));
  };

  const syncProgramState = React.useCallback(async () => {
    const data = (await loadOnboarding()) ?? defaultOnboarding;
    const profile = useUserProfileStore.getState().profile;
    const resolvedSex: OnboardingSex = (data.sex && data.sex !== 'unspecified')
      ? data.sex
      : (profile.sex && profile.sex !== 'unspecified')
      ? profile.sex
      : 'unspecified';

    const mergedData: OnboardingData = {
      ...data,
      name: (profile.name && profile.name !== 'IHOR') ? profile.name : data.name,
      age: (profile.age && profile.age > 0) ? profile.age : data.age,
      sex: resolvedSex,
      weightKg: (profile.weightKg && profile.weightKg > 0) ? profile.weightKg : data.weightKg,
      heightCm: (profile.heightCm && profile.heightCm > 0) ? profile.heightCm : data.heightCm,
      baselineLifts: profile.baselineLifts || data.baselineLifts,
    };
    setOnboarding(mergedData);

    const storeProg = await useProgramStore.getState().getOrLoadProgram();
    if (mergedData.splitPreference === 'custom' && storeProg && storeProg.splitType === 'custom') {
      setProgram(storeProg as unknown as GeneratedProgram);
      setHasEdits(false);
    } else {
      setProgram(generateProgram(mergedData));
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
    const nextWeekday = getNextAvailableWeekday(program.workouts, onboarding.trainingDays);
    const newWorkout: GeneratedProgram['workouts'][0] = {
      id: `custom-w-${Date.now()}`,
      name: language === 'uk' ? `Тренування ${letter}` : `Workout ${letter}`,
      dayLabel: nextWeekday,
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

  const handleDeleteEditedWorkout = (workoutId: string) => {
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
          onPress: () => {
            hapticMedium();
            const nextWorkouts = program.workouts.filter((w) => w.id !== workoutId);
            setProgram({
              ...program,
              splitType: 'custom',
              daysPerWeek: Math.min(nextWorkouts.length, program.daysPerWeek),
              workouts: nextWorkouts,
            });
            setOnboarding((prev) => ({ ...prev, splitPreference: 'custom' }));
            setHasEdits(true);
            setEditingWorkout(null);
          },
        },
      ]
    );
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
        supersetWithNext: ex.supersetWithNext,
      })),
    })),
  });

  const handleOpenFullBuilder = async () => {
    hapticMedium();
    const updated = { ...onboarding, completed: true, splitPreference: 'custom' as WorkoutSplitPreference };
    setOnboarding(updated);
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
    const isCustom = onboarding.splitPreference === 'custom';
    const profile = useUserProfileStore.getState().profile;
    const finalWeightKg = (profile.weightKg && profile.weightKg > 0) ? profile.weightKg : (onboarding.weightKg ?? 78);
    const finalBaselineLifts = profile.baselineLifts || onboarding.baselineLifts;
    const finalName = (profile.name && profile.name !== 'IHOR') ? profile.name : onboarding.name;
    const finalAge = (profile.age && profile.age > 0) ? profile.age : onboarding.age;
    const finalSex: OnboardingSex = (onboarding.sex && onboarding.sex !== 'unspecified')
      ? onboarding.sex
      : (profile.sex && profile.sex !== 'unspecified')
      ? profile.sex
      : 'unspecified';

    const updated = {
      ...onboarding,
      name: finalName,
      age: finalAge,
      sex: finalSex,
      weightKg: finalWeightKg,
      baselineLifts: finalBaselineLifts,
      completed: true,
      splitPreference: isCustom ? ('custom' as WorkoutSplitPreference) : onboarding.splitPreference,
    };
    setOnboarding(updated);
    await saveOnboarding(updated);

    await useUserProfileStore.getState().updateProfile({
      name: finalName,
      age: finalAge,
      sex: finalSex,
      weightKg: finalWeightKg,
      baselineLifts: finalBaselineLifts,
    });
    await useBodyWeightStore.getState().syncBaselineWeight(finalWeightKg);

    const userProgram = buildUserProgramFromLocal() as unknown as UserProgram;
    await useProgramStore.getState().setCustomProgram(userProgram);
    await useProgramProgressStore
      .getState()
      .resetProgress(userProgram.id, userProgram.workouts[0]?.id);
    
    await useUserProfileStore.getState().loadProfile();
    router.replace('/(tabs)');
  };

  const focusTag = (() => {
    const f = onboarding.priorityMuscles?.[0];
    if (f === 'lower_glutes') return language === 'uk' ? 'АКЦЕНТ: НОГИ ТА СІДНИЦІ' : 'FOCUS: LEGS & GLUTES';
    if (f === 'upper_push') return language === 'uk' ? 'АКЦЕНТ: ВЕРХ ТІЛА' : 'FOCUS: UPPER BODY';
    if (f === 'back_core') return language === 'uk' ? 'АКЦЕНТ: СПИНА ТА КОР' : 'FOCUS: BACK & CORE';
    return language === 'uk' ? 'ЗБАЛАНСОВАНО' : 'BALANCED';
  })();

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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>
            {language === 'uk' ? 'ПРОГРАМА ТРЕНУВАНЬ' : 'TRAINING PROGRAM'}
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
              <Ionicons name="calendar-outline" size={14} color={colors.secondary} />
              <Text style={styles.metaText}>
                {program.daysPerWeek}{' '}
                {language === 'uk' ? 'ДНІВ / ТИЖДЕНЬ' : 'DAYS / WEEK'}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color={colors.secondary} />
              <Text style={styles.metaText}>
                ~{program.estimatedWorkoutMinutes} {language === 'uk' ? 'ХВ' : 'MIN'}
              </Text>
            </View>
            <View style={[styles.metaPill, styles.goalPill]}>
              <Text style={styles.goalText}>{focusTag}</Text>
            </View>
          </View>
        </View>

        {/* 3. Split Switcher */}
        <View style={styles.splitSwitchWrap}>
          <Text style={styles.splitSwitchLabel}>
            {language === 'uk' ? 'ОБЕРІТЬ ПРОГРАМУ ТРЕНУВАНЬ' : 'CHOOSE TRAINING PROGRAM'}
          </Text>
          <View style={styles.splitPresetRow}>
            {PRESET_SPLITS.map((split) => {
              const isActive = currentSplit === split.id;
              return (
                <Pressable
                  key={split.id}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'uk' ? split.labelUk : split.labelEn}
                  onPress={() => handleSelectSplit(split.id)}
                  style={[
                    styles.splitPresetCard,
                    isActive && styles.splitPresetCardActive,
                  ]}
                >
                  <View style={[styles.splitPresetIconWrap, isActive && styles.splitPresetIconWrapActive]}>
                    <MaterialCommunityIcons
                      name={split.icon}
                      size={20}
                      color={isActive ? colors.activeChipText : colors.primaryText}
                    />
                  </View>
                  <Text
                    style={[styles.splitPresetTitle, isActive && styles.splitPresetTitleActive]}
                    numberOfLines={1}
                  >
                    {language === 'uk' ? split.labelUk : split.labelEn}
                  </Text>
                  <Text
                    style={[styles.splitPresetSub, isActive && styles.splitPresetSubActive]}
                    numberOfLines={1}
                  >
                    {language === 'uk' ? split.subUk : split.subEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Dedicated Custom Plan Card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={language === 'uk' ? 'Скласти свій план (Кастом)' : 'Build Custom Routine'}
            onPress={() => handleSelectSplit('custom')}
            style={[styles.customSelectCard, isCustom && styles.customSelectCardActive]}
          >
            <View style={styles.customSelectLeft}>
              <View style={[styles.customSelectIconWrap, isCustom && styles.customSelectIconWrapActive]}>
                <MaterialCommunityIcons
                  name="tune-vertical"
                  size={20}
                  color={isCustom ? colors.onPrimary : colors.primaryText}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.customTitleRow}>
                  <Text style={[styles.customSelectTitle, isCustom && styles.customSelectTitleActive]}>
                    {language === 'uk' ? 'Власний план (Кастом)' : 'Custom Routine (Your Own)'}
                  </Text>
                  <View style={[styles.customBadge, isCustom && styles.customBadgeActive]}>
                    <Text style={[styles.customBadgeText, isCustom && styles.customBadgeTextActive]}>
                      {language === 'uk' ? 'СВІЙ' : 'CUSTOM'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.customSelectSub}>
                  {language === 'uk'
                    ? 'Створіть свій розклад або оберіть будь-які вправи з каталогу'
                    : 'Build your own routine and choose exercises from catalog'}
                </Text>
              </View>
            </View>
            <Ionicons
              name={isCustom ? 'checkmark-circle' : 'chevron-forward'}
              size={22}
              color={isCustom ? colors.primaryText : colors.secondary}
            />
          </Pressable>
        </View>

        {/* 3.5 Custom Plan Builder Banner */}
        {isCustom && (
          <View style={styles.customBanner}>
            <View style={styles.customBannerHeader}>
              <View style={styles.customBannerIconWrap}>
                <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.primaryText} />
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
                <Ionicons name="add" size={16} color={colors.onPrimary} />
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
                <Ionicons name="create-outline" size={15} color={colors.primaryText} />
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
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              const allExpanded = program.workouts.every((w, idx) => expandedWorkouts[w.id] ?? (idx === 0));
              const nextState: Record<string, boolean> = {};
              program.workouts.forEach((w) => {
                nextState[w.id] = !allExpanded;
              });
              setExpandedWorkouts(nextState);
            }}
            hitSlop={8}
          >
            <Text style={styles.toggleAllText}>
              {program.workouts.every((w, idx) => expandedWorkouts[w.id] ?? (idx === 0))
                ? (language === 'uk' ? 'Згорнути всі' : 'Collapse all')
                : (language === 'uk' ? 'Розгорнути всі' : 'Expand all')}
            </Text>
          </Pressable>
        </View>

        {/* 5. Expandable Workout Cards */}
        <View style={styles.workoutList}>
          {program.workouts.map((workout, index) => {
            const rawDayLabel = getWorkoutDayLabel(workout.dayLabel, index, onboarding.trainingDays, program.workouts.length);
            const isExpanded = expandedWorkouts[workout.id] ?? (index === 0);

            return (
              <Pressable
                key={workout.id}
                accessibilityRole="button"
                accessibilityLabel={`${rawDayLabel}: ${workout.name}`}
                onPress={() => toggleWorkout(workout.id)}
                style={[styles.workoutCard, isExpanded && styles.workoutCardExpanded]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{td(rawDayLabel)}</Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <Text style={styles.exerciseCount}>
                      ~{workout.estimatedMinutes ?? program.estimatedWorkoutMinutes} {language === 'uk' ? 'хв' : 'min'} · {workout.exercises.length} {language === 'uk' ? 'вправ' : 'exercises'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Редагувати тренування"
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        setEditingWorkout(workout as unknown as UserWorkout);
                      }}
                      style={styles.editWorkoutBtn}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.primaryText} />
                      <Text style={styles.editWorkoutBtnText}>
                        {language === 'uk' ? 'Редагувати' : 'Edit'}
                      </Text>
                    </Pressable>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.secondary}
                      style={{ marginLeft: 2 }}
                    />
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
                    onPress={(e) => {
                      e.stopPropagation();
                      hapticLight();
                      setEditingWorkout(workout as unknown as UserWorkout);
                    }}
                    style={styles.emptyExercisesPrompt}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primaryText} />
                    <Text style={styles.emptyExercisesText}>
                      {language === 'uk'
                        ? 'Порожнє тренування. Натисніть, щоб додати вправи'
                        : 'Empty workout. Tap to add exercises'}
                    </Text>
                  </Pressable>
                ) : !isExpanded ? (
                  <View style={styles.collapsedPreviewRow}>
                    <Text style={styles.collapsedPreviewText} numberOfLines={2}>
                      {language === 'uk'
                        ? `Вправи: ${workout.exercises.slice(0, 3).map((e) => te(e.name)).join(', ')}${workout.exercises.length > 3 ? '...' : ''}`
                        : `Exercises: ${workout.exercises.slice(0, 3).map((e) => te(e.name)).join(', ')}${workout.exercises.length > 3 ? '...' : ''}`}
                    </Text>
                    <View style={styles.viewMoreRow}>
                      <Text style={styles.viewMoreText}>
                        {language === 'uk' ? `Показати всі вправи (${workout.exercises.length})` : `View all exercises (${workout.exercises.length})`}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.primaryText} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.fullExerciseList}>
                    {workout.exercises.map((ex, exIdx) => {
                      const weightStr = ex.recommendedWeight
                        ? formatWithUnit(ex.recommendedWeight)
                        : (language === 'uk' ? 'Власна вага' : 'Bodyweight');
                      return (
                        <View key={ex.id || `${ex.name}-${exIdx}`} style={styles.exerciseDetailCard}>
                          <View style={styles.exerciseDetailThumbWrap}>
                            <Image
                              source={getExerciseImage(ex.name)}
                              style={styles.exerciseDetailThumb}
                              resizeMode="cover"
                            />
                            <View style={styles.exerciseOrderBadge}>
                              <Text style={styles.exerciseOrderText}>{exIdx + 1}</Text>
                            </View>
                          </View>

                          <View style={styles.exerciseDetailInfo}>
                            <Text style={styles.exerciseDetailName} numberOfLines={2}>
                              {te(ex.name)}
                            </Text>

                            <View style={styles.exerciseDetailMetaRow}>
                              <View style={styles.exerciseDetailTargetBadge}>
                                <Text style={styles.exerciseDetailTargetText}>
                                  {ex.sets} {language === 'uk' ? 'підходи' : 'sets'} · {ex.targetRepRange || '8–12'} {language === 'uk' ? 'повт' : 'reps'}
                                </Text>
                              </View>
                              <Text style={styles.exerciseDetailWeightText}>
                                {weightStr}
                              </Text>
                            </View>

                            <View style={styles.exerciseDetailSubRow}>
                              <Text style={styles.exerciseDetailMuscle}>
                                {tm(ex.muscleGroup)}
                              </Text>
                              <Text style={styles.exerciseDetailRest}>
                                · ~{ex.restSeconds ?? 90}{language === 'uk' ? 'с відпочинок' : 's rest'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    <Pressable
                      accessibilityRole="button"
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleWorkout(workout.id);
                      }}
                      style={styles.collapseCardBtn}
                    >
                      <Text style={styles.collapseCardBtnText}>
                        {language === 'uk' ? 'Згорнути день' : 'Collapse day'}
                      </Text>
                      <Ionicons name="chevron-up" size={14} color={colors.secondary} />
                    </Pressable>
                  </View>
                )}
              </Pressable>
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
          <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      {/* 7. Workout Editor Modal */}
      <WorkoutEditorModal
        visible={editingWorkout !== null}
        workout={editingWorkout}
        onSaveWorkout={handleSaveEditedWorkout}
        onDeleteWorkout={handleDeleteEditedWorkout}
        onClose={() => setEditingWorkout(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: colors.surface,
      borderWidth: colors.isDark ? 0 : 1,
      borderColor: colors.border,
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    aiBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
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
      color: colors.primaryText,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.secondary,
      letterSpacing: 0.5,
    },
    goalPill: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.accentLine,
    },
    goalText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
      letterSpacing: 0.5,
    },
    splitSwitchWrap: {
      marginBottom: 20,
    },
    splitSwitchLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.secondary,
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    splitPresetRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    splitPresetCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    splitPresetCardActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    splitPresetIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    splitPresetIconWrapActive: {
      backgroundColor: 'transparent',
    },
    splitPresetTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 2,
    },
    splitPresetTitleActive: {
      color: colors.activeChipText,
      fontWeight: '900',
    },
    splitPresetSub: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.secondary,
      textAlign: 'center',
    },
    splitPresetSubActive: {
      color: colors.activeChipText,
      opacity: 0.85,
      fontWeight: '700',
    },
    customSelectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    customSelectCardActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    customSelectLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      marginRight: 8,
    },
    customSelectIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customSelectIconWrapActive: {
      backgroundColor: colors.primary,
    },
    customTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    customSelectTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    customSelectTitleActive: {
      color: colors.primaryText,
    },
    customBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    customBadgeActive: {
      backgroundColor: colors.primary,
    },
    customBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.primaryText,
      letterSpacing: 0.5,
    },
    customBadgeTextActive: {
      color: colors.onPrimary,
    },
    customSelectSub: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.secondary,
    },
    customBanner: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1.5,
      borderColor: colors.accentLine,
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
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customBannerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    customBannerSub: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.secondary,
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
      color: colors.onPrimary,
    },
    builderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    builderBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primaryText,
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
      color: colors.secondary,
      letterSpacing: 1.2,
    },
    sectionSub: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    toggleAllText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primaryText,
    },
    workoutList: {
      gap: 12,
      marginBottom: 20,
    },
    workoutCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    workoutCardExpanded: {
      borderColor: colors.accentLine,
      backgroundColor: colors.surface,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    dayBadge: {
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
      letterSpacing: 0.5,
    },
    cardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exerciseCount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondary,
    },
    editWorkoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    editWorkoutBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    muscleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    musclePill: {
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    musclePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.secondary,
    },
    emptyExercisesPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 8,
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    emptyExercisesText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryText,
    },
    collapsedPreviewRow: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    collapsedPreviewText: {
      fontSize: 12,
      color: colors.secondary,
      lineHeight: 18,
      marginBottom: 6,
    },
    viewMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewMoreText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primaryText,
    },
    fullExerciseList: {
      marginTop: 8,
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    exerciseDetailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      gap: 10,
    },
    exerciseDetailThumbWrap: {
      position: 'relative',
      width: 48,
      height: 48,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    exerciseDetailThumb: {
      width: '100%',
      height: '100%',
    },
    exerciseOrderBadge: {
      position: 'absolute',
      top: 2,
      left: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    exerciseOrderText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },
    exerciseDetailInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    exerciseDetailName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 3,
    },
    exerciseDetailMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    exerciseDetailTargetBadge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    exerciseDetailTargetText: {
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '800',
    },
    exerciseDetailWeightText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    exerciseDetailSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    exerciseDetailMuscle: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '600',
    },
    exerciseDetailRest: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '500',
    },
    collapseCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      marginTop: 4,
    },
    collapseCardBtnText: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    bottomBar: {
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 20 : 24,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      height: 52,
      borderRadius: 26,
      shadowColor: colors.isDark ? colors.primary : '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.35 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    startBtnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    startBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
  });
