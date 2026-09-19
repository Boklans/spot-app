import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { ExerciseSelector } from '@/components/progress/ExerciseSelector';
import { MuscleProgress } from '@/components/progress/MuscleProgress';
import { StrengthCard } from '@/components/progress/StrengthCard';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import {
  calculateExerciseProgress,
  calculateMuscleProgress,
  calculateProgressSummary,
  formatVolume,
  getAvailableExercisesForProgress,
  type ProgressPeriod,
} from '@/lib/progressCalculator';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

export default function Progress() {
  const program = useProgramStore((state) => state.program);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const [period, setPeriod] = useState<ProgressPeriod>('30D');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    useProgramStore.getState().loadProgram();
  }, [loadHistory]);

  const availableExercises = getAvailableExercisesForProgress(program, history);

  const selectedExercise =
    availableExercises.find(
      (ex) =>
        ex.id === selectedExerciseId ||
        ex.name.toLowerCase() === selectedExerciseId?.toLowerCase()
    ) ??
    availableExercises[0] ??
    null;

  const summary = calculateProgressSummary(history, period);
  const strength = selectedExercise
    ? calculateExerciseProgress(history, selectedExercise, period)
    : null;
  const muscles = calculateMuscleProgress(history, period);
  const maxMuscleVolume = muscles[0]?.volume ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>OVERVIEW</Text>
          <Text style={styles.title}>Your progress</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/history/index')}
          style={styles.historyButton}
        >
          <Text style={styles.historyButtonText}>VIEW HISTORY</Text>
        </Pressable>
      </View>

      <View style={styles.periods}>
        {(['7D', '30D', 'ALL'] as ProgressPeriod[]).map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item}
            onPress={() => setPeriod(item)}
            style={[styles.period, period === item && styles.periodSelected]}
          >
            <Text
              style={[
                styles.periodText,
                period === item && styles.periodTextSelected,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stats}>
        <View style={styles.statRow}>
          <StatCard value={String(summary.workouts)} label="WORKOUTS" />
          <StatCard
            value={String(summary.trainingDays)}
            label="TRAINING DAYS"
            accent={colors.success}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard value={formatVolume(summary.volume)} label="TRAINING VOLUME" />
          <StatCard
            value={String(summary.personalRecords)}
            label="NEW PRs"
            accent={colors.purple}
          />
        </View>
      </View>

      {summary.workouts === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO TRAINING DATA YET</Text>
          <Text style={styles.emptyBody}>
            Complete your first workout to start tracking progress.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={styles.emptyAction}
          >
            <Text style={styles.emptyActionText}>START TRAINING</Text>
          </Pressable>
        </Card>
      ) : null}

      <Text style={styles.section}>STRENGTH</Text>

      {availableExercises.length > 0 && (
        <ExerciseSelector
          exercises={availableExercises}
          selectedExercise={selectedExercise}
          onSelect={(ex) => setSelectedExerciseId(ex.id)}
        />
      )}

      <StrengthCard progress={strength} exerciseName={selectedExercise?.name} />

      <Text style={styles.section}>MUSCLE PROGRESS</Text>
      {muscles.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>NO MUSCLE DATA YET</Text>
          <Text style={styles.emptyBody}>
            Complete a workout to see volume by muscle group.
          </Text>
        </Card>
      ) : (
        <Card>
          {muscles.map((item) => (
            <MuscleProgress key={item.name} {...item} maxVolume={maxMuscleVolume} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  historyButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  historyButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  periods: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  period: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  periodSelected: {
    backgroundColor: colors.primary,
  },
  periodText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  periodTextSelected: {
    color: colors.background,
  },
  stats: {
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    color: colors.secondary,
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: '800',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  emptyCard: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.secondary,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  emptyAction: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  emptyActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
