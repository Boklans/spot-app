import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';

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
  const completeCurrentSet = useWorkoutSessionStore((state) => state.completeCurrentSet);
  const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);
  const swapExercise = useWorkoutSessionStore((state) => state.swapExercise);
  const [finishing, setFinishing] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = session ? getSessionProgress(session) : { completedSets: 0, totalSets: 0, percentage: 0 };

  const exitWorkout = useCallback(() => {
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
    updateCurrentSet({ weight: Math.round(newKg * 100) / 100 });
  };

  const adjustActiveReps = (deltaReps: number) => {
    if (!activeSet) return;
    hapticLight();
    const currentR = activeSet.reps ?? 8;
    const newR = Math.max(1, Math.min(100, currentR + deltaReps));
    updateCurrentSet({ reps: newR });
  };

  const prevSetForActive = exercise?.previousSets?.[session.currentSetIndex] || exercise?.previousSets?.[0];
  const prevContextText = prevSetForActive
    ? `${prevSetForActive.weight ? formatWithUnit(prevSetForActive.weight) : t('bodyweight')} × ${prevSetForActive.reps}`
    : null;

  const finishSet = async () => {
    if (finishing) return;
    hapticMedium();
    completeCurrentSet();

    if (isFinalSet && isFinalExercise) {
      setFinishing(true);
      const completedSession = useWorkoutSessionStore.getState().session;
      try {
        if (completedSession) await finalizeWorkoutSession(completedSession);
        router.replace('/workout/complete');
      } catch {
        setFinishing(false);
        Alert.alert(
          t('couldNotSave'),
          t('couldNotSaveDesc')
        );
      }
    } else if ((exercise?.restSeconds ?? 90) > 0) {
      router.push('/workout/rest');
    } else {
      // 0s rest (Superset / Circuit): stay on screen and advance directly
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

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Exercise Header */}
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseThumbWrap}>
            <Image
              source={getExerciseImage(exercise.name, exercise.customImageUri)}
              style={styles.exerciseThumb}
              resizeMode="cover"
            />
          </View>
          <View style={styles.exerciseInfoCol}>
            <Text numberOfLines={2} style={styles.exerciseName}>{te(exercise.name)}</Text>
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
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            <Text style={styles.swapBtnText}>{t('swap')}</Text>
          </Pressable>
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
                <Ionicons name="flash" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.heroPrevContextText}>
                  {language === 'uk' ? 'Минуле' : 'Last'}: {prevContextText}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Steppers & Target Numbers Grid */}
          <View style={styles.heroControlsRow}>
            {/* Weight Stepper Control */}
            <View style={styles.heroControlBox}>
              <Text style={styles.heroControlLabel}>
                {t('weight')} ({unitLabel})
              </Text>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease weight 0.5kg"
                  hitSlop={8}
                  onPress={() => adjustActiveWeight(unit === 'lbs' ? -1 : -0.5)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="remove" size={20} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit weight"
                  hitSlop={6}
                  onPress={() => {
                    hapticLight();
                    router.push({
                      pathname: '/workout/input',
                      params: { setIndex: String(session.currentSetIndex) },
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
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* Reps Stepper Control */}
            <View style={styles.heroControlBox}>
              <Text style={styles.heroControlLabel}>{t('reps')}</Text>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease reps 1"
                  hitSlop={8}
                  onPress={() => adjustActiveReps(-1)}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                >
                  <Ionicons name="remove" size={20} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit reps"
                  hitSlop={6}
                  onPress={() => {
                    hapticLight();
                    router.push({
                      pathname: '/workout/input',
                      params: { setIndex: String(session.currentSetIndex) },
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
                  <Ionicons name="add" size={20} color="#FFFFFF" />
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
            <Text numberOfLines={1} style={styles.tableHeadReps}>{t('reps')}</Text>
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

              return (
                <Pressable
                  key={set.id || index}
                  onPress={() => {
                    hapticLight();
                    router.push({
                      pathname: '/workout/input',
                      params: { setIndex: String(index) },
                    });
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

                  <Text style={[styles.setColWeight, isCurrent && styles.textHighlight, isDone && styles.setColDoneText]}>
                    {weightDisplay}
                  </Text>

                  <Text style={[styles.setColReps, isCurrent && styles.textHighlight, isDone && styles.setColDoneText]}>
                    {set.reps}
                  </Text>

                  <Pressable
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={isDone ? 'Set completed' : isCurrent ? 'Complete current set' : 'Set pending'}
                    onPress={() => {
                      if (isCurrent) {
                        finishSet();
                      } else {
                        hapticLight();
                        router.push({
                          pathname: '/workout/input',
                          params: { setIndex: String(index) },
                        });
                      }
                    }}
                    style={styles.setColStatus}
                  >
                    {isDone ? (
                      <View style={styles.statusDoneBadge}>
                        <Ionicons name="checkmark" size={17} color="#0B0D0F" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.statusCurrentBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.primary} />
                      </View>
                    ) : (
                      <View style={styles.statusPendingBadge} />
                    )}
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* 5. Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          disabled={finishing}
          style={styles.completeBtn}
          onPress={finishSet}
        >
          {finishing
            ? t('savingWorkout')
            : isFinalSet && isFinalExercise
            ? t('finishWorkout')
            : t('completeSet')}
        </Button>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/workout/input')}
          style={({ pressed }) => [styles.adjustBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.adjustBtnText}>{t('adjustWeightReps')}</Text>
        </Pressable>
      </View>

      {/* 6. Exercise Swap Modal */}
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
    fontWeight: '800',
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
    fontWeight: '800',
    color: '#C8FF3D',
    fontVariant: ['tabular-nums'],
  },
  topPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C8FF3D',
    width: 44,
    textAlign: 'right',
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  exerciseThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  exerciseMuscle: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTargetCard: {
    backgroundColor: '#12161D',
    borderColor: 'rgba(200, 255, 61, 0.22)',
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
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
    fontSize: 12,
    fontWeight: '800',
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
  heroControlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroControlBox: {
    flex: 1,
    backgroundColor: '#171D26',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroControlLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  heroValueBtnPressed: {
    opacity: 0.7,
  },
  heroValueText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroValueSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E959F',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  card: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
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
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tableHeadSet: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 0.8,
    width: 32,
  },
  tableHeadPrev: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1.1,
    textAlign: 'center',
  },
  tableHeadWeight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  tableHeadReps: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  tableHeadStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 0.5,
    width: 58,
    textAlign: 'right',
  },
  setsList: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 48,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#8E959F',
    width: 32,
  },
  setColPrev: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C7787',
    flex: 1.1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setColWeight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8E959F',
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setColReps: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8E959F',
    flex: 1,
    textAlign: 'center',
  },
  setColDoneText: {
    textDecorationLine: 'line-through',
    color: '#5A687A',
  },
  setColStatus: {
    width: 58,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  textHighlight: {
    color: '#FFFFFF',
  },
  statusDoneBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  statusPendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2A323F',
    backgroundColor: '#12161D',
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
  adjustBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E959F',
    letterSpacing: 0.5,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '800',
    color: '#FFFFFF',
  },
  swapItemNameCurrent: {
    color: colors.primary,
  },
  swapItemDetail: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
