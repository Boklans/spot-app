import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { hapticLight } from '@/lib/haptics';
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
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>{t('workoutHistory')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quick Log"
            onPress={() => {
              hapticLight();
              router.push('/workout/quick-log');
            }}
            style={({ pressed }) => [styles.quickLogBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="flash" size={13} color="#0B0D0F" style={{ marginRight: 4 }} />
            <Text style={styles.quickLogBtnText}>{t('quickLog')}</Text>
          </Pressable>
        </View>
      </View>

      {workouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyGlowRing}>
            <View style={styles.emptyIconBadge}>
              <MaterialCommunityIcons name="history" size={34} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.emptyTitle}>
            {language === 'uk' ? 'ІСТОРІЯ ТРЕНУВАНЬ ПОРОЖНЯ' : 'NO WORKOUTS YET'}
          </Text>

          <Text style={styles.emptySubtitle}>
            {language === 'uk'
              ? 'Завершіть своє перше тренування, щоб відстежувати прогрес та збережені сесії.'
              : 'Complete your first workout to start logging your sessions and tracking progress.'}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start Workout"
            onPress={() => {
              hapticLight();
              router.replace('/(tabs)');
            }}
            style={({ pressed }) => [
              styles.emptyCtaBtn,
              pressed && styles.emptyCtaBtnPressed,
            ]}
          >
            <Ionicons name="play" size={18} color="#0B0D0F" style={{ marginRight: 6 }} />
            <Text style={styles.emptyCtaBtnText}>
              {language === 'uk' ? 'ПОЧАТИ ТРЕНУВАННЯ' : 'START WORKOUT'}
            </Text>
          </Pressable>
        </View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  quickLogBtnText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
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
  emptyCard: {
    backgroundColor: '#15181C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#292E35',
    padding: 28,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyGlowRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C2025',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minHeight: 48,
    width: '100%',
  },
  emptyCtaBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emptyCtaBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
