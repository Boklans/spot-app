import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useI18n } from '@/lib/i18n';
import { formatVolume } from '@/lib/progressCalculator';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import type { CompletedWorkout } from '@/types/workout';

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function History() {
  const { t, tw, language } = useI18n();
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const groupLabel = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dateKey(value) === dateKey(today.toISOString())) return t('todayUpper');
    if (dateKey(value) === dateKey(yesterday.toISOString())) return t('yesterdayUpper');
    return date.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  };

  const groups = workouts.reduce<Map<string, CompletedWorkout[]>>((result, workout) => {
    const key = dateKey(workout.completedAt);
    const items = result.get(key) ?? [];
    items.push(workout);
    result.set(key, items);
    return result;
  }, new Map());

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backButton}
        >
          <Text style={styles.back}>‹  {t('navBack').toUpperCase()}</Text>
        </Pressable>
        <Text style={styles.title}>{t('workoutHistory')}</Text>
      </View>

      {workouts.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('noWorkoutsYet')}</Text>
          <Text style={styles.emptyBody}>{t('noWorkoutsBody')}</Text>
          <Button onPress={() => router.replace('/(tabs)')}>{t('startTraining')}</Button>
        </Card>
      ) : (
        [...groups.entries()].map(([key, items]) => (
          <View key={key} style={styles.group}>
            <Text style={styles.groupTitle}>{groupLabel(items[0].completedAt)}</Text>
            {items.map((workout) => (
              <Pressable
                accessibilityRole="button"
                key={workout.id}
                onPress={() => router.push({ pathname: '/history/[id]', params: { id: workout.id } })}
              >
                <Card style={styles.workout}>
                  <View style={styles.workoutTop}>
                    <View>
                      <Text style={styles.workoutName}>{tw(workout.workoutName)}</Text>
                      <Text style={styles.date}>
                        {new Date(workout.completedAt).toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US')}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                  <View style={styles.details}>
                    <Text style={styles.detail}>
                      {Math.max(1, Math.round(workout.durationSeconds / 60))} {t('min')}
                    </Text>
                    <Text style={styles.detail}>
                      {workout.totalSets} {t('sets').toLowerCase()}
                    </Text>
                    <Text style={styles.detail}>{formatVolume(workout.totalVolume)}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xxl },
  backButton: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.lg },
  back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  group: { marginBottom: spacing.xl },
  groupTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },
  workout: { marginBottom: spacing.sm },
  workoutTop: { flexDirection: 'row', justifyContent: 'space-between' },
  workoutName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  date: { color: colors.secondary, fontSize: 12, marginTop: 5 },
  arrow: { color: colors.secondary, fontSize: 28 },
  details: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  detail: { color: colors.secondary, fontSize: 13 },
  empty: { marginTop: spacing.xl },
  emptyTitle: { color: colors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  emptyBody: { color: colors.text, fontSize: 16, lineHeight: 23, marginVertical: spacing.xl },
});
