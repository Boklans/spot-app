import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NeonLineChart } from '@/components/progress/NeonLineChart';
import {
  RealStrengthGraph,
  type StrengthSessionPoint,
} from '@/components/progress/RealStrengthGraph';
import { BodyWeightGraph } from '@/components/progress/BodyWeightGraph';
import { LogWeightModal } from '@/components/progress/LogWeightModal';
import { colors } from '@/constants/colors';
import { analyzeBodyAndStrength } from '@/lib/bodyCompositionAI';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  calculateMuscleProgress,
  calculateProgressSummary,
  getAvailableExercisesForProgress,
  type ProgressPeriod,
} from '@/lib/progressCalculator';
import { convertVolumeToActiveUnit, formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

type ActiveViewTab = 'overview' | 'muscles' | 'weight' | 'prs';

const CORE_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'];

export default function Progress() {
  const { t, tm, language } = useI18n();
  const { unit, unitLabel, format, formatWithUnit, formatVolume, fromKg } = useWeightUnit();
  const profile = useUserProfileStore((state) => state.profile);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const bodyWeightEntries = useBodyWeightStore((state) => state.entries);
  const loadBodyWeightHistory = useBodyWeightStore((state) => state.loadHistory);
  const deleteBodyWeightEntry = useBodyWeightStore((state) => state.deleteEntry);
  const getBodyWeightStats = useBodyWeightStore((state) => state.getStats);

  const [period, setPeriod] = useState<ProgressPeriod>('30D');
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('overview');
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('1M');
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [logWeightModalVisible, setLogWeightModalVisible] = useState(false);

  // Sync on tab focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      useProgramStore.getState().loadProgram();
      loadBodyWeightHistory();
    }, [loadHistory, loadBodyWeightHistory])
  );

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 80, 320);

  const hasHistory = history.length > 0;
  const realSummary = calculateProgressSummary(history, period);

  const workoutsCount = hasHistory ? realSummary.workouts : 0;
  const volumeDisplay = hasHistory
    ? formatVolume(realSummary.volume)
    : formatVolume(0);
  const prsCount = hasHistory ? realSummary.personalRecords : 0;

  // Real muscle group calculation
  const realMuscles = calculateMuscleProgress(history, period);
  const displayMuscles = CORE_MUSCLES.map((muscleName) => {
    const found = realMuscles.find(
      (m) => m.name.toLowerCase() === muscleName.toLowerCase()
    );
    return {
      name: muscleName,
      volume: found?.volume ?? 0,
      changePercent: found?.changePercent ?? (hasHistory ? 0 : 0),
    };
  });

  // Calculate detailed stats for selected muscle
  const selectedMuscleWorkouts = history.filter((w) =>
    w.exercises.some((e) =>
      e.muscleGroup?.toLowerCase().includes(selectedMuscle.toLowerCase())
    )
  );
  const selectedMuscleSets = selectedMuscleWorkouts.reduce(
    (total, w) =>
      total +
      w.exercises
        .filter((e) =>
          e.muscleGroup?.toLowerCase().includes(selectedMuscle.toLowerCase())
        )
        .reduce((sum, e) => sum + e.sets.length, 0),
    0
  );
  const selectedMuscleVolume = selectedMuscleWorkouts.reduce(
    (total, w) =>
      total +
      w.exercises
        .filter((e) =>
          e.muscleGroup?.toLowerCase().includes(selectedMuscle.toLowerCase())
        )
        .reduce((sum, e) => sum + e.sets.reduce((sSum, s) => sSum + s.volume, 0), 0),
    0
  );

  // Real PR records from history
  const allHistoryPrs = history
    .flatMap((w) =>
      (w.personalRecords || []).map((pr) => ({
        id: pr.id,
        name: pr.exerciseName,
        value: pr.label,
        date: new Date(w.completedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        icon: 'dumbbell' as const,
      }))
    )
    .slice(0, 10);

  const program = useProgramStore((state) => state.program);
  const availableExercises = getAvailableExercisesForProgress(program, history);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const selectedExercise =
    availableExercises.find(
      (ex) =>
        ex.id === selectedExerciseId ||
        ex.name.toLowerCase() === selectedExerciseId?.toLowerCase()
    ) ??
    availableExercises[0] ?? {
      id: 'default-bench',
      name: 'Bench Press',
      source: 'program' as const,
    };

  const exerciseName = selectedExercise.name;

  // Real Strength Chart points for the selected exercise
  const exerciseWorkouts = history
    .filter((w) =>
      w.exercises.some((e) =>
        e.exerciseName.toLowerCase().trim() === exerciseName.toLowerCase().trim() ||
        e.exerciseName.toLowerCase().includes(exerciseName.toLowerCase()) ||
        (selectedExercise.id && e.exerciseId === selectedExercise.id)
      )
    )
    .sort(
      (a, b) =>
        new Date(a.completedAt || a.startedAt).getTime() -
        new Date(b.completedAt || b.startedAt).getTime()
    );

  const sessionPoints: StrengthSessionPoint[] = exerciseWorkouts
    .map((w, index) => {
      const ex = w.exercises.find((e) =>
        e.exerciseName.toLowerCase().trim() === exerciseName.toLowerCase().trim() ||
        e.exerciseName.toLowerCase().includes(exerciseName.toLowerCase()) ||
        (selectedExercise.id && e.exerciseId === selectedExercise.id)
      );

      const sets = ex?.sets || [];
      let bestWeight = 0;
      let bestReps = 0;
      let totalVol = 0;

      for (const s of sets) {
        const sw = s.weight || 0;
        const sr = s.reps || 0;
        totalVol += sw * sr;
        if (sw > bestWeight || (sw === bestWeight && sr > bestReps)) {
          bestWeight = sw;
          bestReps = sr;
        }
      }

      const d = new Date(w.completedAt || w.startedAt);
      const isToday = new Date().toDateString() === d.toDateString();
      const formattedDate = isToday
        ? 'Today'
        : !isNaN(d.getTime())
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `W${index + 1}`;

      const est1RM = Math.round(bestWeight * (1 + bestReps / 30));

      return {
        date: w.completedAt || w.startedAt,
        formattedDate,
        weight: fromKg(bestWeight),
        reps: bestReps,
        volume: convertVolumeToActiveUnit(totalVol, unit),
        est1RM: fromKg(est1RM),
      };
    })
    .filter((p) => p.weight > 0);

  const latestSession =
    sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1] : null;

  const latestExerciseWeight =
    latestSession ? `${formatWeight(latestSession.weight)} ${unitLabel}` : `-- ${unitLabel}`;

  const bestExerciseSetText = latestSession
    ? `Best: ${formatWeight(latestSession.weight)} ${unitLabel} × ${latestSession.reps}`
    : '';

  const periodLabels: Record<ProgressPeriod, string> = {
    '7D': language === 'uk' ? 'Останні 7 днів' : 'Last 7 days',
    '30D': language === 'uk' ? 'Останні 30 днів' : 'Last 30 days',
    ALL: language === 'uk' ? 'За весь час' : 'All time',
  };

  const daysMap: Record<ProgressPeriod, number> = { '7D': 7, '30D': 30, ALL: 365 };
  const bodyStats = getBodyWeightStats(daysMap[period] ?? 30);
  const avgMuscleChange =
    realMuscles.length > 0
      ? Math.round(
          realMuscles.reduce((sum, m) => sum + (m.changePercent || 0), 0) / realMuscles.length
        )
      : 0;
  const aiAnalysis = analyzeBodyAndStrength(
    profile.goal,
    bodyStats,
    avgMuscleChange,
    language
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Header with Period Dropdown */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select time period"
          onPress={() => {
            hapticLight();
            setPeriodDropdownOpen(!periodDropdownOpen);
          }}
          style={styles.dropdownBtn}
        >
          <Text style={styles.dropdownBtnText}>{periodLabels[period]}</Text>
          <Ionicons name="chevron-down" size={14} color="#8E9BAE" style={{ marginLeft: 6 }} />
        </Pressable>
      </View>

      {/* Period Dropdown Menu */}
      {periodDropdownOpen && (
        <View style={styles.dropdownMenu}>
          {(['7D', '30D', 'ALL'] as ProgressPeriod[]).map((p) => (
            <Pressable
              accessibilityRole="button"
              key={p}
              onPress={() => {
                hapticLight();
                setPeriod(p);
                setPeriodDropdownOpen(false);
              }}
              style={[styles.dropdownItem, period === p && styles.dropdownItemActive]}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  period === p && styles.dropdownItemTextActive,
                ]}
              >
                {periodLabels[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 2. Top Segment Switcher (Overview / Muscles / Weight / PRs) */}
      <View style={styles.segmentBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setActiveTab('overview');
          }}
          style={[styles.segmentBtn, activeTab === 'overview' && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'overview' && styles.segmentBtnTextActive,
            ]}
          >
            {t('overview')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setActiveTab('weight');
          }}
          style={[styles.segmentBtn, activeTab === 'weight' && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'weight' && styles.segmentBtnTextActive,
            ]}
          >
            {language === 'uk' ? 'Вага' : 'Weight'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setActiveTab('muscles');
          }}
          style={[styles.segmentBtn, activeTab === 'muscles' && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'muscles' && styles.segmentBtnTextActive,
            ]}
          >
            {t('muscleGroups')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setActiveTab('prs');
          }}
          style={[styles.segmentBtn, activeTab === 'prs' && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'prs' && styles.segmentBtnTextActive,
            ]}
          >
            {t('prs')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ========================================================================= */}
        {/* VIEW 1: SCREEN 13 (OVERVIEW)                                              */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <View style={styles.tabContainer}>
            {/* 3 Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{workoutsCount}</Text>
                <Text style={styles.statLabel}>{t('workouts')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text
                  style={[
                    styles.statNumber,
                    { color: hasHistory ? colors.primary : '#8E9BAE', fontSize: 18 },
                  ]}
                >
                  {volumeDisplay}
                </Text>
                <Text style={styles.statLabel}>{t('volume')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{prsCount}</Text>
                <Text style={styles.statLabel}>{t('prs')}</Text>
              </View>
            </View>

            {/* Exercise Selector Carousel */}
            {availableExercises.length > 0 && (
              <View style={styles.exerciseSelectorWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.exerciseSelectorScroll}
                >
                  {availableExercises.map((ex) => {
                    const isSelected =
                      selectedExercise.name.toLowerCase() === ex.name.toLowerCase() ||
                      selectedExercise.id === ex.id;
                    return (
                      <Pressable
                        key={`${ex.source}-${ex.id || ex.name}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${ex.name}`}
                        onPress={() => {
                          hapticLight();
                          setSelectedExerciseId(ex.id || ex.name);
                        }}
                        style={[
                          styles.exercisePill,
                          isSelected && styles.exercisePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.exercisePillText,
                            isSelected && styles.exercisePillTextActive,
                          ]}
                        >
                          {ex.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Strength Chart Card (Screen 13) */}
            <View style={styles.strengthCard}>
              <View style={styles.strengthHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.strengthKicker}>STRENGTH</Text>
                  <Text numberOfLines={1} style={styles.strengthExerciseName}>
                    {exerciseName}
                  </Text>
                  {bestExerciseSetText ? (
                    <Text style={styles.strengthSubBest}>{bestExerciseSetText}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.strengthBigWeight}>{latestExerciseWeight}</Text>
                  {latestSession ? (
                    <Text style={styles.strengthEst1RM}>
                      Est. 1RM: {formatWeight(latestSession.est1RM)} {unitLabel}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Real Interactive Strength Graph or Empty State */}
              {sessionPoints.length > 0 ? (
                <>
                  <View style={styles.chartWrap}>
                    <RealStrengthGraph
                      data={sessionPoints}
                      width={chartWidth}
                      height={165}
                      unit={unitLabel}
                    />
                  </View>

                  <View style={styles.chartFooter}>
                    <Text style={styles.chartTrendPositive}>
                      ↗ Progression tracked
                    </Text>
                    <Text style={styles.chartFraction}>
                      {sessionPoints.length}{' '}
                      {sessionPoints.length === 1 ? 'session' : 'sessions'}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.chartEmptyWrap}>
                  <MaterialCommunityIcons
                    name="chart-line"
                    size={36}
                    color="#4B5565"
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={styles.chartEmptyTitle}>
                    No data for {exerciseName} yet
                  </Text>
                  <Text style={styles.chartEmptyBody}>
                    Log sets for {exerciseName} in your workouts to track your progressive overload curve.
                  </Text>
                </View>
              )}

              {/* Time Range Pills */}
              <View style={styles.timePillsRow}>
                {(['1M', '3M', '6M', 'ALL'] as const).map((t) => (
                  <Pressable
                    accessibilityRole="button"
                    key={t}
                    onPress={() => {
                      hapticLight();
                      setTimeRange(t);
                    }}
                    style={[styles.timePill, timeRange === t && styles.timePillActive]}
                  >
                    <Text
                      style={[
                        styles.timePillText,
                        timeRange === t && styles.timePillTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Quick Bodyweight Trend Preview Card */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Bodyweight Details"
              onPress={() => {
                hapticLight();
                setActiveTab('weight');
              }}
              style={[styles.previewSectionCard, { marginBottom: 16 }]}
            >
              <View style={styles.previewSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons
                    name="scale-bathroom"
                    size={18}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.previewSectionTitle}>
                    {language === 'uk' ? 'Динаміка ваги тіла' : 'Bodyweight Trend'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.previewWeightVal}>
                    {formatWeight(fromKg(bodyStats.currentWeight))} {unitLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#8E9BAE" style={{ marginLeft: 4 }} />
                </View>
              </View>

              <View style={{ marginTop: 4, pointerEvents: 'none' }}>
                <BodyWeightGraph
                  entries={bodyWeightEntries}
                  width={chartWidth}
                  height={130}
                  unit={unitLabel}
                  fromKg={fromKg}
                />
              </View>

              <View style={styles.previewWeightFooter}>
                <Text style={styles.previewWeightDelta}>
                  {bodyStats.deltaWeight > 0
                    ? `+${formatWeight(fromKg(bodyStats.deltaWeight))}`
                    : formatWeight(fromKg(bodyStats.deltaWeight))}{' '}
                  {unitLabel} ({periodLabels[period]})
                </Text>
                <Text style={styles.previewWeightLink}>
                  {language === 'uk' ? 'Детальніше →' : 'Details →'}
                </Text>
              </View>
            </Pressable>

            {/* Quick Muscle Groups Preview Card */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setActiveTab('muscles');
              }}
              style={styles.previewSectionCard}
            >
              <View style={styles.previewSectionHeader}>
                <Text style={styles.previewSectionTitle}>Muscle Progress</Text>
                <Ionicons name="chevron-forward" size={16} color="#8E9BAE" />
              </View>
              <View style={styles.muscleMiniBars}>
                {displayMuscles.slice(0, 3).map((m) => (
                  <View key={m.name} style={styles.muscleMiniRow}>
                    <Text style={styles.muscleMiniName}>{m.name}</Text>
                    <Text style={styles.muscleMiniVal}>
                      {formatVolume(m.volume)}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: SCREEN 14 (MUSCLE PROGRESS)                                       */}
        {/* ========================================================================= */}
        {activeTab === 'muscles' && (
          <View style={styles.tabContainer}>
            <View style={styles.muscleListCard}>
              {displayMuscles.map((muscle) => {
                const isSelected = selectedMuscle === muscle.name;
                const hasVolume = muscle.volume > 0;
                const maxVol = Math.max(1, ...displayMuscles.map((m) => m.volume));
                const barFillPercent = hasVolume
                  ? Math.max(15, Math.min(95, (muscle.volume / maxVol) * 100))
                  : 0;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${muscle.name} progress`}
                    key={muscle.name}
                    onPress={() => {
                      hapticLight();
                      setSelectedMuscle(muscle.name);
                    }}
                    style={[styles.muscleRow, isSelected && styles.muscleRowSelected]}
                  >
                    <View style={styles.muscleRowTop}>
                      <Text style={styles.muscleName}>{tm(muscle.name)}</Text>
                      <Text
                        style={[
                          styles.muscleDelta,
                          { color: hasVolume ? colors.primary : '#6C7A8E' },
                        ]}
                      >
                        {hasVolume
                          ? formatVolume(muscle.volume)
                          : language === 'uk'
                          ? 'Не треновано'
                          : 'Not trained'}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${barFillPercent}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Bottom Muscle Summary Card (Screen 14) */}
            <View style={styles.muscleSummaryCard}>
              <Text style={styles.summaryMuscleTitle}>{tm(selectedMuscle)}</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryMainVal}>
                    {selectedMuscleSets} {t('sets').toLowerCase()}
                  </Text>
                  <Text style={styles.summarySubVal}>
                    {selectedMuscleWorkouts.length} {t('workouts').toLowerCase()}
                  </Text>
                </View>

                <View style={styles.summaryColRight}>
                  <Text style={styles.summaryMainVal}>
                    {formatVolume(selectedMuscleVolume)} {t('volume').toLowerCase()}
                  </Text>
                  <Text style={styles.summarySubVal}>
                    {hasHistory
                      ? language === 'uk'
                        ? 'Активний цикл'
                        : 'Active cycle'
                      : language === 'uk'
                      ? 'Ще немає даних'
                      : 'No logs yet'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW: BODYWEIGHT TRACKER & AI CORRELATION                                 */}
        {/* ========================================================================= */}
        {activeTab === 'weight' && (
          <View style={styles.tabContainer}>
            {/* 1. Summary Stat Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {formatWeight(fromKg(bodyStats.currentWeight))}
                </Text>
                <Text style={styles.statLabel}>
                  {language === 'uk' ? 'Поточна вага' : 'Current Weight'} ({unitLabel})
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text
                  style={[
                    styles.statNumber,
                    bodyStats.deltaWeight !== 0 && {
                      color: bodyStats.deltaWeight < 0 ? '#38BDF8' : colors.primary,
                    },
                  ]}
                >
                  {bodyStats.deltaWeight > 0 ? `+${bodyStats.deltaWeight}` : bodyStats.deltaWeight}
                </Text>
                <Text style={styles.statLabel}>
                  {language === 'uk' ? 'Динаміка' : 'Change'} ({period})
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{bodyStats.entriesCount}</Text>
                <Text style={styles.statLabel}>
                  {language === 'uk' ? 'Зважувань' : 'Logs'}
                </Text>
              </View>
            </View>

            {/* 2. Weight Chart Card */}
            <View style={styles.strengthCard}>
              <View style={styles.strengthHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.strengthKicker}>
                    {language === 'uk' ? 'ДИНАМІКА ВАГИ' : 'BODYWEIGHT TREND'}
                  </Text>
                  <Text numberOfLines={1} style={styles.strengthExerciseName}>
                    {profile.goal}
                  </Text>
                  <Text style={styles.strengthSubBest}>
                    {language === 'uk' ? 'Цільовий тренд' : 'Target Pace'}:{' '}
                    {profile.goal === 'Lose Fat'
                      ? '↓ -0.5 kg/тиждень'
                      : profile.goal === 'Build Muscle'
                      ? '↑ +0.3 kg/тиждень'
                      : '↔ Стабільна вага'}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Log Bodyweight"
                  onPress={() => {
                    hapticLight();
                    setLogWeightModalVisible(true);
                  }}
                  style={styles.logWeightHeaderBtn}
                >
                  <Ionicons name="add" size={16} color="#0B0D0F" style={{ marginRight: 2 }} />
                  <Text style={styles.logWeightHeaderBtnText}>
                    {language === 'uk' ? 'Запис' : 'Log'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.chartWrap}>
                <BodyWeightGraph
                  entries={bodyWeightEntries}
                  width={chartWidth + 20}
                  height={175}
                  unit={unitLabel}
                  fromKg={fromKg}
                />
              </View>
            </View>

            {/* 3. AI Correlation Insight Card */}
            <View style={styles.aiInsightCard}>
              <View style={styles.aiInsightHeader}>
                <View style={styles.aiInsightBadge}>
                  <MaterialCommunityIcons
                    name="brain"
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.aiInsightBadgeText}>SPOT AI • CORRELATION</Text>
                </View>
                <View style={[styles.aiStatusPill, { borderColor: aiAnalysis.badgeColor }]}>
                  <Text style={[styles.aiStatusPillText, { color: aiAnalysis.badgeColor }]}>
                    {aiAnalysis.badge}
                  </Text>
                </View>
              </View>

              <Text style={styles.aiInsightTitle}>{aiAnalysis.title}</Text>
              <Text style={styles.aiInsightBody}>{aiAnalysis.insight}</Text>

              <View style={styles.aiRecoBox}>
                <Ionicons
                  name="bulb-outline"
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <Text style={styles.aiRecoText}>{aiAnalysis.recommendation}</Text>
              </View>
            </View>

            {/* 4. Recent Weigh-ins List */}
            <View style={styles.weighInListSection}>
              <View style={styles.weighInListHeader}>
                <Text style={styles.strengthKicker}>
                  {language === 'uk' ? 'ІСТОРІЯ ЗВАЖУВАНЬ' : 'WEIGH-IN LOGS'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setLogWeightModalVisible(true);
                  }}
                >
                  <Text style={styles.addWeightLink}>
                    + {language === 'uk' ? 'Додати вагу' : 'Add Weight'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.weighInListCard}>
                {bodyWeightEntries.slice(-5).reverse().map((entry, idx) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.weighInRow,
                      idx === Math.min(4, bodyWeightEntries.length - 1) && styles.weighInRowLast,
                    ]}
                  >
                    <View style={styles.weighInDateWrap}>
                      <MaterialCommunityIcons
                        name="calendar-check"
                        size={18}
                        color="#8E9BAE"
                        style={{ marginRight: 10 }}
                      />
                      <View>
                        <Text style={styles.weighInDateText}>
                          {new Date(entry.date).toLocaleDateString(
                            language === 'uk' ? 'uk-UA' : 'en-US',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            }
                          )}
                        </Text>
                        {entry.note ? (
                          <Text style={styles.weighInNote}>{entry.note}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.weighInRight}>
                      <Text style={styles.weighInValue}>
                        {formatWeight(fromKg(entry.weightKg))} {unitLabel}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => {
                          hapticLight();
                          deleteBodyWeightEntry(entry.id);
                        }}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color="#5A687A" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: SCREEN 15 (PERSONAL RECORDS)                                      */}
        {/* ========================================================================= */}
        {activeTab === 'prs' && (
          <View style={styles.tabContainer}>
            {allHistoryPrs.length > 0 ? (
              <View style={styles.prsList}>
                {allHistoryPrs.map((item) => (
                  <View key={item.id} style={styles.prCard}>
                    <View style={styles.prCardIconWrap}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={20}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.prCardBody}>
                      <Text style={styles.prCardName}>{item.name}</Text>
                      <Text style={styles.prCardDate}>{item.date}</Text>
                    </View>

                    <View style={styles.prCardRight}>
                      <Text style={styles.prCardWeight}>{item.value}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#6C7A8E" />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.prEmptyWrap}>
                <View style={styles.prEmptyIconWrap}>
                  <MaterialCommunityIcons name="trophy-outline" size={40} color="#4B5565" />
                </View>
                <Text style={styles.prEmptyTitle}>No personal records yet</Text>
                <Text style={styles.prEmptyBody}>
                  Finish your first workout to establish your baseline records.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <LogWeightModal
        visible={logWeightModalVisible}
        onClose={() => setLogWeightModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#14181F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownBtnText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 100,
    backgroundColor: '#161B24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  dropdownItemText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#12161D',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#1A212B',
  },
  segmentBtnText: {
    color: '#6C7A8E',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  tabContainer: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#12161D',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseSelectorWrap: {
    marginBottom: 12,
  },
  exerciseSelectorScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  exercisePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#14181F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  exercisePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  exercisePillText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  exercisePillTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  strengthCard: {
    backgroundColor: '#12161D',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  strengthKicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  strengthExerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  strengthBigWeight: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  strengthSubBest: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  strengthEst1RM: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  chartWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  chartTrendPositive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chartFraction: {
    color: '#6C7A8E',
    fontSize: 12,
    fontWeight: '700',
  },
  chartEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  chartEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  chartEmptyBody: {
    color: '#8E9BAE',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
    marginBottom: 12,
  },
  timePillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  timePill: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161B24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillActive: {
    backgroundColor: colors.primary,
  },
  timePillText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
  },
  timePillTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  previewSectionCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  previewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  muscleMiniBars: {
    gap: 8,
  },
  muscleMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  muscleMiniName: {
    color: '#8E9BAE',
    fontSize: 13,
  },
  muscleMiniVal: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  previewWeightVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  previewWeightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  previewWeightDelta: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  previewWeightLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  muscleListCard: {
    backgroundColor: '#12161D',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
    gap: 16,
  },
  muscleRow: {
    paddingVertical: 4,
  },
  muscleRowSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  muscleRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  muscleName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  muscleDelta: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A212B',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  muscleSummaryCard: {
    backgroundColor: '#12161D',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  summaryMuscleTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    gap: 4,
  },
  summaryColRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  summaryMainVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  summarySubVal: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  prsList: {
    gap: 10,
  },
  prCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  prCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prCardBody: {
    flex: 1,
  },
  prCardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  prCardDate: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  prCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prCardWeight: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  prEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#12161D',
    borderRadius: 22,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  prEmptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A212B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  prEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  prEmptyBody: {
    color: '#8E9BAE',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  logWeightHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  logWeightHeaderBtnText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '800',
  },
  aiInsightCard: {
    backgroundColor: '#131821',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    marginBottom: 16,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiInsightBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  aiStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  aiStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiInsightTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  aiInsightBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  aiRecoBox: {
    flexDirection: 'row',
    backgroundColor: '#1A222E',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  aiRecoText: {
    flex: 1,
    color: '#E0E0E0',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  weighInListSection: {
    marginBottom: 24,
  },
  weighInListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  addWeightLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  weighInListCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  weighInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  weighInRowLast: {
    borderBottomWidth: 0,
  },
  weighInDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  weighInDateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  weighInNote: {
    color: '#8E9BAE',
    fontSize: 12,
    marginTop: 1,
  },
  weighInRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weighInValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  deleteBtn: {
    padding: 4,
  },
});
