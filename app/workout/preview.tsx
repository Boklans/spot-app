import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticImpact, hapticMedium } from '@/lib/haptics';
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
import type { UserExercise, UserProgram } from '@/types/userProgram';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import type { LibraryExercise } from '@/lib/exerciseLibrary';
import { generateUUID } from '@/lib/programMigration';
import { hapticSuccess } from '@/lib/haptics';

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
  const { formatWithUnit } = useWeightUnit();
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
          accessibilityLabel="Edit routine"
          onPress={() => {
            hapticMedium();
            router.push('/program/edit');
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
          <Text style={styles.sectionMeta}>
            {workout.exercises.length} • ~{workout.estimatedMinutes} {t('min')}
          </Text>
        </View>

        {/* Exercise Cards List */}
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise, index) => {
            const weightLabel = exercise.recommendedWeight
              ? formatWithUnit(exercise.recommendedWeight)
              : t('bodyweight');

            return (
              <View key={exercise.id || `${exercise.name}-${index}`} style={styles.exerciseCard}>
                <View style={styles.exerciseThumbWrap}>
                  <Image
                    source={getExerciseImage(exercise.name)}
                    style={styles.exerciseThumb}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.exerciseInfoCol}>
                  <Text style={styles.exerciseName}>{te(exercise.name)}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.sets} {t('sets').toLowerCase()} • {weightLabel}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Замінити вправу"
                  hitSlop={8}
                  onPress={() => handleOpenSwapModal(exercise)}
                  style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                  <Text style={styles.swapBtnText}>
                    {language === 'uk' ? 'Замінити' : 'Swap'}
                  </Text>
                </Pressable>
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 24,
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontSize: 15,
    color: '#8E959F',
    marginTop: 4,
    marginBottom: 16,
    fontWeight: '500',
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
    fontWeight: '800',
    color: '#8E959F',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E959F',
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
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  exerciseMeta: {
    fontSize: 14,
    color: '#8E959F',
    marginTop: 3,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
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
    fontWeight: '800',
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
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
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
});
