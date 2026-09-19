import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RecoveryCard } from '@/components/home/RecoveryCard';
import { SmartInsightBanner } from '@/components/home/SmartInsightBanner';
import { WeeklyReviewCard } from '@/components/home/WeeklyReviewCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { hapticLight } from '@/lib/haptics';
import { countWorkoutsThisWeek } from '@/lib/progressCalculator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { getWorkoutInsight } from '@/lib/suggestionEngine';
import { generateWeeklyReview } from '@/lib/weeklyReviewEngine';
import { formatWeight } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Home() {
  const [name, setName] = useState(defaultOnboarding.name);
  const program = useProgramStore((state) => state.program);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const progress = useProgramProgressStore((state) => state.progress);
  const dismissWeeklyReview = useProgramProgressStore((state) => state.dismissWeeklyReview);
  const history = useWorkoutHistoryStore((state) => state.workouts);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
    });
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
  }, []);

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const workout = getScheduledWorkout(program, progress);
  const workoutIndex = Math.max(0, program.workouts.findIndex((w) => w.id === workout.id));
  const recommendedExercise = workout.exercises[0];
  const resumeWorkout = () =>
    router.replace(restEndsAt !== null ? '/workout/rest' : '/workout/active');

  const completedThisWeek = countWorkoutsThisWeek(history);
  const targetWorkouts = Math.max(1, program.daysPerWeek);
  const weeklyPercent = Math.min(100, Math.round((completedThisWeek / targetWorkouts) * 100));
  const recoveryData = calculateMuscleRecovery(history);
  const insight = getWorkoutInsight(workout, recoveryData);
  const weeklyReview = generateWeeklyReview(history);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good evening, {name}</Text>
          <Text style={styles.sub}>{todayFormatted}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      {weeklyReview && weeklyReview.weekKey !== progress?.lastDismissedReviewWeek && (
        <WeeklyReviewCard
          review={weeklyReview}
          onDismiss={() => {
            hapticLight();
            dismissWeeklyReview(weeklyReview.weekKey);
          }}
        />
      )}

      {activeSession && !activeSession.completed && (
        <Card style={styles.resume}>
          <View>
            <Text style={styles.resumeLabel}>ACTIVE WORKOUT</Text>
            <Text style={styles.resumeTitle}>{activeSession.workoutName}</Text>
            <Text style={styles.resumeMeta}>
              Exercise {activeSession.currentExerciseIndex + 1} of {activeSession.exercises.length}
            </Text>
          </View>
          <Button onPress={resumeWorkout}>RESUME</Button>
        </Card>
      )}

      <RecoveryCard recoveryData={recoveryData} />

      {insight && <SmartInsightBanner insight={insight} />}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>TODAY'S WORKOUT</Text>
        <Text style={styles.count}>
          {String(workoutIndex + 1).padStart(2, '0')} / {String(program.workouts.length).padStart(2, '0')}
        </Text>
      </View>

      <Card style={styles.workout}>
        <View style={styles.workoutTop}>
          <View>
            <Text style={styles.workoutName}>{workout.name}</Text>
            <Text style={styles.focus}>{workout.muscleGroups.join(' • ')}</Text>
          </View>
          <Text style={styles.play}>▶</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.detail}>{workout.exercises.length} exercises</Text>
          <Text style={styles.detail}>~{workout.estimatedMinutes} min</Text>
        </View>
        <Button
          onPress={() =>
            router.push({ pathname: '/workout/preview', params: { workoutId: workout.id } })
          }
        >
          START WORKOUT
        </Button>
      </Card>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>THIS WEEK</Text>
        <Text style={styles.count}>
          {completedThisWeek} / {targetWorkouts} WORKOUTS
        </Text>
      </View>
      <ProgressBar value={weeklyPercent} />

      {recommendedExercise && (
        <Card style={styles.insight}>
          <Text style={styles.insightLabel}>SPOT INSIGHT</Text>
          <Text style={styles.insightTitle}>
            {recommendedExercise.name} is ready for{' '}
            {recommendedExercise.recommendedWeight
              ? `${formatWeight(recommendedExercise.recommendedWeight)} kg`
              : 'bodyweight'}
            .
          </Text>
          <Text style={styles.insightBody}>Based on your current generated plan.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  sub: {
    color: colors.secondary,
    marginTop: 5,
  },
  avatar: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 18,
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    backgroundColor: colors.primaryMuted,
  },
  resumeLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  resumeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 5,
  },
  resumeMeta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  section: {
    color: colors.secondary,
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: '800',
  },
  count: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  workout: {
    marginBottom: spacing.xl,
  },
  workoutTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  workoutName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  focus: {
    color: colors.secondary,
    marginTop: 6,
  },
  play: {
    color: colors.primary,
    fontSize: 22,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  detail: {
    color: colors.secondary,
    fontSize: 13,
  },
  insight: {
    borderColor: '#3A2C75',
    marginTop: spacing.lg,
    backgroundColor: '#181622',
  },
  insightLabel: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  insightTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  insightBody: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});
