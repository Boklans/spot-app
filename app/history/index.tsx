import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { isAssistedExercise } from '@/lib/adaptiveProgression';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import type { CompletedWorkout } from '@/types/workout';

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

type HistoryViewMode = 'log' | 'compare';
type PeriodFilter = 'all' | 'this_month' | 'older';

export default function History() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const isUk = language === 'uk';
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const notes = useExerciseNotesStore((state) => state.notes);
  const loadNotes = useExerciseNotesStore((state) => state.loadNotes);

  const [viewMode, setViewMode] = useState<HistoryViewMode>('log');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  useEffect(() => {
    loadHistory();
    loadNotes();
  }, [loadHistory, loadNotes]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadNotes();
    }, [loadHistory, loadNotes])
  );

  const filteredWorkouts = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => {
      const ts = new Date(w.completedAt).getTime();
      if (periodFilter === 'this_month') return ts >= thirtyDaysAgo;
      if (periodFilter === 'older') return ts < thirtyDaysAgo;
      return true;
    });
  }, [workouts, periodFilter]);

  const groupLabel = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dateKey(value) === dateKey(today.toISOString())) return t('todayUpper');
    if (dateKey(value) === dateKey(yesterday.toISOString())) return t('yesterdayUpper');
    return date
      .toLocaleDateString(isUk ? 'uk-UA' : 'en-US', {
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      })
      .toUpperCase();
  };

  const groups = useMemo(() => {
    return filteredWorkouts.reduce<Map<string, CompletedWorkout[]>>((result, workout) => {
      const key = dateKey(workout.completedAt);
      const items = result.get(key) ?? [];
      items.push(workout);
      result.set(key, items);
      return result;
    }, new Map());
  }, [filteredWorkouts]);

  // Build "Then vs Now" per-exercise comparison across chronological history
  const exerciseComparisons = useMemo(() => {
    const chronological = [...workouts].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    interface SessionSnap {
      date: string;
      workingWeight: number;
      bestReps: number;
      repsSummary: string;
      setsCount: number;
    }

    const byExercise = new Map<
      string,
      {
        displayName: string;
        muscleGroup: string;
        first: SessionSnap;
        latest: SessionSnap;
        sessionsCount: number;
      }
    >();

    for (const w of chronological) {
      for (const ex of w.exercises) {
        const validSets = ex.sets.filter((s) => s.reps > 0 && s.weight >= 0);
        if (validSets.length === 0) continue;

        const key = ex.exerciseName.trim().toLowerCase();
        const assisted = isAssistedExercise(ex.exerciseName);
        const workingWeight = assisted
          ? Math.min(...validSets.map((s) => s.weight))
          : Math.max(...validSets.map((s) => s.weight));
        const bestReps = Math.max(
          ...validSets.filter((s) => s.weight === workingWeight).map((s) => s.reps)
        );
        const repsSummary = validSets.map((s) => s.reps).join('/');

        const snap: SessionSnap = {
          date: w.completedAt,
          workingWeight,
          bestReps,
          repsSummary,
          setsCount: validSets.length,
        };

        const existing = byExercise.get(key);
        if (!existing) {
          byExercise.set(key, {
            displayName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            first: snap,
            latest: snap,
            sessionsCount: 1,
          });
        } else {
          existing.latest = snap;
          existing.sessionsCount += 1;
        }
      }
    }

    return Array.from(byExercise.values()).sort((a, b) => b.sessionsCount - a.sessionsCount);
  }, [workouts]);

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
        </View>
        <Text style={styles.headerSubtitle}>
          {isUk
            ? `Усього збережено сесій: ${workouts.length} • Переглядайте журнал або порівнюйте старт із теперішньою формою`
            : `Total logged sessions: ${workouts.length} • Browse full log or compare Then vs Now`}
        </Text>
      </View>

      {workouts.length > 0 && (
        <View style={styles.modeTabsWrap}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              hapticLight();
              setViewMode('log');
            }}
            style={[styles.modeTab, viewMode === 'log' && styles.modeTabActive]}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={viewMode === 'log' ? '#0B0D0F' : '#8E9BAE'}
            />
            <Text style={[styles.modeTabText, viewMode === 'log' && styles.modeTabTextActive]}>
              {isUk ? `Журнал (${workouts.length})` : `All Sessions (${workouts.length})`}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              hapticLight();
              setViewMode('compare');
            }}
            style={[styles.modeTab, viewMode === 'compare' && styles.modeTabActive]}
          >
            <Ionicons
              name="git-compare-outline"
              size={15}
              color={viewMode === 'compare' ? '#0B0D0F' : '#8E9BAE'}
            />
            <Text style={[styles.modeTabText, viewMode === 'compare' && styles.modeTabTextActive]}>
              {isUk ? 'Тоді vs Зараз' : 'Then vs Now'}
            </Text>
          </Pressable>
        </View>
      )}

      {workouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyGlowRing}>
            <View style={styles.emptyIconBadge}>
              <MaterialCommunityIcons name="history" size={34} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.emptyTitle}>
            {isUk ? 'ІСТОРІЯ ТРЕНУВАНЬ ПОРОЖНЯ' : 'NO WORKOUTS YET'}
          </Text>

          <Text style={styles.emptySubtitle}>
            {isUk
              ? 'Завершіть своє перше тренування, щоб відстежувати прогрес та порівнювати результати.'
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
              {isUk ? 'ПОЧАТИ ТРЕНУВАННЯ' : 'START WORKOUT'}
            </Text>
          </Pressable>
        </View>
      ) : viewMode === 'compare' ? (
        <View style={{ gap: 12 }}>
          <View style={styles.compareBanner}>
            <Ionicons name="trending-up" size={18} color={colors.primaryText} />
            <Text style={styles.compareBannerText}>
              {isUk
                ? 'Порівняння ваших перших зафіксованих робочих ваг із останнім виконанням кожної вправи.'
                : 'Side-by-side comparison of your starting working weights vs your most recent session.'}
            </Text>
          </View>

          {exerciseComparisons.map((item) => {
            const assisted = isAssistedExercise(item.displayName);
            const weightDelta = Math.round((item.latest.workingWeight - item.first.workingWeight) * 10) / 10;
            const repsDelta = item.latest.bestReps - item.first.bestReps;
            const progressedWeight = assisted ? weightDelta < 0 : weightDelta > 0;
            const progressedReps = Math.abs(weightDelta) < 0.01 && repsDelta > 0;
            const firstDateStr = new Date(item.first.date).toLocaleDateString(
              isUk ? 'uk-UA' : 'en-US',
              { day: 'numeric', month: 'short' }
            );
            const latestDateStr = new Date(item.latest.date).toLocaleDateString(
              isUk ? 'uk-UA' : 'en-US',
              { day: 'numeric', month: 'short' }
            );

            return (
              <Card key={item.displayName} style={styles.compareCard}>
                <View style={styles.compareTopRow}>
                  <View style={styles.compareThumbWrap}>
                    <Image
                      source={getExerciseImage(item.displayName)}
                      style={styles.compareThumb}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compareExName}>{te(item.displayName)}</Text>
                    <Text style={styles.compareSessionsMeta}>
                      {isUk ? `Виконано разів: ${item.sessionsCount}` : `${item.sessionsCount} sessions logged`}
                    </Text>
                  </View>

                  {item.sessionsCount > 1 && (progressedWeight || progressedReps) ? (
                    <View style={styles.deltaBadgePositive}>
                      <Text style={styles.deltaBadgePositiveText}>
                        {progressedWeight
                          ? `${weightDelta > 0 ? '+' : ''}${formatWithUnit(weightDelta)}`
                          : `+${repsDelta} ${isUk ? 'повт' : 'reps'}`}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.deltaBadgeNeutral}>
                      <Text style={styles.deltaBadgeNeutralText}>
                        {item.sessionsCount === 1
                          ? isUk
                            ? 'База'
                            : 'Baseline'
                          : isUk
                            ? 'Закріплення'
                            : 'Holding'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.thenNowBoxes}>
                  <View style={styles.thenBox}>
                    <Text style={styles.thenNowLabel}>
                      {isUk ? `СТАРТ (${firstDateStr})` : `START (${firstDateStr})`}
                    </Text>
                    <Text style={styles.thenValue}>
                      {item.first.workingWeight > 0
                        ? formatWithUnit(item.first.workingWeight)
                        : t('bodyweight')}{' '}
                      × {item.first.repsSummary}
                    </Text>
                  </View>

                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={item.sessionsCount > 1 ? colors.primaryText : colors.muted}
                  />

                  {item.sessionsCount > 1 ? (
                    <View style={[styles.thenBox, styles.nowBox]}>
                      <Text style={[styles.thenNowLabel, { color: colors.primaryText }]}>
                        {isUk ? `ЗАРАЗ (${latestDateStr})` : `NOW (${latestDateStr})`}
                      </Text>
                      <Text style={styles.nowValue}>
                        {item.latest.workingWeight > 0
                          ? formatWithUnit(item.latest.workingWeight)
                          : t('bodyweight')}{' '}
                        × {item.latest.repsSummary}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.thenBox,
                        {
                          borderStyle: 'dashed',
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: 'transparent',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <Text style={[styles.thenNowLabel, { color: colors.muted }]}>
                        {isUk ? 'ЗАРАЗ' : 'NOW'}
                      </Text>
                      <Text
                        style={{
                          color: colors.secondary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {isUk ? 'Після 2-го тренування' : 'After 2nd session'}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <>
          {/* Period Filter Pills */}
          <View style={styles.filterPillsRow}>
            {(
              [
                { id: 'all', labelUk: 'Усі сесії', labelEn: 'All Time' },
                { id: 'this_month', labelUk: 'За 30 днів', labelEn: 'Last 30 Days' },
                { id: 'older', labelUk: 'Попередні місяці', labelEn: 'Older' },
              ] as const
            ).map((f) => {
              const active = periodFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    hapticLight();
                    setPeriodFilter(f.id);
                  }}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {isUk ? f.labelUk : f.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {filteredWorkouts.length === 0 ? (
            <Card style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.secondary, fontSize: 13, textAlign: 'center' }}>
                {isUk
                  ? 'За обраний період тренувань не знайдено.'
                  : 'No workouts found for the selected period.'}
              </Text>
            </Card>
          ) : (
            [...groups.entries()].map(([key, items]) => (
              <View key={key} style={styles.group}>
                <Text style={styles.groupTitle}>{groupLabel(items[0].completedAt)}</Text>
                {items.map((workout) => (
                  <Pressable
                    accessibilityRole="button"
                    key={workout.id}
                    onPress={() =>
                      router.push({ pathname: '/history/[id]', params: { id: workout.id } })
                    }
                  >
                    <Card style={styles.workout}>
                      <View style={styles.workoutTop}>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Text style={styles.workoutName}>{tw(workout.workoutName)}</Text>
                            {workout.isPartial && (
                              <View style={styles.partialBadge}>
                                <Text style={styles.partialBadgeText}>
                                  {isUk
                                    ? `Частково (${workout.totalSets}/${workout.plannedSets || workout.totalSets})`
                                    : `Partial (${workout.totalSets}/${workout.plannedSets || workout.totalSets})`}
                                </Text>
                              </View>
                            )}
                            {(workout.personalRecords?.length || 0) > 0 && (
                              <View style={styles.prBadge}>
                                <Text style={styles.prBadgeText}>
                                  🏆 {workout.personalRecords?.length} PR
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.date}>
                            {new Date(workout.completedAt).toLocaleDateString(
                              isUk ? 'uk-UA' : 'en-US',
                              { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                            )}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={isUk ? 'Видалити сесію' : 'Delete session'}
                            hitSlop={10}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              hapticLight();
                              void useWorkoutHistoryStore.getState().deleteWorkout(workout.id);
                            }}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              backgroundColor: colors.elevated,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.secondary} />
                          </Pressable>
                          <Text style={styles.arrow}>›</Text>
                        </View>
                      </View>

                      {/* Exercise Summary List inside Card so user sees weights at a glance */}
                      <View style={styles.exercisePreviewList}>
                        {workout.exercises.map((ex) => {
                          const validSets = ex.sets.filter((s) => s.reps > 0);
                          if (validSets.length === 0) return null;
                          const topWeight = Math.max(...validSets.map((s) => s.weight));
                          const repsStr = validSets.map((s) => s.reps).join('/');
                          const hasNote = Boolean(notes[ex.exerciseName.trim().toLowerCase()]);
                          return (
                            <View key={ex.exerciseId} style={styles.exercisePreviewRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Text numberOfLines={1} style={styles.exercisePreviewName}>
                                  {te(ex.exerciseName)}
                                </Text>
                                {hasNote && (
                                  <Ionicons name="bookmark" size={11} color={colors.primaryText} />
                                )}
                              </View>
                              <Text style={styles.exercisePreviewSets}>
                                {topWeight > 0 ? formatWithUnit(topWeight) : t('bodyweight')} × {repsStr}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.details}>
                        <Text style={styles.detail}>
                          ⏱ {Math.max(1, Math.round(workout.durationSeconds / 60))} {t('min')}
                        </Text>
                        <Text style={styles.detail}>
                          • {workout.exercises.length} {t('exercises').toLowerCase()}
                        </Text>
                        <Text style={styles.detail}>
                          •{' '}
                          {workout.isPartial && workout.plannedSets
                            ? `${workout.totalSets}/${workout.plannedSets}`
                            : workout.totalSets}{' '}
                          {t('sets').toLowerCase()}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { marginBottom: spacing.lg },
  backButton: { minHeight: 40, justifyContent: 'center', marginBottom: spacing.sm },
  back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  quickLogBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modeTabsWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: colors.onPrimary,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.accentLine,
  },
  filterPillText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: colors.primaryText,
    fontWeight: '800',
  },
  group: { marginBottom: spacing.xl },
  groupTitle: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },
  workout: { marginBottom: spacing.md },
  workoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  workoutName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  date: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  arrow: { color: colors.secondary, fontSize: 24, marginLeft: 8 },
  partialBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  partialBadgeText: { color: '#F59E0B', fontSize: 10, fontWeight: '800' },
  prBadge: {
    backgroundColor: 'rgba(255, 209, 48, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 48, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: { color: '#D97706', fontSize: 10, fontWeight: '800' },
  exercisePreviewList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 5,
  },
  exercisePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  exercisePreviewName: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  exercisePreviewSets: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  details: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detail: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  compareBannerText: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 17,
    flex: 1,
  },
  compareCard: {
    padding: 14,
    gap: 12,
  },
  compareTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compareThumbWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  compareThumb: {
    width: '100%',
    height: '100%',
  },
  compareExName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  compareSessionsMeta: {
    color: colors.secondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  deltaBadgePositive: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.accentLine,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deltaBadgePositiveText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '900',
  },
  deltaBadgeNeutral: {
    backgroundColor: colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deltaBadgeNeutralText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  thenNowBoxes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thenBox: {
    flex: 1,
    backgroundColor: colors.elevated,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nowBox: {
    borderColor: colors.accentLine,
    backgroundColor: colors.primaryMuted,
  },
  thenNowLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  thenValue: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  nowValue: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyGlowRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1.5,
    borderColor: colors.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: colors.secondary,
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
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
