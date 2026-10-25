import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
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
import { cancelRestTimerNotification, scheduleRestTimerNotification } from '@/lib/notificationService';
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

  const [now, setNow] = useState(Date.now());
  const [isHydrating, setIsHydrating] = useState(!session);

  const restRemainingSeconds = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const isResting = restEndsAt !== null && restRemainingSeconds > 0;

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
    Alert.alert(
      language === 'uk' ? 'Перервати тренування?' : 'Interrupt Workout?',
      language === 'uk'
        ? 'Ви можете зберегти виконані підходи в історію або вийти на головну і продовжити пізніше.'
        : 'You can save completed sets to history, or pause and resume later from the home screen.',
      [
        { text: language === 'uk' ? 'Продовжити тренування' : 'Keep Training', style: 'cancel' },
        {
          text: language === 'uk' ? 'Пауза (на головну)' : 'Pause & Exit',
          onPress: exitWorkout,
        },
        {
          text: language === 'uk' ? 'Завершити та зберегти' : 'Finish & Save',
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
  }, [session, progress.completedSets, language, exitWorkout]);

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
  const isFinalSet = session.currentSetIndex === (exercise?.sets.length ?? 0) - 1;
  const isFinalExercise = session.currentExerciseIndex === session.exercises.length - 1;

  const adjustActiveWeight = (deltaDisplay: number) => {
    if (!activeSet) return;
    hapticLight();
    const currentDisplay = fromKg(activeSet.weight ?? 0);
    const newDisplay = Math.max(0, Math.round((currentDisplay + deltaDisplay) * 10) / 10);
    const newKg = toKg(newDisplay);
    updateCurrentSet({ weight: Math.round(newKg * 100) / 100 }, true);
  };

  const adjustActiveReps = (deltaReps: number) => {
    if (!activeSet) return;
    hapticLight();
    const currentR = activeSet.reps ?? 8;
    const newR = Math.max(1, Math.min(100, currentR + deltaReps));
    updateCurrentSet({ reps: newR }, true);
  };

  const handleSaveEditedSet = ({ weight, reps }: { weight: number; reps: number }) => {
    if (!editingTarget || !session) return;
    const { exerciseIndex, setIndex } = editingTarget;
    const editedSet = session.exercises[exerciseIndex]?.sets[setIndex];
    const shouldPropagate =
      exerciseIndex === session.currentExerciseIndex &&
      setIndex === session.currentSetIndex &&
      Boolean(editedSet && !editedSet.completed);
    useWorkoutSessionStore.getState().updateSet(exerciseIndex, setIndex, { weight, reps }, shouldPropagate);
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

  const finishSet = async () => {
    if (isSubmittingSetRef.current || finishing || submittingSet) return;
    isSubmittingSetRef.current = true;
    setSubmittingSet(true);

    try {
      hapticMedium();
      completeCurrentSet();

      const latestSession = useWorkoutSessionStore.getState().session;
      const isCompleted = latestSession?.completed || (isFinalSet && isFinalExercise);

      if (isCompleted) {
        setFinishing(true);
        if (latestSession) await finalizeWorkoutSession(latestSession);
        router.replace('/workout/complete');
      } else {
        // Rest view (<Rest embedded />) or 0s Superset renders in-place without native screen replacement
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
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>

        <View style={styles.topWorkoutCenter}>
          <Text numberOfLines={1} style={styles.topWorkoutName}>{tw(session.workoutName)}</Text>
          <View style={styles.stopwatchPill}>
            <Ionicons name="timer-outline" size={12} color={colors.primary} />
            <Text style={styles.stopwatchText}>{formatElapsed(elapsedSeconds)}</Text>
          </View>
        </View>

        <Text style={styles.topPercent}>{percent}%</Text>
      </View>

      {/* Progress Line */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
      </View>

      {/* Non-blocking Compact Rest Banner */}
      {isResting && (
        <View style={styles.compactRestBanner}>
          <View style={styles.compactRestLeft}>
            <View style={styles.compactRestPulseDot} />
            <View>
              <Text style={styles.compactRestLabel}>
                {language === 'uk' ? 'ВІДПОЧИНОК' : 'REST TIMER'}
              </Text>
              <Text style={styles.compactRestTime}>
                {formatElapsed(restRemainingSeconds)}
              </Text>
            </View>
          </View>
          <View style={styles.compactRestActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Subtract 15 seconds"
              hitSlop={6}
              onPress={() => {
                hapticLight();
                addRestTime(-15);
              }}
              style={styles.compactRestChip}
            >
              <Text style={styles.compactRestChipText}>-15s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add 30 seconds"
              hitSlop={6}
              onPress={() => {
                hapticLight();
                addRestTime(30);
              }}
              style={styles.compactRestChip}
            >
              <Text style={styles.compactRestChipText}>+30s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip rest"
              hitSlop={6}
              onPress={() => {
                hapticMedium();
                cancelRestTimerNotification();
                skipRest();
              }}
              style={styles.compactRestSkipBtn}
            >
              <Text style={styles.compactRestSkipText}>
                {language === 'uk' ? 'Пропустити' : 'Skip'}
              </Text>
              <Ionicons name="play-forward" size={11} color="#0B0D0F" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Interactive Exercise Guide Card */}
        <View style={styles.exerciseHeader}>
          {/* Large Exercise Preview with Interactive Guide Trigger */}
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

          {/* Details & Actions */}
          <View style={styles.exerciseInfoCol}>
            <View style={styles.exerciseTopRow}>
              <View style={styles.exerciseMusclePill}>
                <Text style={styles.exerciseMuscle}>{tm(exercise.muscleGroup)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap exercise"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  setShowSwapModal(true);
                }}
                style={({ pressed }) => [
                  styles.swapBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
                <Text style={styles.swapBtnText}>{t('swap')}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                hapticLight();
                setShowDetailModal(true);
              }}
            >
              <Text numberOfLines={2} style={styles.exerciseName}>{te(exercise.name)}</Text>
            </Pressable>

            <View style={styles.guideAndNoteRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View technique and form instructions"
                onPress={() => {
                  hapticLight();
                  setShowDetailModal(true);
                }}
                style={({ pressed }) => [
                  styles.guideActionBtn,
                  { flex: 1 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="fitness-outline" size={13} color={colors.primary} />
                <Text numberOfLines={1} style={styles.guideActionText}>
                  {language === 'uk' ? 'Техніка виконання' : 'Technique & Form'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add or edit exercise note"
                onPress={() => {
                  hapticLight();
                  setShowNoteModal(true);
                }}
                style={({ pressed }) => [
                  styles.noteActionBtn,
                  currentNote ? styles.noteActionBtnActive : null,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons
                  name={currentNote ? 'bookmark' : 'create-outline'}
                  size={13}
                  color={currentNote ? colors.primary : '#94A3B8'}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.noteActionText,
                    currentNote ? { color: colors.primary } : null,
                  ]}
                >
                  {language === 'uk' ? 'Нотатка' : 'Note'}
                </Text>
              </Pressable>
            </View>

            {currentNote ? (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setShowNoteModal(true);
                }}
                style={styles.savedNotePill}
              >
                <Ionicons name="pin" size={12} color={colors.primary} />
                <Text numberOfLines={2} style={styles.savedNoteText}>
                  {currentNote}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 3. Hero Active Set Target & Zero-Friction Adjustments Card */}
        <View style={styles.heroTargetCard}>
          <View style={styles.heroTargetTopRow}>
            <View style={styles.setKickerBadge}>
              <View style={styles.setKickerDot} />
              <Text style={styles.setKickerText}>
                {t('set')} {session.currentSetIndex + 1} {t('of')} {exercise.sets.length}
              </Text>
            </View>

            {prevContextText ? (
              <View style={styles.heroPrevContextPill}>
                <Ionicons name="time-outline" size={13} color="#9BA1A6" style={{ marginRight: 4 }} />
                <Text style={styles.heroPrevContextText}>
                  {language === 'uk' ? 'Минулого разу' : 'Last time'}: {prevContextText}
                </Text>
              </View>
            ) : (
              <View style={styles.heroBaselinePill}>
                <Ionicons name="sparkles" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.heroBaselineText}>
                  {language === 'uk' ? 'Стартова вага' : 'Starting weight'}
                </Text>
              </View>
            )}
          </View>

          {/* Progressive Overload & Novice-Friendly Recommendation Block */}
          <View
            style={[
              styles.progressionCoachCard,
              isProgressed && styles.progressionCoachCardActive,
            ]}
          >
            <View style={styles.progressionCoachTopRow}>
              {isProgressed ? (
                <View style={styles.overloadPill}>
                  <Ionicons name="trending-up" size={12} color="#0B0D0F" />
                  <Text style={styles.overloadPillText}>
                    {hasWeightIncrease
                      ? `${weightDeltaDisplay > 0 ? '+' : ''}${weightDeltaDisplay} ${unitLabel}`
                      : `+${repsDelta} ${language === 'uk' ? 'повт' : 'reps'}`}
                  </Text>
                </View>
              ) : (
                <Ionicons
                  name={
                    isManuallyAdjusted
                      ? 'options-outline'
                      : exercise.recommendation?.recommendationReason === 'reduce'
                      ? 'shield-checkmark-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={15}
                  color={colors.primary}
                />
              )}

              <Text style={styles.progressionTargetSummary}>
                {language === 'uk' ? 'Сьогодні ціль: ' : 'Today’s goal: '}
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                  {currentWeight ? formatWithUnit(currentWeight) : t('bodyweight')} × {currentReps}{' '}
                  {language === 'uk' ? 'повт' : 'reps'}
                </Text>
              </Text>
            </View>

            <View style={styles.progressionCoachBottomRow}>
              <Text numberOfLines={2} style={styles.progressionSubExplanation}>
                {isManuallyAdjusted
                  ? (language === 'uk'
                      ? `Власна ціль: ${formatWithUnit(currentWeight)} × ${currentReps} повт (рекомендація: ${formatWithUnit(recWeight)} × ${recReps} повт)`
                      : `Custom target: ${formatWithUnit(currentWeight)} × ${currentReps} reps (recommended: ${formatWithUnit(recWeight)} × ${recReps} reps)`)
                  : nextUnlockHint}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How progression works"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  setShowProgressionModal(true);
                }}
                style={styles.howProgressionBtn}
              >
                <Ionicons name="help-circle-outline" size={13} color={colors.primary} />
                <Text style={styles.howProgressionBtnText}>
                  {language === 'uk' ? 'Як працює?' : 'How it works'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Steppers & Target Numbers Grid */}
          <View style={styles.heroControlsRow}>
            {/* Weight Stepper Control */}
            <View style={styles.heroControlBox}>
              <View style={styles.heroControlLabelRow}>
                <Text style={styles.heroControlLabel} numberOfLines={1}>
                  {isAssisted
                    ? (language === 'uk' ? `ПРОТИВАГА (${unitLabel})` : `ASSIST (${unitLabel})`)
                    : currentEquip === 'dumbbells'
                    ? `${t('weight')} (${unitLabel}) · ${language === 'uk' ? '1 ГАНТ.' : '1 DB'}`
                    : `${t('weight')} (${unitLabel})`}
                </Text>
                {hasWeightIncrease && (
                  <View style={styles.deltaMicroBadge}>
                    <Text style={styles.deltaMicroText}>
                      {weightDeltaDisplay > 0 ? `+${weightDeltaDisplay}` : `${weightDeltaDisplay}`}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease weight 0.5kg"
                  hitSlop={8}
                  onPress={() => adjustActiveWeight(unit === 'lbs' ? -1 : -0.5)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="remove" size={18} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit active set weight"
                  hitSlop={8}
                  onPress={() => {
                    hapticLight();
                    setEditingTarget({
                      exerciseIndex: session.currentExerciseIndex,
                      setIndex: session.currentSetIndex,
                      initialFocusField: 'weight',
                    });
                  }}
                  style={({ pressed }) => [styles.heroValueBtn, pressed && styles.heroValueBtnPressed]}
                >
                  <Text style={styles.heroValueText}>
                    {activeSet?.weight ? format(activeSet.weight) : (language === 'uk' ? 'ВТ' : 'BW')}
                  </Text>
                  {activeSet?.weight ? <Text style={styles.heroValueSub}>{unitLabel}</Text> : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase weight 0.5kg"
                  hitSlop={8}
                  onPress={() => adjustActiveWeight(unit === 'lbs' ? 1 : 0.5)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* Reps Stepper Control */}
            <View style={styles.heroControlBox}>
              <View style={styles.heroControlLabelRow}>
                <Text style={styles.heroControlLabel}>{t('reps')}</Text>
                {hasRepsIncrease && (
                  <View style={styles.deltaMicroBadge}>
                    <Text style={styles.deltaMicroText}>+{repsDelta}</Text>
                  </View>
                )}
              </View>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease reps 1"
                  hitSlop={8}
                  onPress={() => adjustActiveReps(-1)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="remove" size={18} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit active set reps"
                  hitSlop={8}
                  onPress={() => {
                    hapticLight();
                    setEditingTarget({
                      exerciseIndex: session.currentExerciseIndex,
                      setIndex: session.currentSetIndex,
                      initialFocusField: 'reps',
                    });
                  }}
                  style={({ pressed }) => [styles.heroValueBtn, pressed && styles.heroValueBtnPressed]}
                >
                  <Text style={styles.heroValueText}>{activeSet?.reps ?? 8}</Text>
                  <Text style={styles.heroValueSub}>{language === 'uk' ? 'повт' : 'reps'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase reps 1"
                  hitSlop={8}
                  onPress={() => adjustActiveReps(1)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Sets Table Card with Visual Completion Feedback */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <Text numberOfLines={1} style={styles.tableHeadSet}>{t('set')}</Text>
            <Text numberOfLines={1} style={styles.tableHeadPrev}>{language === 'uk' ? 'МИНУЛЕ' : 'PREV'}</Text>
            <Text numberOfLines={1} style={styles.tableHeadWeight}>{unitLabel}</Text>
            <Text numberOfLines={1} style={styles.tableHeadReps}>{language === 'uk' ? 'ПОВТ.' : t('reps')}</Text>
            <Text numberOfLines={1} style={styles.tableHeadStatus}>{t('status')}</Text>
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
                    if (isDone) {
                      hapticLight();
                      setEditingTarget({
                        exerciseIndex: session.currentExerciseIndex,
                        setIndex: index,
                        initialFocusField: 'weight',
                      });
                    } else if (!isCurrent) {
                      hapticLight();
                      useWorkoutSessionStore.getState().setCurrentSetIndex(index);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.setRow,
                    isCurrent && styles.setRowActive,
                    isDone && styles.setRowDone,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.setColNum, isCurrent && styles.textHighlight, isDone && styles.setColDoneText]}>
                    {index + 1}
                  </Text>

                  <Text style={[styles.setColPrev, isDone && styles.setColDoneText]}>
                    {prevSetText}
                  </Text>

                  {/* Direct Editable Weight */}
                  <Pressable
                    hitSlop={6}
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
                    style={styles.cellTouchTarget}
                  >
                    <Text style={[styles.setColWeight, isCurrent && styles.textHighlight, isDone && styles.setColDoneText, setWeightIncreased && styles.textProgressionHighlight]}>
                      {weightDisplay}{setWeightIncreased ? ' ↑' : ''}
                    </Text>
                  </Pressable>

                  {/* Direct Editable Reps */}
                  <Pressable
                    hitSlop={6}
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
                    style={styles.cellTouchTarget}
                  >
                    <Text style={[styles.setColReps, isCurrent && styles.textHighlight, isDone && styles.setColDoneText, setRepsIncreased && styles.textProgressionHighlight]}>
                      {set.reps}{setRepsIncreased ? ' ↑' : ''}
                    </Text>
                  </Pressable>

                  <Pressable
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={isDone ? 'Set completed, tap to edit' : isCurrent ? 'Complete current set' : 'Set pending'}
                    onPress={() => {
                      if (isCurrent) {
                        finishSet();
                      } else if (isDone) {
                        hapticLight();
                        setEditingTarget({
                          exerciseIndex: session.currentExerciseIndex,
                          setIndex: index,
                          initialFocusField: 'weight',
                        });
                      } else {
                        hapticLight();
                        useWorkoutSessionStore.getState().setCurrentSetIndex(index);
                      }
                    }}
                    style={styles.setColStatus}
                  >
                    {isDone ? (
                      <View style={styles.statusDoneBadge}>
                        <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.statusCurrentBadge} />
                    ) : (
                      <View style={styles.statusPendingBadge} />
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
              <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
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
                <Ionicons name="remove-circle-outline" size={17} color="#8E99A8" />
                <Text style={styles.tableRemoveSetText}>
                  {language === 'uk' ? 'Видалити підхід' : 'Remove set'}
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
            : isFinalSet && isFinalExercise
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
    gap: 3,
  },
  topWorkoutName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  stopwatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.2)',
  },
  stopwatchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C8FF3D',
    fontVariant: ['tabular-nums'],
  },
  topPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C8FF3D',
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  exerciseHeader: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  exerciseThumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbOverlayTag: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbOverlayText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0B0D0F',
    letterSpacing: 0.4,
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseInfoCol: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 96,
    paddingVertical: 2,
  },
  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseMusclePill: {
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  exerciseMuscle: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginVertical: 4,
  },
  guideActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 2,
  },
  guideActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  heroTargetCard: {
    backgroundColor: '#12161D',
    borderColor: 'rgba(200, 255, 61, 0.22)',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTargetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  setKickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  setKickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  setKickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  heroPrevContextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181E27',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroPrevContextText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0BAC7',
  },
  heroBaselinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181E27',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  heroBaselineText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  overloadHighlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    gap: 8,
  },
  guideAndNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#171C24',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  noteActionBtnActive: {
    backgroundColor: 'rgba(182, 240, 0, 0.1)',
    borderColor: 'rgba(182, 240, 0, 0.35)',
  },
  noteActionText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  savedNotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    backgroundColor: 'rgba(182, 240, 0, 0.07)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(182, 240, 0, 0.2)',
  },
  savedNoteText: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    flex: 1,
  },
  progressionCoachCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  progressionCoachCardActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.09)',
    borderColor: 'rgba(200, 255, 61, 0.28)',
  },
  progressionCoachTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  progressionCoachBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressionTargetSummary: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  howProgressionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(182, 240, 0, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(182, 240, 0, 0.28)',
    flexShrink: 0,
  },
  howProgressionBtnText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  progressionSubExplanation: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    color: '#94A3B8',
  },
  overloadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  overloadPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.2,
  },
  overloadSubText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#D8FF70',
  },
  matchedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  matchedSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E99A8',
  },
  heroControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroControlBox: {
    flex: 1,
    backgroundColor: '#171D26',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroControlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroControlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  deltaMicroBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.4)',
  },
  deltaMicroText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#202836',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepperBtnPressed: {
    backgroundColor: '#2A3547',
    borderColor: colors.primary,
  },
  heroValueBtn: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  heroValueBtnPressed: {
    opacity: 0.7,
  },
  heroValueText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroValueSub: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: '#8E959F',
    letterSpacing: 0.3,
    marginTop: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  tableHeadSet: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717B8A',
    letterSpacing: 0.8,
    width: 28,
    textAlign: 'left',
  },
  tableHeadPrev: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1.2,
    textAlign: 'center',
  },
  tableHeadWeight: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  tableHeadReps: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  tableHeadStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: '#717B8A',
    letterSpacing: 0.5,
    width: 52,
    textAlign: 'center',
  },
  setsList: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
  },
  setRowActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderColor: colors.primary,
  },
  setRowDone: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.65,
  },
  setColNum: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E959F',
    width: 28,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  setColPrev: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C7787',
    flex: 1.2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setColWeight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E959F',
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setColReps: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E959F',
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setColDoneText: {
    color: '#94A3B8',
  },
  setColStatus: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textHighlight: {
    color: '#FFFFFF',
  },
  textProgressionHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  statusDoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  statusCurrentBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  statusPendingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A323F',
    backgroundColor: '#12161D',
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
    gap: 8,
  },
  completeBtn: {
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
  tableFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableAddSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
  },
  tableAddSetText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  tableRemoveSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
  },
  tableRemoveSetText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E99A8',
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
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#263140',
  },
  swapBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#12161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#242C38',
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
    borderBottomColor: '#1A212C',
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
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#202834',
    padding: 14,
    marginBottom: 10,
  },
  swapItemCurrent: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
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
    borderWidth: 1,
    borderColor: '#202834',
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
  compactRestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactRestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactRestPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  compactRestLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8E99A8',
    letterSpacing: 0.6,
  },
  compactRestTime: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  compactRestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactRestChip: {
    backgroundColor: '#1E2530',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  compactRestChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactRestSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactRestSkipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B0D0F',
  },
  cellTouchTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
