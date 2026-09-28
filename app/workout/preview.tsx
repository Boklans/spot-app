import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  calibrateInitialWeight,
  getExerciseAlternatives,
  type EquipmentId,
} from '@/lib/programGenerator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding, type OnboardingData } from '@/store/workoutStore';
import type { UserExercise, UserProgram, UserWorkout } from '@/types/userProgram';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import { ExerciseDetailModal } from '@/components/program/ExerciseDetailModal';
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import type { LibraryExercise } from '@/lib/exerciseLibrary';
import { generateUUID } from '@/lib/programMigration';

function getExerciseIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('bench') || lower.includes('chest')) return 'dumbbell';
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('press')) return 'dumbbell';
  if (lower.includes('row') || lower.includes('pulldown') || lower.includes('pull')) return 'arm-flex';
  if (lower.includes('curl') || lower.includes('tricep') || lower.includes('arm')) return 'dumbbell';
  return 'dumbbell';
}

export default function WorkoutPreview() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { unit, unitLabel, format, formatWithUnit, fromKg, toKg } = useWeightUnit();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const initializeSession = useWorkoutSessionStore((state) => state.initializeSession);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const activeRestEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const progress = useProgramProgressStore((state) => state.progress);
  const program = useProgramStore((state) => state.program);
  const history = useWorkoutHistoryStore((state) => state.workouts);

  const updateUserProgram = useProgramStore((state) => state.updateUserProgram);
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<UserExercise | null>(null);
  const [isAddPickerVisible, setIsAddPickerVisible] = useState(false);
  const [isWorkoutEditorVisible, setIsWorkoutEditorVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<UserExercise | null>(null);

  // Quick Exercise Config state
  const [configExercise, setConfigExercise] = useState<UserExercise | null>(null);
  const [configSets, setConfigSets] = useState(3);
  const [configWeightText, setConfigWeightText] = useState('0');
  const [configRepRange, setConfigRepRange] = useState('8-10');
  const [configRestSeconds, setConfigRestSeconds] = useState(90);

  useEffect(() => {
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
    loadOnboarding().then((data) => {
      if (data) setOnboarding(data);
    });
  }, []);

  const selectedId = typeof workoutId === 'string' ? workoutId : undefined;
  const scheduledWorkout = getScheduledWorkout(program, progress);
  const workout =
    program?.workouts?.find((item) => item.id === selectedId) ?? scheduledWorkout;

  const handleOpenSwapModal = (exercise: UserExercise) => {
    hapticImpact();
    setExerciseToSwap(exercise);
    setSwapModalVisible(true);
  };

  const alternatives = useMemo(() => {
    if (!exerciseToSwap) return [];
    const equipment = (onboarding?.equipment as EquipmentId[]) || ['full_gym'];
    return getExerciseAlternatives(exerciseToSwap.name, equipment);
  }, [exerciseToSwap, onboarding]);

  const handleSelectAlternative = async (altExercise: {
    id: string;
    name: string;
    muscleGroup: string;
    recommendedWeight: number;
    equipment: EquipmentId;
    weightIncrement: number;
    targetRepRange?: string;
  }) => {
    if (!exerciseToSwap || !workout || !program) return;
    hapticMedium();

    const calibratedWeight = onboarding
      ? calibrateInitialWeight(
          altExercise.recommendedWeight,
          altExercise.equipment,
          onboarding.experience,
          onboarding.goal,
          { weightKg: onboarding.weightKg, heightCm: onboarding.heightCm },
          altExercise.name,
          onboarding.baselineLifts
        )
      : altExercise.recommendedWeight;

    const updatedExercises: UserExercise[] = workout.exercises.map((ex) =>
      ex.id === exerciseToSwap.id
        ? {
            ...ex,
            name: altExercise.name,
            muscleGroup: altExercise.muscleGroup,
            equipment: altExercise.equipment,
            recommendedWeight: calibratedWeight,
            weightIncrement: altExercise.weightIncrement ?? 2.5,
            targetRepRange: altExercise.targetRepRange ?? ex.targetRepRange,
          }
        : ex
    );

    const updatedWorkout = { ...workout, exercises: updatedExercises };
    const updatedProgram = {
      ...program,
      workouts: program.workouts.map((w) => (w.id === workout.id ? updatedWorkout : w)),
    };

    await updateUserProgram(updatedProgram);
    setSwapModalVisible(false);
    setExerciseToSwap(null);
  };

  const handleAddExercise = async (libExercise: LibraryExercise) => {
    if (!workout || !program) return;
    hapticMedium();

    const newExercise: UserExercise = {
      id: generateUUID(),
      name: libExercise.name,
      muscleGroup: libExercise.muscleGroup,
      sets: libExercise.defaultSets ?? 3,
      recommendedWeight: libExercise.defaultWeight ?? 0,
      targetRepRange: libExercise.defaultRepRange ?? '8-10',
      equipment: libExercise.equipment,
      weightIncrement: libExercise.weightIncrement ?? 2.5,
      restSeconds: 90,
      customImageUri: libExercise.customImageUri,
      isCustom: libExercise.isCustom,
    };

    const nextWorkouts = program.workouts.map((w) => {
      if (w.id !== workout.id) return w;
      const updatedMuscles = w.muscleGroups.includes(libExercise.muscleGroup)
        ? w.muscleGroups
        : [...w.muscleGroups, libExercise.muscleGroup];
      return {
        ...w,
        muscleGroups: updatedMuscles,
        exercises: [...w.exercises, newExercise],
      };
    });

    const updatedProgram: UserProgram = {
      ...program,
      workouts: nextWorkouts,
    };

    await updateUserProgram(updatedProgram);
    hapticSuccess();
  };

  const handleSaveWorkoutFromEditor = async (updatedWorkout: UserWorkout) => {
    if (!program) return;
    const nextWorkouts = program.workouts.map((w) =>
      w.id === updatedWorkout.id ? updatedWorkout : w
    );
    const updatedProgram: UserProgram = {
      ...program,
      splitType: 'custom',
      workouts: nextWorkouts,
    };
    await updateUserProgram(updatedProgram);
    setIsWorkoutEditorVisible(false);
    hapticSuccess();
  };

  const handleOpenExerciseConfig = (ex: UserExercise) => {
    hapticLight();
    setConfigExercise(ex);
    setConfigSets(ex.sets || 3);
    const displayW = fromKg(ex.recommendedWeight || 0);
    setConfigWeightText(formatWeight(displayW));
    setConfigRepRange(ex.targetRepRange || '8-10');
    setConfigRestSeconds(ex.restSeconds || 90);
  };

  const handleSaveExerciseConfig = async () => {
    if (!configExercise || !workout || !program) return;
    hapticMedium();

    const parsedWeight = parseFloat(configWeightText.replace(',', '.'));
    const validWeight = !isNaN(parsedWeight) && parsedWeight >= 0 ? parsedWeight : 0;
    const weightInKg = toKg(validWeight);

    const updatedExercises = workout.exercises.map((ex) =>
      ex.id === configExercise.id
        ? {
            ...ex,
            sets: Math.max(1, Math.min(12, configSets)),
            recommendedWeight: Math.round(weightInKg * 100) / 100,
            targetRepRange: configRepRange,
            restSeconds: configRestSeconds,
          }
        : ex
    );

    const updatedWorkout = { ...workout, exercises: updatedExercises };
    const updatedProgram: UserProgram = {
      ...program,
      splitType: 'custom',
      workouts: program.workouts.map((w) => (w.id === workout.id ? updatedWorkout : w)),
    };

    await updateUserProgram(updatedProgram);
    setConfigExercise(null);
    hapticSuccess();
  };

  const handleDeleteExerciseFromConfig = () => {
    if (!configExercise || !workout || !program) return;
    Alert.alert(
      language === 'uk' ? 'Видалити вправу?' : 'Remove Exercise?',
      `${language === 'uk' ? 'Видалити' : 'Remove'} ${te(configExercise.name)} ${language === 'uk' ? 'з цього тренування?' : 'from this workout?'}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: language === 'uk' ? 'Видалити' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            const updatedExercises = workout.exercises.filter((ex) => ex.id !== configExercise.id);
            const updatedWorkout = { ...workout, exercises: updatedExercises };
            const updatedProgram: UserProgram = {
              ...program,
              splitType: 'custom',
              workouts: program.workouts.map((w) => (w.id === workout.id ? updatedWorkout : w)),
            };
            await updateUserProgram(updatedProgram);
            setConfigExercise(null);
            hapticSuccess();
          },
        },
      ]
    );
  };

  const handleSwapFromConfig = () => {
    if (!configExercise) return;
    const ex = configExercise;
    setConfigExercise(null);
    handleOpenSwapModal(ex);
  };

  // Calculate readiness percentage for this workout's muscle groups
  const readinessPercent = useMemo(() => {
    if (!workout) return 85;
    const recoveryStatuses = calculateMuscleRecovery(history);
    const targetMuscles = workout.muscleGroups || [];
    const matching = recoveryStatuses.filter((s) =>
      targetMuscles.some((tm) => tm.toLowerCase() === s.muscleGroup.toLowerCase())
    );
    const active = matching.length > 0 ? matching : recoveryStatuses;
    if (active.length === 0) return 92;
    const avg = Math.round(
      active.reduce((sum, curr) => sum + curr.readinessPercentage, 0) / active.length
    );
    return Math.min(100, Math.max(25, avg));
  }, [history, workout]);

  if (!workout) {
    return null;
  }

  const startWorkout = async () => {
    if (activeSession && !activeSession.completed) {
      const resume = () =>
        router.replace(activeRestEndsAt !== null ? '/workout/rest' : '/workout/active');
      Alert.alert(
        t('activeWorkout'),
        language === 'uk' ? 'У вас вже є активне тренування.' : 'You already have a workout in progress.',
        [
          { text: t('cancel'), style: 'cancel' },
          { text: language === 'uk' ? 'ПРОДОВЖИТИ' : 'RESUME', onPress: resume },
          {
            text: language === 'uk' ? 'НОВЕ ТРЕНУВАННЯ' : 'START NEW',
            style: 'destructive',
            onPress: async () => {
              await initializeSession(workout);
              router.replace('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await initializeSession(workout);
    router.replace('/workout/active');
  };

  const displayMuscles =
    workout.muscleGroups && workout.muscleGroups.length > 0
      ? workout.muscleGroups.map((m) => tm(m)).join(' • ')
      : language === 'uk'
      ? 'Груди • Спина • Руки'
      : 'Chest • Back • Arms';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/program');
            }
          }}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit workout day"
          hitSlop={8}
          onPress={() => {
            hapticMedium();
            setIsWorkoutEditorVisible(true);
          }}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Title Header */}
        <View style={styles.titleSection}>
          <Text style={styles.workoutTitle}>{tw(workout.name)}</Text>
          <Text style={styles.workoutMuscles}>{displayMuscles}</Text>

          {/* Readiness Progress Bar */}
          <View style={styles.readinessRow}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${readinessPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.readinessPercentText}>{readinessPercent}%</Text>
          </View>
        </View>

        {/* Exercises Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('exercises')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setIsWorkoutEditorVisible(true);
            }}
            style={styles.editDayLink}
          >
            <Ionicons name="create-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.editDayLinkText}>
              {language === 'uk' ? 'Редагувати день' : 'Edit Day'}
            </Text>
          </Pressable>
        </View>

        {/* Exercise Cards List */}
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise, index) => {
            const weightLabel = exercise.recommendedWeight
              ? formatWithUnit(exercise.recommendedWeight)
              : t('bodyweight');

            return (
              <Pressable
                key={exercise.id || `${exercise.name}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Exercise details for ${exercise.name}`}
                onPress={() => {
                  hapticLight();
                  setDetailExercise(exercise);
                }}
                style={({ pressed }) => [
                  styles.exerciseCard,
                  pressed && styles.exerciseCardPressed,
                ]}
              >
                <View style={styles.exerciseThumbWrap}>
                  <Image
                    source={getExerciseImage(exercise.name, exercise.customImageUri)}
                    style={styles.exerciseThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.thumbInfoBadge}>
                    <Ionicons name="information" size={9} color="#0B0D0F" />
                  </View>
                </View>
                <View style={styles.exerciseInfoCol}>
                  <Text numberOfLines={1} style={styles.exerciseName}>{te(exercise.name)}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.sets} {t('sets').toLowerCase()} • {weightLabel} • {exercise.targetRepRange || '8-10'}
                  </Text>
                </View>
                <View style={styles.cardActionsRight}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Налаштувати підходи"
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenExerciseConfig(exercise);
                    }}
                    style={({ pressed }) => [styles.quickConfigBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="options-outline" size={17} color="#8E959F" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Замінити вправу"
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenSwapModal(exercise);
                    }}
                    style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                    <Text style={styles.swapBtnText}>
                      {language === 'uk' ? 'Замінити' : 'Swap'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {/* Add Exercise Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Exercise"
            onPress={() => {
              hapticMedium();
              setIsAddPickerVisible(true);
            }}
            style={({ pressed }) => [styles.addExerciseBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.addExerciseBtnText}>
              {language === 'uk' ? '+ Додати вправу' : '+ Add Exercise'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Exercise Swap Modal */}
      <Modal
        visible={swapModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSwapModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {language === 'uk' ? 'Замінити вправу' : 'Swap Exercise'}
                </Text>
                {exerciseToSwap && (
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {language === 'uk' ? 'Замість' : 'Replacing'}: {te(exerciseToSwap.name)}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setSwapModalVisible(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#8E959F" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {alternatives.length === 0 ? (
                <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                  <Text style={{ color: '#8E959F', fontSize: 14 }}>
                    {language === 'uk'
                      ? 'Немає альтернативних вправ'
                      : 'No alternative exercises found'}
                  </Text>
                </View>
              ) : (
                alternatives.map((alt) => {
                  const altWeight = onboarding
                    ? calibrateInitialWeight(
                        alt.recommendedWeight,
                        alt.equipment,
                        onboarding.experience,
                        onboarding.goal,
                        { weightKg: onboarding.weightKg, heightCm: onboarding.heightCm },
                        alt.name,
                        onboarding.baselineLifts
                      )
                    : alt.recommendedWeight;
                  const weightStr = altWeight > 0 ? formatWithUnit(altWeight) : t('bodyweight');

                  return (
                    <Pressable
                      key={alt.id}
                      style={({ pressed }) => [
                        styles.altCard,
                        pressed && { backgroundColor: '#1A212D' },
                      ]}
                      onPress={() => handleSelectAlternative(alt)}
                    >
                      <View style={styles.altThumbWrap}>
                        <Image
                          source={getExerciseImage(alt.name)}
                          style={styles.altThumb}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.altName}>{te(alt.name)}</Text>
                        <Text style={styles.altMeta}>
                          {tm(alt.muscleGroup)} • {weightStr}
                        </Text>
                      </View>
                      <View style={styles.altSelectBadge}>
                        <Ionicons name="checkmark" size={14} color="#0B0D0F" />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={isAddPickerVisible}
        onClose={() => setIsAddPickerVisible(false)}
        onSelect={handleAddExercise}
      />

      {/* Quick Exercise Config Bottom Sheet */}
      <Modal
        visible={configExercise !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setConfigExercise(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => setConfigExercise(null)} />
          <View style={styles.configSheet}>
            {/* Sheet Header */}
            <View style={styles.configHeader}>
              {configExercise && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View technique"
                  onPress={() => {
                    const ex = configExercise;
                    setConfigExercise(null);
                    setTimeout(() => setDetailExercise(ex), 150);
                  }}
                  style={styles.configThumbWrap}
                >
                  <Image
                    source={getExerciseImage(configExercise.name, configExercise.customImageUri)}
                    style={styles.configThumb}
                    resizeMode="cover"
                  />
                </Pressable>
              )}
              <View style={styles.configInfoCol}>
                <Text numberOfLines={1} style={styles.configExerciseTitle}>
                  {configExercise ? te(configExercise.name) : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Anatomy and technique"
                  hitSlop={6}
                  onPress={() => {
                    const ex = configExercise;
                    setConfigExercise(null);
                    setTimeout(() => setDetailExercise(ex), 150);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}
                >
                  <Ionicons name="information-circle" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                    {language === 'uk' ? 'Анатомія та техніка' : 'Anatomy & Guide'}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setConfigExercise(null)}
                hitSlop={10}
                style={styles.configCloseBtn}
              >
                <Ionicons name="close" size={22} color="#8E959F" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.configBody}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Sets Stepper */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionLabel}>
                  {language === 'uk' ? 'КІЛЬКІСТЬ ПІДХОДІВ' : 'NUMBER OF SETS'}
                </Text>
                <View style={styles.configStepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease sets"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setConfigSets((s) => Math.max(1, s - 1));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="remove" size={22} color="#FFFFFF" />
                  </Pressable>

                  <View style={styles.configStepValueBox}>
                    <Text style={styles.configStepValueText}>{configSets}</Text>
                    <Text style={styles.configStepValueSub}>
                      {language === 'uk' ? 'підходи' : 'sets'}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase sets"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setConfigSets((s) => Math.min(10, s + 1));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* 2. Target Weight */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionLabel}>
                  {language === 'uk' ? 'ЦІЛЬОВА ВАГА' : 'TARGET WEIGHT'} ({unitLabel})
                </Text>
                <View style={styles.configStepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease weight 0.5"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      const current = parseFloat(configWeightText.replace(',', '.')) || 0;
                      const next = Math.max(0, Math.round((current - (unit === 'lbs' ? 1 : 0.5)) * 10) / 10);
                      setConfigWeightText(formatWeight(next));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="remove" size={22} color="#FFFFFF" />
                  </Pressable>

                  <View style={styles.configWeightInputWrap}>
                    <TextInput
                      style={styles.configWeightInput}
                      keyboardType="numeric"
                      value={configWeightText}
                      onChangeText={setConfigWeightText}
                      placeholder="0"
                      placeholderTextColor="#6C7A8E"
                      selectTextOnFocus
                    />
                    <Text style={styles.configWeightInputUnit}>{unitLabel}</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase weight 0.5"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      const current = parseFloat(configWeightText.replace(',', '.')) || 0;
                      const next = Math.round((current + (unit === 'lbs' ? 1 : 0.5)) * 10) / 10;
                      setConfigWeightText(formatWeight(next));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* 3. Rep Range */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionLabel}>
                  {language === 'uk' ? 'ДІАПАЗОН ПОВТОРЕНЬ' : 'TARGET REP RANGE'}
                </Text>
                <View style={styles.configPillsRow}>
                  {['6-8', '8-10', '10-12', '12-15', '15-20'].map((range) => {
                    const isSelected = configRepRange === range;
                    return (
                      <Pressable
                        key={range}
                        onPress={() => {
                          hapticLight();
                          setConfigRepRange(range);
                        }}
                        style={[styles.configPill, isSelected && styles.configPillActive]}
                      >
                        <Text style={[styles.configPillText, isSelected && styles.configPillTextActive]}>
                          {range}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 4. Rest Timer */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionLabel}>
                  {language === 'uk' ? 'ЧАС ВІДПОЧИНКУ' : 'REST INTERVAL'}
                </Text>
                <View style={styles.configPillsRow}>
                  {[
                    { sec: 60, label: '60s' },
                    { sec: 90, label: '90s' },
                    { sec: 120, label: '2m' },
                    { sec: 180, label: '3m' },
                  ].map((r) => {
                    const isSelected = configRestSeconds === r.sec;
                    return (
                      <Pressable
                        key={r.sec}
                        onPress={() => {
                          hapticLight();
                          setConfigRestSeconds(r.sec);
                        }}
                        style={[styles.configPill, isSelected && styles.configPillActive]}
                      >
                        <Text style={[styles.configPillText, isSelected && styles.configPillTextActive]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 5. Main Action Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save exercise changes"
                onPress={handleSaveExerciseConfig}
                style={({ pressed }) => [styles.configSaveBtn, pressed && styles.configSaveBtnPressed]}
              >
                <Ionicons name="checkmark" size={18} color="#0B0D0F" style={{ marginRight: 6 }} />
                <Text style={styles.configSaveBtnText}>
                  {language === 'uk' ? 'ЗБЕРЕГТИ ЗМІНИ' : 'SAVE CHANGES'}
                </Text>
              </Pressable>

              {/* 6. Secondary Swap & Remove Actions */}
              <View style={styles.configSecondaryRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSwapFromConfig}
                  style={styles.configSecondaryBtn}
                >
                  <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                  <Text numberOfLines={1} style={styles.configSecondaryBtnText}>
                    {language === 'uk' ? 'Замінити' : 'Swap'}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleDeleteExerciseFromConfig}
                  style={[styles.configSecondaryBtn, styles.configDeleteBtn]}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.configDeleteBtnText}>
                    {language === 'uk' ? 'Видалити' : 'Remove'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Exercise Detail Modal (Anatomy, Technique, Mistakes & Personal Best) */}
      {detailExercise && (
        <ExerciseDetailModal
          visible={detailExercise !== null}
          onClose={() => setDetailExercise(null)}
          exerciseName={detailExercise.name}
          muscleGroup={detailExercise.muscleGroup}
          customImageUri={detailExercise.customImageUri}
          equipment={detailExercise.equipment}
          onConfigure={() => handleOpenExerciseConfig(detailExercise)}
        />
      )}

      {/* Full Workout Editor Modal */}
      <WorkoutEditorModal
        visible={isWorkoutEditorVisible}
        workout={workout}
        onSaveWorkout={handleSaveWorkoutFromEditor}
        onClose={() => setIsWorkoutEditorVisible(false)}
      />

      {/* Sticky Bottom CTA Button */}
      <View style={styles.bottomBar}>
        <Button style={styles.startButton} onPress={startWorkout}>
          {t('startWorkout')}
        </Button>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 24,
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontSize: 14,
    color: '#8E959F',
    marginTop: 4,
    marginBottom: 16,
    fontWeight: '400',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C8FF3D',
    borderRadius: 3,
  },
  readinessPercentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E959F',
    fontVariant: ['tabular-nums'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E959F',
    fontVariant: ['tabular-nums'],
  },
  exerciseList: {
    gap: 10,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242B35',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  exerciseMeta: {
    fontSize: 13,
    color: '#8E959F',
    marginTop: 3,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#0B0D0F',
  },
  startButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 24,
    backgroundColor: '#C8FF3D',
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  swapBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#15191F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#242B35',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#242B35',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E959F',
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E242D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1A212D',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242B35',
  },
  altThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altThumb: {
    width: '100%',
    height: '100%',
  },
  altName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  altMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E959F',
    marginTop: 2,
  },
  altSelectBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#141A23',
    borderWidth: 1,
    borderColor: '#1E2836',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  addExerciseBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  editDayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
  },
  editDayLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  thumbInfoBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickConfigBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C232E',
    borderWidth: 1,
    borderColor: '#2A3442',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCardPressed: {
    opacity: 0.85,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFill,
  },
  configSheet: {
    backgroundColor: '#15191F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    borderColor: '#242B35',
    maxHeight: '85%',
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242B35',
    marginBottom: 16,
  },
  configThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0E1115',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  configThumb: {
    width: '100%',
    height: '100%',
  },
  configInfoCol: {
    flex: 1,
  },
  configExerciseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  configExerciseSub: {
    fontSize: 13,
    color: '#8E959F',
    marginTop: 2,
    fontWeight: '400',
  },
  configCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E242D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configBody: {
    flexShrink: 1,
  },
  configSection: {
    marginBottom: 18,
  },
  configSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E959F',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  configStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1A212D',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configStepBtnPressed: {
    backgroundColor: '#242B35',
  },
  configStepValueBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  configStepValueText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  configStepValueSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E959F',
  },
  configWeightInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  configWeightInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    minWidth: 50,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  configWeightInputUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  configPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  configPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#1A212D',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  configPillActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderColor: colors.primary,
  },
  configPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E959F',
  },
  configPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  configSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  configSaveBtnPressed: {
    opacity: 0.85,
  },
  configSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.2,
  },
  configSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  configSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A212D',
    borderWidth: 1,
    borderColor: '#242B35',
    borderRadius: 12,
    paddingVertical: 11,
  },
  configSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  configDeleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  configDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
});
