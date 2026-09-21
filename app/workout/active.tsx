import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

export default function Active() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { unitLabel, format, formatWithUnit } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const completeCurrentSet = useWorkoutSessionStore((state) => state.completeCurrentSet);
  const swapExercise = useWorkoutSessionStore((state) => state.swapExercise);
  const [finishing, setFinishing] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Button onPress={() => router.replace('/(tabs)')}>{t('backToHome')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const exercise = session.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session.currentSetIndex];
  const progress = getSessionProgress(session);
  const isFinalSet = session.currentSetIndex === (exercise?.sets.length ?? 0) - 1;
  const isFinalExercise = session.currentExerciseIndex === session.exercises.length - 1;

  const exitWorkout = () => router.replace('/(tabs)');

  const handleClose = () => {
    if (progress.completedSets === 0) {
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
  };

  const finishSet = async () => {
    if (finishing) return;
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
    } else {
      hapticMedium();
      router.push('/workout/rest');
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

        <Text style={styles.topWorkoutName}>{tw(session.workoutName)}</Text>

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
              source={getExerciseImage(exercise.name)}
              style={styles.exerciseThumb}
              resizeMode="cover"
            />
          </View>
          <View style={styles.exerciseInfoCol}>
            <Text style={styles.exerciseName}>{te(exercise.name)}</Text>
            <Text style={styles.exerciseMuscle}>{tm(exercise.muscleGroup)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap exercise"
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

        {/* 3. Last Workout Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('lastWorkout')}</Text>
          {exercise.previousSets && exercise.previousSets.length > 0 ? (
            <View style={styles.previousList}>
              {exercise.previousSets.map((prevSet, idx) => {
                const weightText = prevSet.weight
                  ? formatWithUnit(prevSet.weight)
                  : t('bodyweight');
                return (
                  <Text key={idx} style={styles.previousItemText}>
                    • {weightText} × {prevSet.reps}
                  </Text>
                );
              })}
            </View>
          ) : (
            <Text style={styles.previousEmptyText}>{t('noPreviousData')}</Text>
          )}
        </View>

        {/* 4. Today Section Card */}
        <View style={styles.card}>
          <View style={styles.todayHeaderRow}>
            <Text style={styles.todayLabel}>{t('today')}</Text>
            <View style={styles.targetWeightWrap}>
              <Text style={styles.targetWeightNum}>
                {activeSet?.weight ? format(activeSet.weight) : t('bodyweight')}
              </Text>
              {activeSet?.weight ? <Text style={styles.targetWeightUnit}>{unitLabel}</Text> : null}
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeadText}>{t('set')}</Text>
            <Text style={styles.tableHeadTextCenter}>{t('reps')}</Text>
            <Text style={styles.tableHeadTextRight}>{t('status')}</Text>
          </View>

          {/* Sets Rows */}
          <View style={styles.setsList}>
            {exercise.sets.map((set, index) => {
              const isCurrent = index === session.currentSetIndex;
              const isDone = set.completed;

              return (
                <Pressable
                  key={set.id || index}
                  onPress={() => router.push('/workout/input')}
                  style={({ pressed }) => [
                    styles.setRow,
                    isCurrent && styles.setRowActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.setColNum, isCurrent && styles.textHighlight]}>
                    {index + 1}
                  </Text>

                  <Text style={[styles.setColReps, isCurrent && styles.textHighlight]}>
                    {set.reps}
                  </Text>

                  <View style={styles.setColStatus}>
                    {isDone ? (
                      <View style={styles.statusDoneBadge}>
                        <Ionicons name="checkmark" size={15} color="#0B0D0F" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.statusCurrentBadge}>
                        <View style={styles.statusCurrentDot} />
                      </View>
                    ) : (
                      <View style={styles.statusPendingBadge} />
                    )}
                  </View>
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
  topWorkoutName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
    marginBottom: 20,
  },
  exerciseThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
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
    letterSpacing: -0.3,
  },
  exerciseMuscle: {
    fontSize: 14,
    color: '#8E959F',
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  previousList: {
    gap: 4,
  },
  previousItemText: {
    fontSize: 14,
    color: '#8E959F',
    fontWeight: '500',
    lineHeight: 20,
  },
  previousEmptyText: {
    fontSize: 14,
    color: '#717B8A',
    fontStyle: 'italic',
  },
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  todayLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  targetWeightWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  targetWeightNum: {
    fontSize: 28,
    fontWeight: '900',
    color: '#C8FF3D',
    letterSpacing: -0.5,
  },
  targetWeightUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8E959F',
    letterSpacing: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tableHeadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1,
    width: 44,
  },
  tableHeadTextCenter: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  tableHeadTextRight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1,
    width: 60,
    textAlign: 'right',
  },
  setsList: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  setRowActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.07)',
  },
  setColNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8E959F',
    width: 44,
  },
  setColReps: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  setColStatus: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  textHighlight: {
    color: '#FFFFFF',
  },
  statusDoneBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCurrentBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
  },
  statusCurrentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C8FF3D',
  },
  statusPendingBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#242B35',
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
