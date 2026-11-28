import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { isAssistedExercise } from '@/lib/adaptiveProgression';
import { toLocalDateKey } from '@/lib/dateUtils';
import { resolveCanonicalExerciseId } from '@/lib/exercises';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import type { CompletedWorkout } from '@/types/workout';

type HistoryViewMode = 'log' | 'compare';
type PeriodFilter = 'all' | 'this_month' | 'older';

interface HistoryFeedProps {
  bottomInset?: number;
  showBackHeader?: boolean;
}

interface WorkoutSection {
  title: string;
  key: string;
  data: CompletedWorkout[];
}

/**
 * Promoted Virtualized Workout History Feed (<SectionList> + <FlatList>)
 * shared between the Progress tab ("Analytics | History") and /history route.
 * - Zero unvirtualized .map() scroll lag even at 500+ workouts
 * - Search by workout or exercise name (EN & UK)
 * - No exposed accidental-delete trash icon on cards (deletion lives safely in /history/[id])
 */
export function HistoryFeed({
  bottomInset = 40,
  showBackHeader = false,
}: HistoryFeedProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, te, tw, language } = useI18n();
  const isUk = language === 'uk';
  const { formatWithUnit } = useWeightUnit();

  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const notes = useExerciseNotesStore((state) => state.notes);

  const [viewMode, setViewMode] = useState<HistoryViewMode>('log');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWorkouts = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const q = searchQuery.trim().toLowerCase();

    return workouts.filter((w) => {
      const ts = new Date(w.completedAt || w.startedAt).getTime();
      if (periodFilter === 'this_month' && ts < thirtyDaysAgo) return false;
      if (periodFilter === 'older' && ts >= thirtyDaysAgo) return false;

      if (!q) return true;
      const wName = (w.workoutName || '').toLowerCase();
      const wNameLocalized = tw(w.workoutName || '').toLowerCase();
      if (wName.includes(q) || wNameLocalized.includes(q)) return true;

      return w.exercises.some((ex) => {
        const raw = (ex.exerciseName || '').toLowerCase();
        const loc = te(ex.exerciseName || '').toLowerCase();
        return raw.includes(q) || loc.includes(q);
      });
    });
  }, [workouts, periodFilter, searchQuery, tw, te]);

  const sections = useMemo<WorkoutSection[]>(() => {
    const todayKey = toLocalDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterdayDate);
    const currentYear = new Date().getFullYear();

    const byDay = new Map<string, CompletedWorkout[]>();
    for (const workout of filteredWorkouts) {
      const key = toLocalDateKey(workout.completedAt || workout.startedAt);
      const list = byDay.get(key) ?? [];
      list.push(workout);
      byDay.set(key, list);
    }

    return Array.from(byDay.entries()).map(([key, items]) => {
      let title: string;
      if (key === todayKey) {
        title = t('todayUpper');
      } else if (key === yesterdayKey) {
        title = t('yesterdayUpper');
      } else {
        const dt = new Date(items[0].completedAt || items[0].startedAt);
        title = dt
          .toLocaleDateString(isUk ? 'uk-UA' : 'en-US', {
            month: 'long',
            day: 'numeric',
            year: dt.getFullYear() !== currentYear ? 'numeric' : undefined,
          })
          .toUpperCase();
      }
      return { key, title, data: items };
    });
  }, [filteredWorkouts, isUk, t]);

  const exerciseComparisons = useMemo(() => {
    const chronological = [...workouts].sort(
      (a, b) =>
        new Date(a.completedAt || a.startedAt).getTime() -
        new Date(b.completedAt || b.startedAt).getTime()
    );

    interface SessionSnap {
      date: string;
      workingWeight: number;
      bestReps: number;
      repsSummary: string;
    }

    const byExercise = new Map<
      string,
      {
        key: string;
        displayName: string;
        muscleGroup: string;
        first: SessionSnap;
        latest: SessionSnap;
        sessionsCount: number;
      }
    >();

    for (const w of chronological) {
      for (const ex of w.exercises) {
        const validSets = ex.sets.filter(
          (s) => s.setType !== 'warmup' && s.reps > 0 && s.weight >= 0
        );
        if (validSets.length === 0) continue;

        const key =
          resolveCanonicalExerciseId(ex.exerciseName) ||
          ex.exerciseName.trim().toLowerCase();
        const assisted = isAssistedExercise(ex.exerciseName);
        const workingWeight = assisted
          ? Math.min(...validSets.map((s) => s.weight))
          : Math.max(...validSets.map((s) => s.weight));
        const bestReps = Math.max(
          ...validSets.filter((s) => s.weight === workingWeight).map((s) => s.reps)
        );
        const repsSummary = validSets.map((s) => s.reps).join('/');

        const snap: SessionSnap = {
          date: w.completedAt || w.startedAt,
          workingWeight,
          bestReps,
          repsSummary,
        };

        const existing = byExercise.get(key);
        if (!existing) {
          byExercise.set(key, {
            key,
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

    const q = searchQuery.trim().toLowerCase();
    return Array.from(byExercise.values())
      .filter((item) => {
        if (!q) return true;
        return (
          item.displayName.toLowerCase().includes(q) ||
          te(item.displayName).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.sessionsCount - a.sessionsCount);
  }, [workouts, searchQuery, te]);

  const getHasNote = (exerciseName: string): boolean => {
    const cid = resolveCanonicalExerciseId(exerciseName);
    if (cid && notes[cid]) return true;
    return Boolean(notes[exerciseName.trim().toLowerCase()]);
  };

  const renderTopControls = () => (
    <View style={styles.controlsHeader}>
      {showBackHeader && (
        <View style={styles.standaloneHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color={colors.secondary} />
            <Text style={styles.backText}>{t('navBack').toUpperCase()}</Text>
          </Pressable>
          <Text style={styles.standaloneTitle}>{t('workoutHistory')}</Text>
        </View>
      )}

      {workouts.length > 0 && (
        <>
          {/* Mode Switcher: All Sessions | Then vs Now */}
          <View style={styles.modeTabsRow}>
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
                size={14}
                color={viewMode === 'log' ? colors.activeChipText : colors.secondary}
              />
              <Text
                style={[styles.modeTabText, viewMode === 'log' && styles.modeTabTextActive]}
              >
                {isUk ? `Сесії (${workouts.length})` : `Sessions (${workouts.length})`}
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
                size={14}
                color={viewMode === 'compare' ? colors.activeChipText : colors.secondary}
              />
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === 'compare' && styles.modeTabTextActive,
                ]}
              >
                {isUk ? 'Тоді vs Зараз' : 'Then vs Now'}
              </Text>
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                isUk
                  ? 'Пошук за тренуванням або вправою...'
                  : 'Search workout or exercise...'
              }
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Period Filter Pills in Log Mode */}
          {viewMode === 'log' && (
            <View style={styles.periodPillsRow}>
              {(
                [
                  { id: 'all', labelUk: 'Усі сесії', labelEn: 'All Time' },
                  { id: 'this_month', labelUk: 'За 30 днів', labelEn: '30 Days' },
                  { id: 'older', labelUk: 'Раніше', labelEn: 'Older' },
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
                    style={[styles.periodPill, active && styles.periodPillActive]}
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        active && styles.periodPillTextActive,
                      ]}
                    >
                      {isUk ? f.labelUk : f.labelEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );

  if (workouts.length === 0) {
    return (
      <View style={[styles.listContainer, { paddingBottom: bottomInset }]}>
        {renderTopControls()}
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="time-outline" size={32} color={colors.primaryText} />
          </View>
          <Text style={styles.emptyTitle}>
            {isUk ? 'ІСТОРІЯ ТРЕНУВАНЬ ПОРОЖНЯ' : 'NO WORKOUTS YET'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isUk
              ? 'Завершіть своє перше тренування, щоб відстежувати історію сесій та динаміку ваг.'
              : 'Complete your first workout to start logging your sessions and tracking progress.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              router.replace('/(tabs)');
            }}
            style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="play" size={16} color={colors.onPrimary} />
            <Text style={styles.emptyCtaText}>
              {isUk ? 'ПОЧАТИ ТРЕНУВАННЯ' : 'START WORKOUT'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (viewMode === 'compare') {
    return (
      <FlatList
        data={exerciseComparisons}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={renderTopControls}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContainer, { paddingBottom: bottomInset }]}
        renderItem={({ item }) => {
          const assisted = isAssistedExercise(item.displayName);
          const weightDelta =
            Math.round((item.latest.workingWeight - item.first.workingWeight) * 10) / 10;
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
            <Card style={styles.compareCard}>
              <View style={styles.compareTopRow}>
                <View style={styles.compareThumbWrap}>
                  <Image
                    source={getExerciseImage(item.displayName)}
                    style={styles.compareThumb}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.compareExName}>
                    {te(item.displayName)}
                  </Text>
                  <Text style={styles.compareMeta}>
                    {isUk
                      ? `Сесій: ${item.sessionsCount}`
                      : `${item.sessionsCount} sessions`}
                  </Text>
                </View>

                {item.sessionsCount > 1 && (progressedWeight || progressedReps) ? (
                  <View style={styles.deltaPositive}>
                    <Text style={styles.deltaPositiveText}>
                      {progressedWeight
                        ? `${weightDelta > 0 ? '+' : ''}${formatWithUnit(weightDelta)}`
                        : `+${repsDelta} ${isUk ? 'повт' : 'reps'}`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.deltaNeutral}>
                    <Text style={styles.deltaNeutralText}>
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

              <View style={styles.thenNowRow}>
                <View style={styles.thenBox}>
                  <Text style={styles.thenNowKicker}>
                    {isUk ? `СТАРТ (${firstDateStr})` : `START (${firstDateStr})`}
                  </Text>
                  <Text style={styles.thenMono}>
                    {item.first.workingWeight > 0
                      ? formatWithUnit(item.first.workingWeight)
                      : t('bodyweight')}{' '}
                    × {item.first.repsSummary}
                  </Text>
                </View>

                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={item.sessionsCount > 1 ? colors.primaryText : colors.muted}
                />

                {item.sessionsCount > 1 ? (
                  <View style={[styles.thenBox, styles.nowBox]}>
                    <Text style={[styles.thenNowKicker, { color: colors.primaryText }]}>
                      {isUk ? `ЗАРАЗ (${latestDateStr})` : `NOW (${latestDateStr})`}
                    </Text>
                    <Text style={styles.nowMono}>
                      {item.latest.workingWeight > 0
                        ? formatWithUnit(item.latest.workingWeight)
                        : t('bodyweight')}{' '}
                      × {item.latest.repsSummary}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.thenBox, styles.pendingBox]}>
                    <Text style={[styles.thenNowKicker, { color: colors.muted }]}>
                      {isUk ? 'ЗАРАЗ' : 'NOW'}
                    </Text>
                    <Text style={styles.pendingText}>
                      {isUk ? 'Після 2-ї сесії' : 'After 2nd session'}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={renderTopControls}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContainer, { paddingBottom: bottomInset }]}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item: workout }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/history/[id]', params: { id: workout.id } })
          }
          style={({ pressed }) => [pressed && { opacity: 0.85 }]}
        >
          <Card style={styles.workoutCard}>
            <View style={styles.workoutTopRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.workoutTitleWrap}>
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
                <Text style={styles.dateText}>
                  {new Date(workout.completedAt || workout.startedAt).toLocaleDateString(
                    isUk ? 'uk-UA' : 'en-US',
                    {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>

            {/* Exercise Summary Rows */}
            <View style={styles.exPreviewList}>
              {workout.exercises.map((ex, idx) => {
                const nonWarmup = ex.sets.filter(
                  (s) => s.setType !== 'warmup' && s.reps > 0
                );
                const validSets =
                  nonWarmup.length > 0
                    ? nonWarmup
                    : ex.sets.filter((s) => s.reps > 0);
                if (validSets.length === 0) return null;

                const assisted = isAssistedExercise(ex.exerciseName);
                const keyWeight = assisted
                  ? Math.min(...validSets.map((s) => s.weight))
                  : Math.max(...validSets.map((s) => s.weight));
                const repsStr = validSets.map((s) => s.reps).join('/');
                const hasNote = getHasNote(ex.exerciseName);

                return (
                  <View
                    key={`${ex.exerciseId}-${idx}`}
                    style={styles.exPreviewRow}
                  >
                    <View style={styles.exPreviewLeft}>
                      <Text numberOfLines={1} style={styles.exPreviewName}>
                        {te(ex.exerciseName)}
                      </Text>
                      {hasNote && (
                        <Ionicons
                          name="bookmark"
                          size={11}
                          color={colors.primaryText}
                        />
                      )}
                    </View>
                    <Text style={styles.exPreviewMono}>
                      {keyWeight > 0 ? formatWithUnit(keyWeight) : t('bodyweight')} × {repsStr}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Telemetry Footer */}
            <View style={styles.metaFooter}>
              <Text style={styles.metaText}>
                ⏱ {Math.max(1, Math.round(workout.durationSeconds / 60))} {t('min')}
              </Text>
              <Text style={styles.metaText}>
                · {workout.exercises.length} {t('exercises').toLowerCase()}
              </Text>
              <Text style={styles.metaText}>
                ·{' '}
                {workout.isPartial && workout.plannedSets
                  ? `${workout.totalSets}/${workout.plannedSets}`
                  : workout.totalSets}{' '}
                {t('sets').toLowerCase()}
              </Text>
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Card style={{ padding: 22, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.regular, color: colors.secondary, fontSize: 13.5 }}>
            {isUk
              ? 'За обраним фільтром сесій не знайдено.'
              : 'No workouts match the selected filter.'}
          </Text>
        </Card>
      }
    />
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    listContainer: {
      paddingHorizontal: 20,
      gap: 10,
    },
    controlsHeader: {
      gap: 10,
      marginBottom: 4,
    },
    standaloneHeader: {
      gap: 6,
      marginBottom: 6,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
    },
    backText: {
      fontFamily: fonts.bold,
      fontSize: 11.5,
      letterSpacing: 0.8,
      color: colors.secondary,
    },
    standaloneTitle: {
      fontFamily: fonts.bold,
      fontSize: 26,
      color: colors.text,
      letterSpacing: -0.45,
      includeFontPadding: false,
    },
    modeTabsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      borderRadius: radii.sm,
    },
    modeTabActive: {
      backgroundColor: colors.activeChipBg,
    },
    modeTabText: {
      fontFamily: fonts.semiBold,
      fontSize: 12.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    modeTabTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 12,
      borderRadius: radii.sm + 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      fontFamily: fonts.regular,
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },
    periodPillsRow: {
      flexDirection: 'row',
      gap: 7,
    },
    periodPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    periodPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.accentLine,
    },
    periodPillText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    periodPillTextActive: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
    },
    sectionHeader: {
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 0.9,
      color: colors.muted,
      marginTop: 8,
      marginBottom: 2,
      includeFontPadding: false,
    },
    workoutCard: {
      padding: 15,
      gap: 10,
    },
    workoutTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    workoutTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 7,
    },
    workoutName: {
      fontFamily: fonts.bold,
      fontSize: 16.5,
      color: colors.text,
      letterSpacing: -0.25,
      includeFontPadding: false,
    },
    partialBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    partialBadgeText: {
      fontFamily: fonts.semiBold,
      fontSize: 10.5,
      color: colors.warmup,
      includeFontPadding: false,
    },
    prBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    prBadgeText: {
      fontFamily: fonts.monoBold,
      fontSize: 10.5,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    dateText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    exPreviewList: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: 8,
      gap: 5,
    },
    exPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    exPreviewLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flex: 1,
    },
    exPreviewName: {
      fontFamily: fonts.medium,
      fontSize: 13,
      color: colors.text,
      flexShrink: 1,
      includeFontPadding: false,
    },
    exPreviewMono: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    metaFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 2,
    },
    metaText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11.5,
      color: colors.muted,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
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
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    compareThumb: {
      width: '100%',
      height: '100%',
    },
    compareExName: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.text,
      includeFontPadding: false,
    },
    compareMeta: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.secondary,
      marginTop: 1,
    },
    deltaPositive: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.xs,
    },
    deltaPositiveText: {
      fontFamily: fonts.monoBold,
      fontSize: 11.5,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    deltaNeutral: {
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.xs,
    },
    deltaNeutralText: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      color: colors.secondary,
      includeFontPadding: false,
    },
    thenNowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    thenBox: {
      flex: 1,
      padding: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.elevated,
      gap: 3,
    },
    nowBox: {
      backgroundColor: colors.completedRowBg,
      borderWidth: 1,
      borderColor: colors.completedRowBorder,
    },
    pendingBox: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    thenNowKicker: {
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.muted,
      includeFontPadding: false,
    },
    thenMono: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    nowMono: {
      fontFamily: fonts.monoBold,
      fontSize: 13,
      color: colors.text,
      includeFontPadding: false,
    },
    pendingText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.secondary,
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
      marginTop: 8,
    },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      fontSize: 15,
      letterSpacing: 0.6,
      color: colors.text,
      includeFontPadding: false,
    },
    emptySubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.secondary,
      textAlign: 'center',
    },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 6,
      paddingHorizontal: 20,
      height: 46,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    emptyCtaText: {
      fontFamily: fonts.bold,
      fontSize: 13.5,
      color: colors.onPrimary,
      includeFontPadding: false,
    },
  });
