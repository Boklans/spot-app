import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useI18n } from '@/lib/i18n';
import { formatVolume } from '@/lib/progressCalculator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

export default function HistoryDetail() {
  const { t, tm, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const workout = workouts.find((item) => item.id === id);

  if (!workout) {
    return (
      <Screen>
        <Text style={styles.empty}>{t('workoutNotFound')}</Text>
        <Button onPress={() => (router.canGoBack() ? router.back() : router.replace('/history'))}>
          {t('backToHistory')}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/history'))}
        style={styles.backButton}
      >
        <Text style={styles.back}>‹  {t('tabHistory').toUpperCase()}</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>{tw(workout.workoutName)}</Text>
        <Text style={styles.date}>
          {new Date(workout.completedAt).toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US')}
        </Text>
      </View>

      <View style={styles.summary}>
        <Card style={styles.summaryCard}>
          <Text style={styles.value}>
            {Math.max(1, Math.round(workout.durationSeconds / 60))} {t('min')}
          </Text>
          <Text style={styles.label}>{t('duration').toUpperCase()}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.value}>{workout.totalSets}</Text>
          <Text style={styles.label}>{t('sets').toUpperCase()}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.value}>{formatVolume(workout.totalVolume)}</Text>
          <Text style={styles.label}>{t('volume').toUpperCase()}</Text>
        </Card>
      </View>

      <Card style={styles.prs}>
        <Text style={styles.section}>{t('personalRecords')}</Text>
        {workout.personalRecords.length === 0 ? (
          <Text style={styles.muted}>{t('baselineSaved')}</Text>
        ) : (
          workout.personalRecords.map((record) => (
            <View key={record.id} style={styles.prRow}>
              <Text style={styles.exerciseName}>{te(record.exerciseName)}</Text>
              <Text style={styles.prValue}>
                {record.type === 'weight' ? t('weight') : t('estimated1RM')}  {record.label}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Text style={styles.section}>{t('exercises').toUpperCase()}</Text>
      {workout.exercises.map((exercise) => (
        <Card key={exercise.exerciseId} style={styles.exercise}>
          <Text style={styles.exerciseName}>{te(exercise.exerciseName)}</Text>
          <Text style={styles.muscle}>{tm(exercise.muscleGroup)}</Text>
          {exercise.sets.map((set, index) => (
            <View key={`${exercise.exerciseId}-${set.completedAt}-${index}`} style={styles.set}>
              <Text style={styles.setLabel}>
                {t('set')} {index + 1}
              </Text>
              <Text style={styles.setValue}>
                {set.weight ? formatWithUnit(set.weight) : t('bodyweight')} × {set.reps}
              </Text>
              <Text style={styles.setVolume}>{formatVolume(set.volume)}</Text>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.xl },
  back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  header: { marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 34, fontWeight: '800' },
  date: { color: colors.secondary, marginTop: spacing.sm },
  summary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  summaryCard: { flex: 1, minHeight: 86, padding: spacing.md },
  value: { color: colors.text, fontSize: 17, fontWeight: '900' },
  label: { color: colors.secondary, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: spacing.sm },
  prs: { marginBottom: spacing.xl },
  section: { color: colors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginBottom: spacing.md },
  muted: { color: colors.secondary, lineHeight: 21 },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
  },
  prValue: { color: colors.primary, fontWeight: '800', textAlign: 'right' },
  exercise: { marginBottom: spacing.md },
  exerciseName: { color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  muscle: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 5 },
  set: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  setLabel: { color: colors.secondary, fontSize: 11, fontWeight: '800', width: 52 },
  setValue: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  setVolume: { color: colors.secondary, fontSize: 12 },
  empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl },
});
