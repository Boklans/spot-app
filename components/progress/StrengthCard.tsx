import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { Card } from '../ui/Card';
import { spacing } from '@/constants/spacing';
import type { StrengthProgress } from '@/lib/progressCalculator';

type StrengthCardProps = {
  progress: StrengthProgress;
  exerciseName?: string;
};

export function StrengthCard({ progress, exerciseName }: StrengthCardProps) {
  const displayName = (exerciseName ?? progress?.exerciseName ?? 'Exercise').toUpperCase();

  if (!progress) {
    return (
      <Card>
        <Text style={styles.emptyTitle}>NOT ENOUGH DATA YET</Text>
        <Text style={styles.emptyBody}>
          Complete a few {displayName} workouts to see your strength trend.
        </Text>
      </Card>
    );
  }

  const metricLabel = progress.metricType === '1RM' ? 'EST. 1RM' : 'MAX REPS';
  const unitLabel = (progress.unit ?? 'kg').toUpperCase();
  const values = progress.trend.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);

  const bestSetText =
    progress.metricType === '1RM'
      ? `BEST SET ${progress.latestBestSet.weight} kg × ${progress.latestBestSet.reps}`
      : `BEST SET ${progress.latestBestSet.reps} reps`;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.label}>{`${displayName} ${metricLabel}`}</Text>
          <Text style={styles.value}>
            {progress.bestValue} <Text style={styles.unit}>{unitLabel}</Text>
          </Text>
        </View>
        <Text style={styles.delta}>{bestSetText}</Text>
      </View>
      <View style={styles.chart}>
        {progress.trend.map((point) => (
          <View
            key={point.date}
            style={[styles.point, { height: 24 + ((point.value - minimum) / range) * 76 }]}
          />
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{progress.trend.length} WORKOUTS</Text>
        <Text style={styles.axisText}>TODAY</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  label: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  value: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  unit: {
    color: colors.secondary,
    fontSize: 12,
  },
  delta: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  chart: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  point: {
    flex: 1,
    maxWidth: 12,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  axisText: {
    color: colors.muted,
    fontSize: 10,
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
});
