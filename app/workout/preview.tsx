import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  Image,
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
import { useI18n } from '@/lib/i18n';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

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

  useEffect(() => {
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
  }, []);

  const selectedId = typeof workoutId === 'string' ? workoutId : undefined;
  const scheduledWorkout = getScheduledWorkout(program, progress);
  const workout =
    program?.workouts?.find((item) => item.id === selectedId) ?? scheduledWorkout;

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
          accessibilityLabel="More options"
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="reorder-three-outline" size={28} color="#8E959F" />
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
              </View>
            );
          })}
        </View>
      </ScrollView>

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
});
