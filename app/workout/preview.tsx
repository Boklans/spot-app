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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  calibrateInitialWeight,
  getExerciseAlternatives,
  type EquipmentId,
} from '@/lib/programGenerator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { findLatestExerciseSets, inferEquipmentFromName, recommendWeight } from '@/lib/adaptiveProgression';
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    const equipment = ex.equipment || inferEquipmentFromName(ex.name);
    const exWithEquip = { ...ex, equipment } as any;
    const prevSets = findLatestExerciseSets(history, exWithEquip);
    const rec = recommendWeight(exWithEquip, prevSets);
    const effectiveWeight = rec.source === 'history'
      ? rec.recommendedWeight
      : (ex.recommendedWeight || 0);
    const displayW = fromKg(effectiveWeight);
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
            sets: Math.max(1, Math.min(25, configSets)),
            recommendedWeight: Math.round(weightInKg * 100) / 100,
            targetRepRange: configRepRange,
            restSeconds: configRestSeconds,
            isCustomRest: true,
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

  const totalSets = useMemo(
    () => (workout?.exercises || []).reduce((acc, ex) => acc + (ex.sets || 3), 0),
    [workout]
  );

  if (!workout) {
    return null;
  }

  const startWorkout = async () => {
    if (activeSession && !activeSession.completed) {
      const resume = () =>
        router.replace('/workout/active');
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
          <Ionicons name="chevron-back" size={26} color={colors.text} />
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
          <Ionicons name="create-outline" size={24} color={colors.text} />
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

          {/* Factual Workout Summary */}
          <View style={styles.readinessRow}>
            <Text style={styles.readinessPercentText}>
              {workout.exercises.length} {t('exercises').toLowerCase()} · {totalSets} {t('sets').toLowerCase()} · ~{workout.estimatedMinutes} {t('min')}
            </Text>
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
            style={({ pressed }) => [styles.editDayLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.editDayLinkText}>
              {language === 'uk' ? 'Змінити порядок' : 'Edit order'}
            </Text>
          </Pressable>
        </View>

        {/* Exercise Cards List */}
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise, index) => {
            const equipment = exercise.equipment || inferEquipmentFromName(exercise.name);
            const exWithEquip = { ...exercise, equipment } as any;
            const prevSets = findLatestExerciseSets(history, exWithEquip);
            const rec = recommendWeight(exWithEquip, prevSets);
            const effectiveWeight = rec.source === 'history'
              ? rec.recommendedWeight
              : (exercise.recommendedWeight || 0);
            const weightLabel = effectiveWeight
              ? formatWithUnit(effectiveWeight)
              : t('bodyweight');
            const targetRepsDisplay = rec.source === 'history' && rec.recommendedReps
              ? `${rec.recommendedReps} ${language === 'uk' ? 'повт' : 'reps'}`
              : `${exercise.targetRepRange || '8-12'} ${language === 'uk' ? 'повт' : 'reps'}`;

            const isSupersetA1 = Boolean(
              exercise.supersetWithNext && index < workout.exercises.length - 1
            );
            const isSupersetA2 = Boolean(
              index > 0 && workout.exercises[index - 1]?.supersetWithNext
            );

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
                  (isSupersetA1 || isSupersetA2) && {
                    borderColor: 'rgba(168, 85, 247, 0.45)',
                    borderWidth: 1,
                  },
                  pressed && styles.exerciseCardPressed,
                ]}
              >
                <View style={styles.exerciseThumbWrap}>
                  <Image
                    source={getExerciseImage(exercise.name, exercise.customImageUri)}
                    style={styles.exerciseThumb}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.exerciseInfoCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(isSupersetA1 || isSupersetA2) && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                          backgroundColor: 'rgba(168, 85, 247, 0.16)',
                          borderWidth: 1,
                          borderColor: 'rgba(168, 85, 247, 0.38)',
                          borderRadius: 6,
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
                    <Text numberOfLines={1} style={[styles.exerciseName, { flex: 1 }]}>
                      {te(exercise.name)}
                    </Text>
                  </View>
                  <Text style={styles.exerciseMeta}>
                    {exercise.sets} {t('sets').toLowerCase()} · {weightLabel} · {targetRepsDisplay}
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
                    style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#8E959F" />
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
            <Ionicons name="add" size={18} color="#A0A8B4" />
            <Text style={styles.addExerciseBtnText}>
              {language === 'uk' ? 'Додати вправу' : 'Add Exercise'}
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
                  <Text style={{ color: colors.secondary, fontSize: 14 }}>
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
                        pressed && { opacity: 0.8 },
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
                        <Ionicons name="checkmark" size={14} color={colors.text} />
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
                  <Ionicons name="information-circle" size={13} color={colors.primaryText} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: colors.primaryText, fontWeight: '700' }}>
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
                    <Ionicons name="remove" size={22} color={colors.text} />
                  </Pressable>

                  <View style={styles.configStepValueBox}>
                    <TextInput
                      style={styles.configStepValueText}
                      keyboardType="number-pad"
                      value={String(configSets)}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          setConfigSets(Math.max(1, Math.min(25, parsed)));
                        } else if (val === '') {
                          setConfigSets(1);
                        }
                      }}
                      selectTextOnFocus
                    />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase sets"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setConfigSets((s) => Math.min(25, s + 1));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="add" size={22} color={colors.text} />
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
                    <Ionicons name="remove" size={22} color={colors.text} />
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
                    <Ionicons name="add" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              {/* 3. Target Reps */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionLabel}>
                  {language === 'uk' ? 'ЦІЛЬОВІ ПОВТОРЕННЯ' : 'TARGET REPS'}
                </Text>
                <View style={styles.configStepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease reps"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      const current = parseInt(configRepRange.split('-')[0], 10) || 8;
                      const next = Math.max(1, current - 1);
                      setConfigRepRange(next.toString());
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="remove" size={22} color={colors.text} />
                  </Pressable>

                  <View style={styles.configWeightInputWrap}>
                    <TextInput
                      style={styles.configWeightInput}
                      keyboardType="default"
                      value={configRepRange}
                      onChangeText={setConfigRepRange}
                      placeholder="8"
                      placeholderTextColor="#6C7A8E"
                      selectTextOnFocus
                    />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase reps"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      const current = parseInt(configRepRange.split('-')[0], 10) || 8;
                      const next = Math.min(50, current + 1);
                      setConfigRepRange(next.toString());
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="add" size={22} color={colors.text} />
                  </Pressable>
                </View>

                {/* Quick Presets */}
                <View style={[styles.configPillsRow, { marginTop: 8 }]}>
                  {['5', '8', '10', '12', '8-12'].map((preset) => {
                    const isSelected = configRepRange === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => {
                          hapticLight();
                          setConfigRepRange(preset);
                        }}
                        style={[styles.configPill, isSelected && styles.configPillActive]}
                      >
                        <Text style={[styles.configPillText, isSelected && styles.configPillTextActive]}>
                          {preset}
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

                {/* Stepper with -15s / +15s */}
                <View style={[styles.configStepperRow, { marginBottom: 12 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease rest by 15s"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setConfigRestSeconds((s) => Math.max(0, s - 15));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="remove" size={22} color={colors.text} />
                  </Pressable>

                  <View style={styles.configStepValueBox}>
                    <Text style={styles.configStepValueText}>
                      {configRestSeconds === 0
                        ? '0s'
                        : `${Math.floor(configRestSeconds / 60)}:${(configRestSeconds % 60).toString().padStart(2, '0')}`}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase rest by 15s"
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      setConfigRestSeconds((s) => Math.min(600, s + 15));
                    }}
                    style={({ pressed }) => [styles.configStepBtn, pressed && styles.configStepBtnPressed]}
                  >
                    <Ionicons name="add" size={22} color={colors.text} />
                  </Pressable>
                </View>

                {/* Extended Quick Presets */}
                <View style={styles.configPillsRow}>
                  {[
                    { sec: 0, label: '0s' },
                    { sec: 15, label: '15s' },
                    { sec: 30, label: '30s' },
                    { sec: 45, label: '45s' },
                    { sec: 60, label: '60s' },
                    { sec: 90, label: '90s' },
                    { sec: 120, label: '2m' },
                    { sec: 150, label: '2:30' },
                    { sec: 180, label: '3m' },
                    { sec: 240, label: '4m' },
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
                  <Ionicons name="swap-horizontal" size={16} color={colors.primaryText} />
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick Log"
          onPress={() => {
            hapticLight();
            router.push({ pathname: '/workout/quick-log', params: { workoutId: workout.id } });
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.quickLogPreviewBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="flash-outline" size={14} color="#8E959F" style={{ marginRight: 5 }} />
          <Text style={styles.quickLogPreviewBtnText}>{t('quickLog')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontSize: 14,
    color: colors.secondary,
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
    color: colors.secondary,
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
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
    fontVariant: ['tabular-nums'],
  },
  exerciseList: {
    gap: 8,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  exerciseThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.elevated,
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  exerciseMeta: {
    fontSize: 13,
    color: colors.secondary,
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
    backgroundColor: colors.background,
  },
  startButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#C8FF3D',
  },
  quickLogPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  quickLogPreviewBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
  },
  swapBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.secondary,
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.elevated,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  altThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
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
    fontWeight: '600',
    color: colors.text,
  },
  altMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.secondary,
    marginTop: 2,
  },
  altSelectBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  addExerciseBtnText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  editDayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editDayLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickConfigBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCardPressed: {
    opacity: 0.8,
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFill,
  },
  configSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: 16,
  },
  configThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  configExerciseSub: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
    fontWeight: '400',
  },
  configCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
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
    color: colors.secondary,
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
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configStepBtnPressed: {
    opacity: 0.75,
  },
  configStepValueBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configStepValueText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  configWeightInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  configWeightInput: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
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
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configPillActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.accentLine,
  },
  configPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  configPillTextActive: {
    color: colors.primaryText,
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
    color: colors.onPrimary,
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
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
  },
  configSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
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
