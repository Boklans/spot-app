import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
  const { t, tm, td, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboarding);
  const [program, setProgram] = useState<GeneratedProgram>(() =>
    generateProgram(defaultOnboarding)
  );
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  // Track whether user manually edited the program so we persist edits instead of regenerating
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
    const mergedData: OnboardingData = {
      ...data,
      name: (profile.name && profile.name !== 'IHOR') ? profile.name : data.name,
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

    const updated = {
      ...onboarding,
      name: finalName,
      weightKg: finalWeightKg,
      baselineLifts: finalBaselineLifts,
      completed: true,
      splitPreference: isCustom ? ('custom' as WorkoutSplitPreference) : onboarding.splitPreference,
    };
    setOnboarding(updated);
    await saveOnboarding(updated);

    // Commit strictly to userProfileStore and bodyWeightStore
    await useUserProfileStore.getState().updateProfile({
      name: finalName,
      weightKg: finalWeightKg,
      baselineLifts: finalBaselineLifts,
    });
    await useBodyWeightStore.getState().syncBaselineWeight(finalWeightKg);

    if (isCustom) {
      if (hasEdits) {
        await useProgramStore.getState().setCustomProgram(buildUserProgramFromLocal() as unknown as UserProgram);
      } else {
        const storeProg = useProgramStore.getState().program;
        if (storeProg?.splitType === 'custom') {
          // Keep current custom program in store
        } else {
          await useProgramStore.getState().setCustomProgram(buildUserProgramFromLocal() as unknown as UserProgram);
        }
      }
    } else {
      await useProgramStore.getState().refreshProgram(updated);
    }
    await useUserProfileStore.getState().loadProfile();
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
                {language === 'uk' ? 'ПЕРСОНАЛІЗОВАНО' : 'PERSONALIZED'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Split Switcher (3 Main Presets + Separated Custom Card) */}
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
                      color={isActive ? '#0B0D0F' : colors.primary}
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

          {/* Dedicated Custom Plan Card - Prominently Separated */}
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
                  color={isCustom ? '#0B0D0F' : colors.primary}
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
              color={isCustom ? colors.primary : '#8E9BAE'}
            />
          </Pressable>
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
                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                      <Text style={styles.editWorkoutBtnText}>
                        {language === 'uk' ? 'Редагувати' : 'Edit'}
                      </Text>
                    </Pressable>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#8E9BAE"
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
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyExercisesText}>
                      {language === 'uk'
                        ? 'Порожнє тренування. Натисніть, щоб додати вправи'
                        : 'Empty workout. Tap to add exercises'}
                    </Text>
                  </Pressable>
                ) : !isExpanded ? (
                  /* Collapsed View: Preview row */
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
                      <Ionicons name="chevron-down" size={14} color={colors.primary} />
                    </View>
                  </View>
                ) : (
                  /* Expanded View: Full Exercise Detail Cards */
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
                      <Ionicons name="chevron-up" size={14} color="#8E9BAE" />
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
          <Ionicons name="arrow-forward" size={20} color="#0B0D0F" />
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
  splitSwitchWrap: {
    marginBottom: 20,
  },
  splitSwitchLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
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
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242B35',
  },
  splitPresetCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  splitPresetIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
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
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  splitPresetTitleActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  splitPresetSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E9BAE',
    textAlign: 'center',
  },
  splitPresetSubActive: {
    color: 'rgba(11, 13, 15, 0.8)',
    fontWeight: '700',
  },
  customSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242B35',
  },
  customSelectCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
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
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
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
    color: '#FFFFFF',
  },
  customSelectTitleActive: {
    color: colors.primary,
  },
  customBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
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
    color: colors.primary,
    letterSpacing: 0.5,
  },
  customBadgeTextActive: {
    color: '#0B0D0F',
  },
  customSelectSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E9BAE',
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
  toggleAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
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
  workoutCardExpanded: {
    borderColor: '#2A3646',
    backgroundColor: '#131821',
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
    gap: 8,
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
  collapsedPreviewRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A212B',
  },
  collapsedPreviewText: {
    fontSize: 12,
    color: '#8E9BAE',
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
    color: colors.primary,
  },
  fullExerciseList: {
    marginTop: 8,
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A212B',
  },
  exerciseDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222B38',
    padding: 10,
    gap: 10,
  },
  exerciseDetailThumbWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0E1115',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  exerciseDetailTargetText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseDetailWeightText: {
    color: '#C8D2DE',
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseDetailSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseDetailMuscle: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseDetailRest: {
    color: '#657385',
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
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '700',
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
