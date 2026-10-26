import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  cancelRestTimerNotification,
  initNotifications,
  requestNotificationPermissions,
  scheduleRestTimerNotification,
} from '@/lib/notificationService';
import { playRestCompleteSound } from '@/lib/soundEffects';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { inferEquipmentFromName, isAssistedExercise, parseRepRange, practicalIncrement } from '@/lib/adaptiveProgression';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { ExerciseDetailModal } from '@/components/program/ExerciseDetailModal';
import { EditSetModal } from '@/components/workout/EditSetModal';
import { ProgressionGuideModal } from '@/components/workout/ProgressionGuideModal';
import { ExerciseNoteModal } from '@/components/workout/ExerciseNoteModal';

const EXERCISE_ALTERNATIVES: Record<string, Array<{ name: string; muscleGroup: string; defaultWeight: number }>> = {
  Chest: [
    { name: 'Barbell Bench Press', muscleGroup: 'Chest', defaultWeight: 60 },
    { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', defaultWeight: 22 },
    { name: 'Dumbbell Bench Press', muscleGroup: 'Chest', defaultWeight: 24 },
    { name: 'Cable Chest Fly', muscleGroup: 'Chest', defaultWeight: 15 },
    { name: 'Machine Chest Press', muscleGroup: 'Chest', defaultWeight: 45 },
    { name: 'Push-Ups', muscleGroup: 'Chest', defaultWeight: 0 },
  ],
  Back: [
    { name: 'Barbell Bent Over Row', muscleGroup: 'Back', defaultWeight: 50 },
    { name: 'Lat Pulldown', muscleGroup: 'Back', defaultWeight: 45 },
    { name: 'Seated Cable Row', muscleGroup: 'Back', defaultWeight: 45 },
    { name: 'Dumbbell Single-Arm Row', muscleGroup: 'Back', defaultWeight: 22 },
    { name: 'Pull-Ups / Chin-Ups', muscleGroup: 'Back', defaultWeight: 0 },
  ],
  Shoulders: [
    { name: 'Overhead Barbell Press', muscleGroup: 'Shoulders', defaultWeight: 40 },
    { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', defaultWeight: 18 },
    { name: 'Lateral Dumbbell Raise', muscleGroup: 'Shoulders', defaultWeight: 10 },
    { name: 'Face Pulls', muscleGroup: 'Shoulders', defaultWeight: 25 },
  ],
  Legs: [
    { name: 'Barbell Back Squat', muscleGroup: 'Legs', defaultWeight: 70 },
    { name: 'Leg Press', muscleGroup: 'Legs', defaultWeight: 120 },
    { name: 'Romanian Deadlift', muscleGroup: 'Legs', defaultWeight: 60 },
    { name: 'Bulgarian Split Squat', muscleGroup: 'Legs', defaultWeight: 16 },
    { name: 'Leg Extension', muscleGroup: 'Legs', defaultWeight: 40 },
    { name: 'Lying Leg Curl', muscleGroup: 'Legs', defaultWeight: 35 },
  ],
  Arms: [
    { name: 'Barbell Biceps Curl', muscleGroup: 'Arms', defaultWeight: 25 },
    { name: 'Incline Dumbbell Curl', muscleGroup: 'Arms', defaultWeight: 12 },
    { name: 'Hammer Curl', muscleGroup: 'Arms', defaultWeight: 14 },
    { name: 'Triceps Cable Pushdown', muscleGroup: 'Arms', defaultWeight: 30 },
    { name: 'Overhead Triceps Extension', muscleGroup: 'Arms', defaultWeight: 20 },
    { name: 'Skull Crushers', muscleGroup: 'Arms', defaultWeight: 25 },
  ],
};

function getExerciseIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('bench') || lower.includes('chest')) return 'dumbbell';
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('press')) return 'dumbbell';
  if (lower.includes('row') || lower.includes('pulldown') || lower.includes('pull')) return 'arm-flex';
  if (lower.includes('curl') || lower.includes('tricep') || lower.includes('arm')) return 'dumbbell';
  return 'dumbbell';
}

function formatElapsed(totalSec: number): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export default function Active() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { unit, unitLabel, format, formatWithUnit, fromKg, toKg } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const completeCurrentSet = useWorkoutSessionStore((state) => state.completeCurrentSet);
  const toggleSetCompletion = useWorkoutSessionStore((state) => state.toggleSetCompletion);
  const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);
  const swapExercise = useWorkoutSessionStore((state) => state.swapExercise);
  const addRestTime = useWorkoutSessionStore((state) => state.addRestTime);
  const skipRest = useWorkoutSessionStore((state) => state.skipRest);

  const [finishing, setFinishing] = useState(false);
  const [submittingSet, setSubmittingSet] = useState(false);
  const isSubmittingSetRef = useRef(false);
  const isExitingRef = useRef(false);
  const lastHapticSecond = useRef<number | null>(null);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    exerciseIndex: number;
    setIndex: number;
    initialFocusField?: 'weight' | 'reps';
  } | null>(null);

  const exerciseNotes = useExerciseNotesStore((state) => state.notes);
  const notesHydrated = useExerciseNotesStore((state) => state.hydrated);
  const loadExerciseNotes = useExerciseNotesStore((state) => state.loadNotes);
  const saveExerciseNote = useExerciseNotesStore((state) => state.setNote);

  useEffect(() => {
    if (!notesHydrated) {
      loadExerciseNotes();
    }
  }, [notesHydrated, loadExerciseNotes]);

  useEffect(() => {
    initNotifications().catch(() => undefined);
    requestNotificationPermissions().catch(() => undefined);
  }, []);

  const [now, setNow] = useState(Date.now());
  const [isHydrating, setIsHydrating] = useState(!session);

  const restRemainingSeconds = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const isResting = restEndsAt !== null && restRemainingSeconds > 0;

  const restAnim = useRef(new Animated.Value(0)).current;
  const [totalRestSeconds, setTotalRestSeconds] = useState<number>(90);

  useEffect(() => {
    if (!restEndsAt || restEndsAt <= Date.now()) {
      restAnim.setValue(0);
      return;
    }

    const durationMs = restEndsAt - Date.now();
    const remainingSec = Math.ceil(durationMs / 1000);
    const newTotal = Math.max(totalRestSeconds, remainingSec);
    setTotalRestSeconds(newTotal);

    const initialFraction = Math.max(0, Math.min(1, durationMs / (newTotal * 1000)));
    restAnim.setValue(initialFraction);

    const anim = Animated.timing(restAnim, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [restEndsAt]);

  const restBarWidth = restAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    isSubmittingSetRef.current = false;
    setSubmittingSet(false);
  }, [session?.currentExerciseIndex, session?.currentSetIndex]);

  useEffect(() => {
    if (!session) {
      useWorkoutSessionStore.getState().hydrateSession().finally(() => {
        setIsHydrating(false);
      });
    } else {
      setIsHydrating(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Audio, haptics & countdown alert for active rest
  useEffect(() => {
    if (!restEndsAt) {
      lastHapticSecond.current = null;
      return;
    }
    const remaining = Math.max(0, Math.ceil((restEndsAt - now) / 1000));
    if (remaining <= 3 && remaining > 0 && lastHapticSecond.current !== remaining) {
      lastHapticSecond.current = remaining;
      hapticLight();
    } else if (remaining === 0 && lastHapticSecond.current !== 0) {
      lastHapticSecond.current = 0;
      hapticSuccess();
      playRestCompleteSound();
      cancelRestTimerNotification();
      skipRest();
    }
  }, [restEndsAt, now, skipRest]);

  // Background notifications for rest timer
  useEffect(() => {
    const handleBgNotification = (nextState: string) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (restEndsAt && restEndsAt > Date.now()) {
          const remaining = Math.max(1, Math.ceil((restEndsAt - Date.now()) / 1000));
          const currentEx = session?.exercises[session.currentExerciseIndex];
          scheduleRestTimerNotification(
            remaining,
            te(currentEx?.name || 'Workout'),
            (session?.currentSetIndex ?? 0) + 1,
            currentEx?.sets.length ?? 3,
            language
          );
        }
      } else if (nextState === 'active') {
        cancelRestTimerNotification();
      }
    };
    const sub = AppState.addEventListener('change', handleBgNotification);
    return () => {
      sub.remove();
      cancelRestTimerNotification();
    };
  }, [restEndsAt, session, te, language]);

  const progress = session ? getSessionProgress(session) : { completedSets: 0, totalSets: 0, percentage: 0 };

  const exitWorkout = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    router.replace('/(tabs)');
  }, []);

  const handleClose = useCallback(() => {
    if (!session || progress.completedSets === 0) {
      exitWorkout();
      return;
    }
    const isPartialNow = progress.completedSets < progress.totalSets;
    Alert.alert(
      language === 'uk' ? 'Перервати тренування?' : 'Interrupt Workout?',
      language === 'uk'
        ? `Виконано ${progress.completedSets} із ${progress.totalSets} підходів. Зберегти виконані підходи як часткове тренування чи поставити на паузу?`
        : `You completed ${progress.completedSets} of ${progress.totalSets} sets. Save completed sets as a partial workout, or pause to resume later?`,
      [
        { text: language === 'uk' ? 'Продовжити тренування' : 'Keep Training', style: 'cancel' },
        {
          text: language === 'uk' ? 'Пауза (на головну)' : 'Pause & Exit',
          onPress: exitWorkout,
        },
        {
          text: isPartialNow
            ? (language === 'uk' ? `Зберегти частково (${progress.completedSets}/${progress.totalSets})` : `Save Partial (${progress.completedSets}/${progress.totalSets})`)
            : (language === 'uk' ? 'Завершити та зберегти' : 'Finish & Save'),
          onPress: async () => {
            setFinishing(true);
            try {
              await finalizeWorkoutSession(session);
              router.replace('/workout/complete');
            } catch {
              setFinishing(false);
              exitWorkout();
            }
          },
        },
      ]
    );
  }, [session, progress.completedSets, progress.totalSets, language, exitWorkout]);

  useEffect(() => {
    const onBackPress = () => {
      handleClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleClose]);

  if (isHydrating) {
    return <SafeAreaView style={styles.safe} />;
  }

  if (!session || !session.exercises || session.exercises.length === 0 || !session.exercises[session.currentExerciseIndex]) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Button onPress={() => router.replace('/(tabs)')}>{t('backToHome')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const elapsedSeconds = session.startedAt
    ? Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000))
    : 0;

  const exercise = session.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session.currentSetIndex];
  const remainingUncompletedSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => !s.completed).length,
    0
  );
  const isLastRemainingSet = remainingUncompletedSets === 1 && Boolean(activeSet && !activeSet.completed);

  const handleSaveEditedSet = ({ weight, reps, rir }: { weight: number; reps: number; rir?: number | null }) => {
    if (!editingTarget || !session) return;
    const { exerciseIndex, setIndex } = editingTarget;
    const editedSet = session.exercises[exerciseIndex]?.sets[setIndex];
    const shouldPropagate =
      exerciseIndex === session.currentExerciseIndex &&
      setIndex === session.currentSetIndex &&
      Boolean(editedSet && !editedSet.completed);
    useWorkoutSessionStore.getState().updateSet(exerciseIndex, setIndex, { weight, reps, rir }, shouldPropagate);
    setEditingTarget(null);
  };

  const targetExerciseForEditing = editingTarget !== null && session
    ? session.exercises[editingTarget.exerciseIndex]
    : null;
  const targetSetForEditing = targetExerciseForEditing && editingTarget !== null
    ? targetExerciseForEditing.sets[editingTarget.setIndex]
    : null;

  const prevSetForActive = exercise?.previousSets?.[session.currentSetIndex] || exercise?.previousSets?.[0];
  const prevContextText = prevSetForActive
    ? `${prevSetForActive.weight ? formatWithUnit(prevSetForActive.weight) : t('bodyweight')} × ${prevSetForActive.reps}`
    : null;

  const prevWeight = prevSetForActive?.weight ?? 0;
  const currentWeight = activeSet?.weight ?? 0;
  const prevReps = prevSetForActive?.reps ?? 0;
  const currentReps = activeSet?.reps ?? 0;

  const currentEquip = exercise?.equipment || inferEquipmentFromName(exercise?.name || '');
  const isAssisted = isAssistedExercise(exercise?.name || '');
  const { maximum: maxTargetReps } = parseRepRange(activeSet?.targetReps || '8-12');
  const currentNote = exercise ? (exerciseNotes[exercise.name.trim().toLowerCase()] || '') : '';

  const prevDisplayWeight = fromKg(prevWeight);
  const currentDisplayWeight = fromKg(currentWeight);
  const weightDeltaDisplay = Math.round((currentDisplayWeight - prevDisplayWeight) * 10) / 10;
  const repsDelta = currentReps - prevReps;

  const hasWeightIncrease = prevWeight > 0 && (isAssisted ? weightDeltaDisplay < 0 : weightDeltaDisplay > 0);
  const hasRepsIncrease = !hasWeightIncrease && prevReps > 0 && repsDelta > 0 && Math.abs(weightDeltaDisplay) < 0.01;
  const isProgressed = hasWeightIncrease || hasRepsIncrease;

  const recWeight = exercise?.recommendation?.recommendedWeight ?? currentWeight;
  const recReps = exercise?.recommendation?.recommendedReps ?? currentReps;
  const isManuallyAdjusted = Boolean(
    exercise?.recommendation &&
    (Math.abs(currentWeight - recWeight) > 0.01 ||
      (typeof exercise.recommendation.recommendedReps === 'number' && currentReps !== recReps))
  );

  const nextUnlockHint =
    currentEquip === 'bodyweight'
      ? (language === 'uk'
          ? `Коли виконаєш ${maxTargetReps} повт у всіх підходах — перейдемо на наступний рівень`
          : `Hit ${maxTargetReps} reps on all sets to unlock the next level`)
      : isAssisted
      ? (language === 'uk'
          ? `Коли виконаєш ${maxTargetReps} повт у всіх підходах — зменшимо противагу`
          : `Hit ${maxTargetReps} reps on all sets to reduce assistance`)
      : (language === 'uk'
          ? `Коли виконаєш ${maxTargetReps} повт у всіх підходах — збільшимо вагу`
          : `Hit ${maxTargetReps} reps on all sets to increase weight`);

  const handleToggleSet = async (targetSetIndex: number) => {
    if (isSubmittingSetRef.current || finishing || submittingSet) return;
    const currentSet = exercise?.sets[targetSetIndex];
    if (!currentSet) return;

    if (currentSet.completed) {
      // Toggle to uncompleted (Undo)
      hapticLight();
      cancelRestTimerNotification();
      toggleSetCompletion(session.currentExerciseIndex, targetSetIndex);
    } else {
      // Complete set in 1 TAP
      isSubmittingSetRef.current = true;
      setSubmittingSet(true);
      try {
        hapticSuccess();
        toggleSetCompletion(session.currentExerciseIndex, targetSetIndex);

        const latestSession = useWorkoutSessionStore.getState().session;
        const isCompleted = Boolean(latestSession?.completed);

        if (isCompleted) {
          setFinishing(true);
          if (latestSession) await finalizeWorkoutSession(latestSession);
          router.replace('/workout/complete');
        } else {
          setTimeout(() => {
            isSubmittingSetRef.current = false;
            setSubmittingSet(false);
          }, 150);
        }
      } catch {
        setFinishing(false);
        setSubmittingSet(false);
        isSubmittingSetRef.current = false;
        Alert.alert(
          t('couldNotSave'),
          t('couldNotSaveDesc')
        );
      }
    }
  };

  const finishSet = async () => {
    await handleToggleSet(session.currentSetIndex);
  };

  const percent = Math.round(progress.percentage);

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={handleClose}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.topWorkoutCenter}>
          <Text numberOfLines={1} style={styles.topWorkoutName}>{tw(session.workoutName)}</Text>
          <Text style={styles.stopwatchText}>{formatElapsed(elapsedSeconds)}</Text>
        </View>

        <Text style={styles.topPercent}>{percent}%</Text>
      </View>

      {/* Progress Line */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
      </View>

      {/* Sleek Hevy-style Rest Timer Pill */}
      {isResting && (
        <View style={styles.restTimerPill}>
          <View style={styles.restTimerCenterCol}>
            <View style={styles.restTimerNumbersRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Subtract 15 seconds"
                hitSlop={10}
                onPress={() => {
                  hapticLight();
                  addRestTime(-15);
                }}
                style={styles.restAdjustBtn}
              >
                <Text style={styles.restAdjustText}>-15с</Text>
              </Pressable>

              <Text style={styles.restDigitsText}>
                {formatElapsed(restRemainingSeconds)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add 15 seconds"
                hitSlop={10}
                onPress={() => {
                  hapticLight();
                  addRestTime(15);
                }}
                style={styles.restAdjustBtn}
              >
                <Text style={styles.restAdjustText}>+15с</Text>
              </Pressable>
            </View>

            <View style={styles.restProgressTrack}>
              <Animated.View style={[styles.restProgressFill, { width: restBarWidth }]} />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip rest"
            hitSlop={8}
            onPress={() => {
              hapticMedium();
              cancelRestTimerNotification();
              skipRest();
            }}
            style={styles.restSkipBtn}
          >
            <Text style={styles.restSkipBtnText}>
              {language === 'uk' ? 'Пропустити' : 'Skip'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Exercise Card */}
        <View style={styles.exerciseCard}>
          {/* Header Row: Thumbnail + Info + Actions */}
          <View style={styles.exerciseHeaderRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exercise details and technique"
              onPress={() => {
                hapticLight();
                setShowDetailModal(true);
              }}
              style={styles.exerciseThumbWrap}
            >
              <Image
                source={getExerciseImage(exercise.name, exercise.customImageUri)}
                style={styles.exerciseThumb}
                resizeMode="cover"
              />
            </Pressable>

            <View style={styles.exerciseInfoCol}>
              <Text style={styles.exerciseMuscleText}>{tm(exercise.muscleGroup)}</Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setShowDetailModal(true);
                }}
              >
                <Text numberOfLines={2} style={styles.exerciseNameText}>
                  {te(exercise.name)}
                </Text>
              </Pressable>
            </View>

            {/* Quick Action Icons */}
            <View style={styles.exerciseActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View technique guide"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  setShowDetailModal(true);
                }}
                style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="information-circle-outline" size={20} color="#8E959F" />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap exercise"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  setShowSwapModal(true);
                }}
                style={({ pressed }) => [styles.iconActionBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="swap-horizontal" size={18} color="#8E959F" />
              </Pressable>
            </View>
          </View>

          {/* Sub-header Context Row: Adaptive Target + Add Note */}
          <View style={styles.contextChipsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View progression details"
              hitSlop={6}
              onPress={() => {
                hapticLight();
                setShowProgressionModal(true);
              }}
              style={styles.targetChip}
            >
              <Text style={styles.targetChipText}>
                {language === 'uk' ? 'Ціль: ' : 'Goal: '}
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {currentWeight ? formatWithUnit(currentWeight) : t('bodyweight')} × {currentReps}
                </Text>
                {hasWeightIncrease
                  ? ` (+${weightDeltaDisplay} ${unitLabel})`
                  : hasRepsIncrease
                  ? ` (+${repsDelta} ${language === 'uk' ? 'повт' : 'reps'})`
                  : ''}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#6C7685" />
            </Pressable>

            {!currentNote && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add note"
                hitSlop={6}
                onPress={() => {
                  hapticLight();
                  setShowNoteModal(true);
                }}
                style={styles.addNoteChip}
              >
                <Ionicons name="create-outline" size={13} color="#8E959F" />
                <Text style={styles.addNoteChipText}>
                  {language === 'uk' ? 'Нотатка' : 'Note'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Saved Exercise Note Bar */}
          {currentNote ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit note"
              hitSlop={6}
              onPress={() => {
                hapticLight();
                setShowNoteModal(true);
              }}
              style={styles.noteFullBar}
            >
              <Text numberOfLines={2} style={styles.noteFullBarText}>
                {currentNote}
              </Text>
              <Ionicons name="create-outline" size={14} color="#7D8796" />
            </Pressable>
          ) : null}

          {/* Sets Table */}
          <View style={styles.tableHeaderRow}>
            <Text numberOfLines={1} style={styles.tableHeadSet}>{t('set')}</Text>
            <Text numberOfLines={1} style={styles.tableHeadPrev}>{language === 'uk' ? 'Минуле' : 'Prev'}</Text>
            <Text numberOfLines={1} style={styles.tableHeadWeight}>{unitLabel}</Text>
            <Text numberOfLines={1} style={styles.tableHeadReps}>{language === 'uk' ? 'Повт' : t('reps')}</Text>
            <Text numberOfLines={1} style={styles.tableHeadStatus}>✓</Text>
          </View>

          {/* Sets Rows */}
          <View style={styles.setsList}>
            {exercise.sets.map((set, index) => {
              const isCurrent = index === session.currentSetIndex;
              const isDone = set.completed;
              const weightDisplay = set.weight ? format(set.weight) : (language === 'uk' ? 'ВТ' : 'BW');
              const prevForThisSet = exercise.previousSets?.[index] || (index === 0 ? exercise.previousSets?.[0] : null);
              const prevSetText = prevForThisSet
                ? `${prevForThisSet.weight ? format(prevForThisSet.weight) : (language === 'uk' ? 'ВТ' : 'BW')} × ${prevForThisSet.reps}`
                : '—';
              const setWeightIncreased = isDone && prevForThisSet && prevForThisSet.weight > 0 && (set.weight ?? 0) > prevForThisSet.weight;
              const setRepsIncreased = isDone && prevForThisSet && (set.weight ?? 0) >= prevForThisSet.weight && (set.reps ?? 0) > prevForThisSet.reps;

              return (
                <Pressable
                  key={set.id || index}
                  onPress={() => {
                    if (!isCurrent) {
                      hapticLight();
                      useWorkoutSessionStore.getState().setCurrentSetIndex(index);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.setRow,
                    isCurrent && styles.setRowActive,
                    isDone && styles.setRowDone,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.setColNum, isCurrent && styles.textHighlight, isDone && styles.setColDoneText]}>
                    {index + 1}
                  </Text>

                  <View style={styles.prevColWrap}>
                    <Text style={[styles.setColPrev, isDone && styles.setColDoneText]}>
                      {prevSetText}
                    </Text>
                    {set.rir !== undefined && (
                      <Text style={styles.rirInlineText}>
                        {set.rir === 0 ? '0 RIR' : `${set.rir} RIR`}
                      </Text>
                    )}
                  </View>

                  {/* Direct Interactive Weight Pill */}
                  <Pressable
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit weight for set ${index + 1}`}
                    onPress={() => {
                      hapticLight();
                      setEditingTarget({
                        exerciseIndex: session.currentExerciseIndex,
                        setIndex: index,
                        initialFocusField: 'weight',
                      });
                    }}
                    style={[styles.cellPill, isCurrent && styles.cellPillActive, isDone && styles.cellPillDone]}
                  >
                    <Text style={[
                      styles.cellPillText,
                      isCurrent && styles.cellPillTextActive,
                      isDone && styles.cellPillTextDone,
                      setWeightIncreased && styles.cellPillTextProgression,
                    ]}>
                      {weightDisplay}{setWeightIncreased ? ' ↑' : ''}
                    </Text>
                  </Pressable>

                  {/* Direct Interactive Reps Pill */}
                  <Pressable
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit reps for set ${index + 1}`}
                    onPress={() => {
                      hapticLight();
                      setEditingTarget({
                        exerciseIndex: session.currentExerciseIndex,
                        setIndex: index,
                        initialFocusField: 'reps',
                      });
                    }}
                    style={[styles.cellPill, isCurrent && styles.cellPillActive, isDone && styles.cellPillDone]}
                  >
                    <Text style={[
                      styles.cellPillText,
                      isCurrent && styles.cellPillTextActive,
                      isDone && styles.cellPillTextDone,
                      setRepsIncreased && styles.cellPillTextProgression,
                    ]}>
                      {set.reps}{setRepsIncreased ? ' ↑' : ''}
                    </Text>
                  </Pressable>

                  {/* 1-Tap Checkmark Complete Button */}
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={isDone ? 'Set completed, tap to undo' : `Complete set ${index + 1}`}
                    onPress={() => handleToggleSet(index)}
                    style={styles.setColStatus}
                  >
                    {isDone ? (
                      <View style={styles.statusDoneBadge}>
                        <Ionicons name="checkmark" size={17} color="#0B0D0F" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.statusCurrentBadge}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.statusPendingBadge}>
                        <Ionicons name="checkmark" size={15} color="#4A5464" />
                      </View>
                    )}
                  </Pressable>
                </Pressable>
              );
            })}
          </View>

          {/* Add / Remove Set Row */}
          <View style={styles.tableFooterActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add set"
              hitSlop={8}
              onPress={() => {
                hapticLight();
                useWorkoutSessionStore.getState().addSet(session.currentExerciseIndex);
              }}
              style={({ pressed }) => [styles.tableAddSetBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="add" size={16} color="#D8DEE9" />
              <Text style={styles.tableAddSetText}>
                {language === 'uk' ? 'Додати підхід' : 'Add set'}
              </Text>
            </Pressable>

            {exercise.sets.length > 1 && !exercise.sets[exercise.sets.length - 1].completed && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove set"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  useWorkoutSessionStore.getState().removeSet(session.currentExerciseIndex);
                }}
                style={({ pressed }) => [styles.tableRemoveSetBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.tableRemoveSetText}>
                  {language === 'uk' ? 'Видалити' : 'Remove'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
{/* 5. Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          disabled={finishing || submittingSet}
          style={styles.completeBtn}
          onPress={finishSet}
        >
          {finishing
            ? t('savingWorkout')
            : isLastRemainingSet
            ? t('finishWorkout')
            : t('completeSet')}
        </Button>
      </View>

      {/* 6. Exercise Swap Modal */}
      {showSwapModal && (
      <Modal
        visible={showSwapModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSwapModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSwapModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('swapExercise')}</Text>
                <Text style={styles.modalSubtitle}>
                  {t('alternativesFor')} {tm(exercise.muscleGroup)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setShowSwapModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {(
                EXERCISE_ALTERNATIVES[exercise.muscleGroup] ??
                Object.values(EXERCISE_ALTERNATIVES).flat()
              ).map((alt) => {
                const isCurrent =
                  alt.name.toLowerCase() === exercise.name.toLowerCase();
                return (
                  <Pressable
                    key={alt.name}
                    accessibilityRole="button"
                    accessibilityLabel={alt.name}
                    onPress={() => {
                      if (!isCurrent) {
                        hapticMedium();
                        swapExercise(alt);
                      }
                      setShowSwapModal(false);
                    }}
                    style={[
                      styles.swapItem,
                      isCurrent && styles.swapItemCurrent,
                    ]}
                  >
                    <View style={styles.swapItemLeft}>
                      <View style={styles.swapItemThumbWrap}>
                        <Image
                          source={getExerciseImage(alt.name)}
                          style={styles.swapItemThumb}
                          resizeMode="cover"
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.swapItemName,
                            isCurrent && styles.swapItemNameCurrent,
                          ]}
                        >
                          {te(alt.name)}
                        </Text>
                        <Text style={styles.swapItemDetail}>
                          {tm(alt.muscleGroup)} • {t('base')} {formatWithUnit(alt.defaultWeight)}
                        </Text>
                      </View>
                    </View>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>{t('activeBadge')}</Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#4B5565"
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      )}

      {/* Exercise Detail Modal (Anatomy, Technique, Mistakes, Personal Best) */}
      {exercise && (
        <ExerciseDetailModal
          visible={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          exerciseName={exercise.name}
          muscleGroup={exercise.muscleGroup}
          customImageUri={exercise.customImageUri}
        />
      )}

      {/* Edit Set Modal (Direct Weight & Reps Keypad / Quick Delta Entry) */}
      {targetSetForEditing && (
        <EditSetModal
          visible={editingTarget !== null}
          exerciseName={te(targetExerciseForEditing?.name || '')}
          setNumber={(editingTarget?.setIndex ?? 0) + 1}
          totalSets={targetExerciseForEditing?.sets.length ?? 3}
          isCompleted={targetSetForEditing.completed}
          initialWeightKg={targetSetForEditing.weight}
          initialReps={targetSetForEditing.reps}
          initialRir={targetSetForEditing.rir}
          unitLabel={unitLabel}
          unit={unit}
          toKg={toKg}
          fromKg={fromKg}
          initialFocusField={editingTarget?.initialFocusField ?? 'weight'}
          onClose={() => setEditingTarget(null)}
          onSave={handleSaveEditedSet}
        />
      )}

      {/* How Progression Works Modal */}
      <ProgressionGuideModal
        visible={showProgressionModal}
        onClose={() => setShowProgressionModal(false)}
        language={language}
      />

      {/* Persistent Exercise Note Modal */}
      {exercise && (
        <ExerciseNoteModal
          visible={showNoteModal}
          exerciseName={te(exercise.name)}
          initialNote={currentNote}
          language={language}
          onClose={() => setShowNoteModal(false)}
          onSave={(newNote) => saveExerciseNote(exercise.name, newNote)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  exerciseCard: {
    backgroundColor: '#14181E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  exerciseThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0E1115',
    overflow: 'hidden',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseInfoCol: {
    flex: 1,
    gap: 2,
  },
  exerciseMuscleText: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '500',
  },
  exerciseNameText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1C222B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C222B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  targetChipText: {
    color: '#A0A8B4',
    fontSize: 12,
    fontWeight: '500',
  },
  noteFullBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1F27',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  noteFullBarText: {
    flex: 1,
    color: '#D8DEE9',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
  },
  addNoteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C222B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addNoteChipText: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '500',
  },
  safe: {
    flex: 1,
    backgroundColor: '#0E1114',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topWorkoutCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  topWorkoutName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  stopwatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E959F',
    fontVariant: ['tabular-nums'],
  },
  topPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E959F',
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C8FF3D',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 140,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  tableHeadSet: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6C7685',
    width: 28,
    textAlign: 'left',
  },
  tableHeadPrev: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6C7685',
    flex: 1,
    textAlign: 'center',
  },
  tableHeadWeight: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6C7685',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  tableHeadReps: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6C7685',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  tableHeadStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C7685',
    width: 44,
    textAlign: 'center',
  },
  setsList: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 12,
    minHeight: 46,
  },
  setRowActive: {
    backgroundColor: '#1A2029',
  },
  setRowDone: {
    backgroundColor: 'rgba(200, 255, 61, 0.04)',
  },
  setColNum: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C7685',
    width: 28,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  prevColWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirInlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7D8796',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  setColPrev: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C7685',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cellPill: {
    flex: 1,
    height: 36,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#1C222B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPillActive: {
    backgroundColor: '#252D3A',
  },
  cellPillDone: {
    backgroundColor: 'transparent',
  },
  cellPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#A0A8B4',
    fontVariant: ['tabular-nums'],
  },
  cellPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cellPillTextDone: {
    color: '#D8DEE9',
    fontWeight: '600',
  },
  cellPillTextProgression: {
    color: colors.primary,
    fontWeight: '700',
  },
  setColDoneText: {
    color: '#8E959F',
  },
  setColStatus: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusDoneBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCurrentBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#2A3342',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#1C222B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#0E1114',
    gap: 8,
  },
  completeBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#C8FF3D',
  },
  tableFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableAddSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 5,
  },
  tableAddSetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D8DEE9',
  },
  tableRemoveSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRemoveSetText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C7685',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#14181E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E9BAE',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C232E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  swapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A2029',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  swapItemCurrent: {
    backgroundColor: '#232B38',
  },
  swapItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  swapItemThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapItemThumb: {
    width: '100%',
    height: '100%',
  },
  swapItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swapItemNameCurrent: {
    color: colors.primary,
  },
  swapItemDetail: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E9BAE',
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: '#0B0D0F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  restTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14181E',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  restTimerCenterCol: {
    flex: 1,
    gap: 6,
  },
  restTimerNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  restAdjustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1C222B',
  },
  restAdjustText: {
    color: '#D8DEE9',
    fontSize: 12,
    fontWeight: '600',
  },
  restDigitsText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  restProgressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  restProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1.5,
  },
  restSkipBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  restSkipBtnText: {
    color: '#0B0D0F',
    fontSize: 12.5,
    fontWeight: '700',
  },
  cellTouchTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
