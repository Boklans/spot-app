import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  type ScrollViewInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { getAllTimePersonalRecords } from '@/lib/personalRecords';
import {
  calculateMuscleProgress,
  calculateProgressSummary,
  getAvailableExercisesForProgress,
  normalizeMuscleCategory,
  type ProgressPeriod,
} from '@/lib/progressCalculator';
import { convertVolumeToActiveUnit, formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

type ActiveViewTab = 'overview' | 'muscles' | 'weight' | 'prs';

const CORE_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

export default function Progress() {
  const { t, tm, te, language } = useI18n();
  const { unit, unitLabel, formatVolume, fromKg } = useWeightUnit();
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
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [logWeightModalVisible, setLogWeightModalVisible] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const program = useProgramStore((state) => state.program);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  // Reload history and bodyweight entries whenever Analytics tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadBodyWeightHistory();
    }, [loadHistory, loadBodyWeightHistory])
  );

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 80, 320);

  const hasHistory = history.length > 0;
  const realSummary = calculateProgressSummary(history, period);

  const workoutsCount = hasHistory ? realSummary.workouts : 0;
  const periodFilteredWorkouts = React.useMemo(() => {
    if (period === 'ALL') return history;
    const days = period === '7D' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.filter((w) => new Date(w.completedAt || w.startedAt).getTime() >= cutoff);
  }, [history, period]);

  const totalCompletedSets = periodFilteredWorkouts.reduce(
    (sum, w) => sum + (w.totalSets || w.exercises.reduce((exSum, e) => exSum + e.sets.length, 0)),
    0
  );

  // Deduplicated all-time Personal Records per exercise across workout history + baseline lifts
  const allTimeRecords = React.useMemo(
    () => getAllTimePersonalRecords(history, profile.baselineLifts),
    [history, profile.baselineLifts]
  );

  const allHistoryPrs = React.useMemo(() => {
    return allTimeRecords.map((rec) => {
      const dispWeight = formatWeight(fromKg(rec.weightKg));
      const disp1RM = formatWeight(fromKg(rec.estimated1RMKg));
      const repsUnit = language === 'uk' ? 'повт' : 'reps';

      let valueLabel = '';
      let subDetail = '';
      if (rec.isBodyweight) {
        valueLabel = `${rec.reps} ${repsUnit}`;
        subDetail = language === 'uk' ? 'Власна вага' : 'Bodyweight';
      } else if (rec.isAssisted) {
        valueLabel = `-${dispWeight} ${unitLabel} × ${rec.reps}`;
        subDetail = language === 'uk' ? 'Мінімальна противага' : 'Min assistance';
      } else if (rec.reps > 1) {
        valueLabel = `${dispWeight} ${unitLabel} × ${rec.reps}`;
        subDetail = `1RM: ${disp1RM} ${unitLabel}`;
      } else {
        valueLabel = `${dispWeight} ${unitLabel}`;
        subDetail = language === 'uk' ? 'Базовий максимум' : 'Baseline max';
      }

      const dateLabel = rec.achievedAt
        ? new Date(rec.achievedAt).toLocaleDateString(
            language === 'uk' ? 'uk-UA' : 'en-US',
            { month: 'short', day: 'numeric' }
          )
        : language === 'uk'
          ? 'Базовий показник'
          : 'Baseline';

      return {
        id: rec.id,
        exerciseId: rec.exerciseId,
        name: rec.exerciseName,
        value: valueLabel,
        subDetail,
        date: dateLabel,
        isNewPr: rec.isNewPr,
        icon: (rec.isNewPr ? 'trophy' : 'dumbbell') as 'trophy' | 'dumbbell',
      };
    });
  }, [allTimeRecords, fromKg, unitLabel, language]);

  const prsCount = hasHistory
    ? realSummary.personalRecords > 0
      ? realSummary.personalRecords
      : allHistoryPrs.length
    : allHistoryPrs.length;

  // Real muscle group calculation (normalized across Quads/Hamstrings/Glutes -> Legs, Biceps/Triceps -> Arms)
  const realMuscles = calculateMuscleProgress(history, period);
  const displayMuscles = CORE_MUSCLES.map((muscleName) => {
    const found = realMuscles.find(
      (m) => m.name.toLowerCase() === muscleName.toLowerCase()
    );
    return {
      name: muscleName,
      volume: found?.volume ?? 0,
      changePercent: found?.changePercent ?? 0,
    };
  });

  // Calculate detailed stats for selected muscle using normalized muscle categories
  const selectedMuscleWorkouts = periodFilteredWorkouts.filter((w) =>
    w.exercises.some(
      (e) => normalizeMuscleCategory(e.muscleGroup).toLowerCase() === selectedMuscle.toLowerCase()
    )
  );
  const selectedMuscleSets = selectedMuscleWorkouts.reduce(
    (total, w) =>
      total +
      w.exercises
        .filter(
          (e) => normalizeMuscleCategory(e.muscleGroup).toLowerCase() === selectedMuscle.toLowerCase()
        )
        .reduce((sum, e) => sum + e.sets.length, 0),
    0
  );
  const selectedMuscleVolume = selectedMuscleWorkouts.reduce(
    (total, w) =>
      total +
      w.exercises
        .filter(
          (e) => normalizeMuscleCategory(e.muscleGroup).toLowerCase() === selectedMuscle.toLowerCase()
        )
        .reduce((sum, e) => sum + e.sets.reduce((sSum, s) => sSum + s.volume, 0), 0),
    0
  );

  const availableExercises = getAvailableExercisesForProgress(program, history);

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
  const targetNameNormalized = exerciseName.toLowerCase().trim();

  // Filter workouts by selected timeRange ('1M' | '3M' | '6M' | 'ALL') and exact exerciseName match
  const exerciseWorkouts = React.useMemo(() => {
    const rangeDaysMap: Record<'1M' | '3M' | '6M' | 'ALL', number | null> = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      ALL: null,
    };
    const daysLimit = rangeDaysMap[timeRange];
    const cutoffMs = daysLimit ? Date.now() - daysLimit * 24 * 60 * 60 * 1000 : null;

    return history
      .filter((w) => {
        if (cutoffMs) {
          const tMs = new Date(w.completedAt || w.startedAt).getTime();
          if (tMs < cutoffMs) return false;
        }
        return w.exercises.some((e) => {
          const eName = (e.exerciseName || '').toLowerCase().trim();
          if (eName && targetNameNormalized) {
            return eName === targetNameNormalized;
          }
          return Boolean(selectedExercise.id && e.exerciseId === selectedExercise.id);
        });
      })
      .sort(
        (a, b) =>
          new Date(a.completedAt || a.startedAt).getTime() -
          new Date(b.completedAt || b.startedAt).getTime()
      );
  }, [history, timeRange, targetNameNormalized, selectedExercise.id]);

  const rawSessionPoints: StrengthSessionPoint[] = exerciseWorkouts
    .map((w, index) => {
      const ex = w.exercises.find((e) => {
        const eName = (e.exerciseName || '').toLowerCase().trim();
        if (eName && targetNameNormalized) {
          return eName === targetNameNormalized;
        }
        return Boolean(selectedExercise.id && e.exerciseId === selectedExercise.id);
      });

      const sets = ex?.sets || [];
      const isBw = sets.length > 0 && sets.every((s) => (s.weight || 0) === 0);
      let bestWeight = 0;
      let bestReps = 0;
      let totalVol = 0;

      for (const s of sets) {
        const sw = s.weight || 0;
        const sr = s.reps || 0;
        totalVol += sw * sr;
        if (isBw) {
          if (sr > bestReps) bestReps = sr;
        } else if (sw > bestWeight || (sw === bestWeight && sr > bestReps)) {
          bestWeight = sw;
          bestReps = sr;
        }
      }

      const d = new Date(w.completedAt || w.startedAt);
      const isToday = new Date().toDateString() === d.toDateString();
      const formattedDate = isToday
        ? language === 'uk'
          ? 'Сьогодні'
          : 'Today'
        : !isNaN(d.getTime())
          ? d.toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US', {
              month: 'short',
              day: 'numeric',
            })
          : `W${index + 1}`;

      const est1RM = isBw ? bestReps : Math.round(bestWeight * (1 + bestReps / 30));

      return {
        date: w.completedAt || w.startedAt,
        formattedDate,
        weight: isBw ? bestReps : fromKg(bestWeight),
        reps: bestReps,
        volume: convertVolumeToActiveUnit(totalVol, unit),
        est1RM: isBw ? bestReps : fromKg(est1RM),
      };
    })
    .filter((p) => p.weight > 0 || p.reps > 0);

  // If no workouts recorded yet, integrate baseline calibration from global state
  const sessionPoints: StrengthSessionPoint[] = React.useMemo(() => {
    if (rawSessionPoints.length > 0) return rawSessionPoints;

    let baselineKg: number | undefined;
    const nameLower = exerciseName.toLowerCase().trim();
    if (nameLower === 'bench press' || nameLower === 'barbell bench press') {
      baselineKg = profile.baselineLifts?.benchPressKg;
    } else if (nameLower === 'barbell squat' || nameLower === 'squat') {
      baselineKg = profile.baselineLifts?.squatKg;
    } else if (nameLower === 'deadlift' || nameLower === 'barbell deadlift') {
      baselineKg = profile.baselineLifts?.deadliftKg;
    } else if (nameLower === 'overhead press' || nameLower === 'barbell overhead press') {
      baselineKg = profile.baselineLifts?.overheadPressKg;
    }

    if (baselineKg && baselineKg > 0) {
      const dispWeight = Math.round(fromKg(baselineKg) * 10) / 10;
      return [
        {
          date: new Date().toISOString(),
          formattedDate: language === 'uk' ? 'База' : 'Baseline',
          weight: dispWeight,
          reps: 5,
          volume: convertVolumeToActiveUnit(baselineKg * 5 * 3, unit),
          est1RM: dispWeight,
        },
      ];
    }

    return [];
  }, [rawSessionPoints, exerciseName, profile.baselineLifts, fromKg, unit, language]);

  const latestSession =
    sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1] : null;

  const isSelectedExerciseBw = React.useMemo(() => {
    const rec = allTimeRecords.find(
      (r) => r.exerciseName.toLowerCase().trim() === targetNameNormalized
    );
    return Boolean(rec?.isBodyweight);
  }, [allTimeRecords, targetNameNormalized]);

  const latestExerciseWeight = latestSession
    ? isSelectedExerciseBw
      ? `${latestSession.reps} ${language === 'uk' ? 'повт' : 'reps'}`
      : `${formatWeight(latestSession.weight)} ${unitLabel}`
    : `-- ${unitLabel}`;

  const bestExerciseSetText = latestSession
    ? isSelectedExerciseBw
      ? `${language === 'uk' ? 'Макс. повторень' : 'Best reps'}: ${latestSession.reps}`
      : `${language === 'uk' ? 'Найкращий сет' : 'Best'}: ${formatWeight(latestSession.weight)} ${unitLabel} × ${latestSession.reps}`
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

  const effectiveWeightEntries = React.useMemo(() => {
    if (bodyWeightEntries && bodyWeightEntries.length > 0) {
      return bodyWeightEntries;
    }
    const w = profile.weightKg || 70;
    return [
      {
        id: 'baseline-today',
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        weightKg: w,
        note: 'Baseline',
      },
    ];
  }, [bodyWeightEntries, profile.weightKg]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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

      {/* 2. Top Segment Switcher (Overview / Weight / Muscles / PRs) */}
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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            router.push('/history');
          }}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#12161D',
              borderWidth: 1,
              borderColor: 'rgba(200, 255, 61, 0.25)',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 11,
              marginBottom: 14,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: 'rgba(200, 255, 61, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>
                {language === 'uk' ? 'Журнал тренувань та «Тоді vs Зараз»' : 'Full Workout Log & Then vs Now'}
              </Text>
              <Text style={{ color: '#8E9BAE', fontSize: 11.5, marginTop: 1 }}>
                {language === 'uk'
                  ? `Усі сесії (${history.length}) і порівняння робочих ваг зі стартом`
                  : `All sessions (${history.length}) & working weight comparison`}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        {/* ========================================================================= */}
        {/* VIEW 1: OVERVIEW                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <View style={styles.tabContainer}>
            {hasHistory ? (
              <>
                {/* 3 Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                      {workoutsCount}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {t('workouts')}
                    </Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                      {totalCompletedSets}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {t('sets')}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      hapticLight();
                      setActiveTab('prs');
                    }}
                    style={styles.statCard}
                  >
                    <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                      {prsCount}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {t('prs')}
                    </Text>
                  </Pressable>
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
                              {te(ex.name)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Strength Chart Card */}
                <View style={styles.strengthCard}>
                  <View style={styles.strengthHeader}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.strengthKicker}>
                        {language === 'uk' ? 'СИЛОВИЙ ПРОГРЕС' : 'STRENGTH'}
                      </Text>
                      <Text numberOfLines={1} style={styles.strengthExerciseName}>
                        {te(exerciseName)}
                      </Text>
                      {bestExerciseSetText ? (
                        <Text style={styles.strengthSubBest}>{bestExerciseSetText}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.strengthBigWeight}>{latestExerciseWeight}</Text>
                      {latestSession && !isSelectedExerciseBw ? (
                        <Text style={styles.strengthEst1RM}>
                          1RM: {formatWeight(latestSession.est1RM)} {unitLabel}
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
                          unit={isSelectedExerciseBw ? (language === 'uk' ? 'ПОВТ' : 'REPS') : unitLabel}
                        />
                      </View>

                      <View style={styles.chartFooter}>
                        <Text style={styles.chartTrendPositive}>
                          {language === 'uk' ? '↗ Динаміка по сесіях' : '↗ Progression tracked'}
                        </Text>
                        <Text style={styles.chartFraction}>
                          {sessionPoints.length}{' '}
                          {language === 'uk'
                            ? sessionPoints.length === 1
                              ? 'сесія'
                              : sessionPoints.length < 5
                                ? 'сесії'
                                : 'сесій'
                            : sessionPoints.length === 1
                              ? 'session'
                              : 'sessions'}
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
                        {language === 'uk'
                          ? `Ще немає записів для «${te(exerciseName)}»`
                          : `No data for ${exerciseName} yet`}
                      </Text>
                      <Text style={styles.chartEmptyBody}>
                        {language === 'uk'
                          ? `Виконайте підходи у вправі «${te(exerciseName)}», щоб побудувати графік прогресії.`
                          : `Log sets for ${exerciseName} in your workouts to track your progressive overload curve.`}
                      </Text>
                    </View>
                  )}

                  {/* Time Range Pills */}
                  <View style={styles.timePillsRow}>
                    {(['1M', '3M', '6M', 'ALL'] as const).map((rangeKey) => (
                      <Pressable
                        accessibilityRole="button"
                        key={rangeKey}
                        onPress={() => {
                          hapticLight();
                          setTimeRange(rangeKey);
                        }}
                        style={[styles.timePill, timeRange === rangeKey && styles.timePillActive]}
                      >
                        <Text
                          style={[
                            styles.timePillText,
                            timeRange === rangeKey && styles.timePillTextActive,
                          ]}
                        >
                          {rangeKey}
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
                    scrollRef.current?.scrollTo({ y: 0, animated: false });
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
                    scrollRef.current?.scrollTo({ y: 0, animated: false });
                  }}
                  style={styles.previewSectionCard}
                >
                  <View style={styles.previewSectionHeader}>
                    <Text style={styles.previewSectionTitle}>
                      {language === 'uk' ? 'Обʼєм по групах мʼязів' : 'Muscle Progress'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#8E9BAE" />
                  </View>
                  <View style={styles.muscleMiniBars}>
                    {displayMuscles
                      .slice()
                      .sort((a, b) => b.volume - a.volume)
                      .slice(0, 3)
                      .map((m) => (
                        <View key={m.name} style={styles.muscleMiniRow}>
                          <Text style={styles.muscleMiniName}>{tm(m.name)}</Text>
                          <Text style={styles.muscleMiniVal}>
                            {formatVolume(m.volume)}
                          </Text>
                        </View>
                      ))}
                  </View>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyGlowRing}>
                  <View style={styles.emptyIconBadge}>
                    <MaterialCommunityIcons name="lightning-bolt" size={36} color={colors.primary} />
                  </View>
                </View>

                <Text style={styles.emptyTitle}>
                  {language === 'uk' ? 'ВАШ ПРОГРЕС ПОЧИНАЄТЬСЯ ТУТ' : 'YOUR PROGRESS STARTS HERE'}
                </Text>

                <Text style={styles.emptySubtitle}>
                  {language === 'uk'
                    ? 'Завершіть своє перше тренування, щоб відстежувати зростання сили та тоннажу.'
                    : 'Complete your first workout to start tracking your strength and volume.'}
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

                <View style={styles.emptyFeatureList}>
                  <View style={styles.emptyFeatureRow}>
                    <View style={styles.emptyFeatureDot} />
                    <Text style={styles.emptyFeatureText}>
                      {language === 'uk'
                        ? 'Динаміка сили та розрахунковий 1RM'
                        : 'Strength curves & estimated 1RM'}
                    </Text>
                  </View>
                  <View style={styles.emptyFeatureRow}>
                    <View style={styles.emptyFeatureDot} />
                    <Text style={styles.emptyFeatureText}>
                      {language === 'uk'
                        ? 'Аналітика робочого об’єму по м’язових групах'
                        : 'Volume analytics across muscle groups'}
                    </Text>
                  </View>
                  <View style={styles.emptyFeatureRow}>
                    <View style={styles.emptyFeatureDot} />
                    <Text style={styles.emptyFeatureText}>
                      {language === 'uk'
                        ? 'Автоматична фіксація особистих рекордів (PR)'
                        : 'Automatic Personal Record (PR) recognition'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: MUSCLE PROGRESS                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'muscles' && (
          <View style={styles.tabContainer}>
            {hasHistory ? (
              <>
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

                {/* Bottom Muscle Summary Card */}
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
                        {periodLabels[period]}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyGlowRing}>
                  <View style={styles.emptyIconBadge}>
                    <MaterialCommunityIcons name="arm-flex" size={34} color={colors.primary} />
                  </View>
                </View>

                <Text style={styles.emptyTitle}>
                  {language === 'uk' ? 'ВАШ ПРОГРЕС ПОЧИНАЄТЬСЯ ТУТ' : 'YOUR PROGRESS STARTS HERE'}
                </Text>

                <Text style={styles.emptySubtitle}>
                  {language === 'uk'
                    ? 'Завершіть своє перше тренування, щоб відстежувати навантаження на м’язи.'
                    : 'Complete your first workout to start tracking your muscle group balance.'}
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
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: BODYWEIGHT TRACKER                                                */}
        {/* ========================================================================= */}
        {activeTab === 'weight' && (
          <View style={styles.tabContainer}>
            {/* 1. Summary Stat Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {formatWeight(fromKg(profile.weightKg || bodyStats.currentWeight))}
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
                      color: colors.primary,
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
                <Text style={styles.statNumber}>{Math.max(1, bodyStats.entriesCount)}</Text>
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
                    {profile.goal === 'Lose Fat'
                      ? language === 'uk'
                        ? 'Зниження ваги'
                        : 'Lose Fat'
                      : profile.goal === 'Get Stronger'
                        ? language === 'uk'
                          ? 'Розвиток сили'
                          : 'Get Stronger'
                        : language === 'uk'
                          ? 'Набір мʼязів'
                          : 'Build Muscle'}
                  </Text>
                  <Text style={styles.strengthSubBest}>
                    {language === 'uk' ? 'Орієнтир темпу' : 'Target Pace'}:{' '}
                    {profile.goal === 'Lose Fat'
                      ? '↓ -0.5 kg/тиждень'
                      : profile.goal === 'Build Muscle'
                        ? '↑ +0.25 kg/тиждень'
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
                  entries={effectiveWeightEntries}
                  width={chartWidth + 20}
                  height={175}
                  unit={unitLabel}
                  fromKg={fromKg}
                />
              </View>
            </View>

            {/* 3. Factual Weight & Strength Trend Card */}
            <View style={styles.aiInsightCard}>
              <View style={styles.aiInsightHeader}>
                <View style={styles.aiInsightBadge}>
                  <Ionicons
                    name="analytics-outline"
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.aiInsightBadgeText}>
                    {language === 'uk' ? 'СПІВВІДНОШЕННЯ ВАГИ ТА СИЛИ' : 'WEIGHT & STRENGTH TREND'}
                  </Text>
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
                  name="checkmark-circle-outline"
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
        {/* VIEW 4: PERSONAL RECORDS (ALL-TIME BESTS PER EXERCISE)                    */}
        {/* ========================================================================= */}
        {activeTab === 'prs' && (
          <View style={styles.tabContainer}>
            {allHistoryPrs.length > 0 ? (
              <View style={styles.prsList}>
                {allHistoryPrs.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${te(item.name)}: ${item.value}`}
                    onPress={() => {
                      hapticLight();
                      setSelectedExerciseId(item.name);
                      setActiveTab('overview');
                    }}
                    style={styles.prCard}
                  >
                    <View
                      style={[
                        styles.prCardIconWrap,
                        item.isNewPr && { backgroundColor: 'rgba(255, 209, 48, 0.14)' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={20}
                        color={item.isNewPr ? '#FFD130' : colors.primary}
                      />
                    </View>

                    <View style={styles.prCardBody}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={styles.prCardName}>
                          {te(item.name)}
                        </Text>
                        {item.isNewPr && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prBadgeText}>PR</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.prCardDate}>
                        {item.date}
                        {item.subDetail ? ` · ${item.subDetail}` : ''}
                      </Text>
                    </View>

                    <View style={styles.prCardRight}>
                      <Text style={styles.prCardWeight}>{item.value}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#6C7A8E" />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyGlowRing}>
                  <View style={styles.emptyIconBadge}>
                    <MaterialCommunityIcons name="trophy-outline" size={34} color={colors.primary} />
                  </View>
                </View>

                <Text style={styles.emptyTitle}>
                  {language === 'uk' ? 'ВАШ ПРОГРЕС ПОЧИНАЄТЬСЯ ТУТ' : 'YOUR PROGRESS STARTS HERE'}
                </Text>

                <Text style={styles.emptySubtitle}>
                  {language === 'uk'
                    ? 'Завершіть своє перше тренування, щоб зафіксувати особисті максимуми у вправах.'
                    : 'Complete your first workout to start tracking your personal records.'}
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
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
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
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 24,
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
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#12161D',
    borderRadius: 14,
    marginHorizontal: 24,
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
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
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
    minHeight: 84,
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statLabel: {
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    fontWeight: '600',
  },
  exercisePillTextActive: {
    color: '#0B0D0F',
    fontWeight: '700',
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
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  strengthExerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  strengthBigWeight: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  strengthSubBest: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  strengthEst1RM: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '500',
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
    fontWeight: '600',
  },
  chartFraction: {
    color: '#6C7A8E',
    fontSize: 12,
    fontWeight: '600',
  },
  chartEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  chartEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
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
    fontWeight: '600',
  },
  timePillTextActive: {
    color: '#0B0D0F',
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  previewWeightVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  previewWeightLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  muscleListCard: {
    backgroundColor: '#12161D',
    borderRadius: 22,
    padding: 18,
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
    fontWeight: '600',
  },
  muscleDelta: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    fontWeight: '700',
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summarySubVal: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
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
    marginRight: 8,
  },
  prCardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    flexShrink: 1,
  },
  prBadge: {
    backgroundColor: 'rgba(255, 209, 48, 0.18)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 48, 0.4)',
  },
  prBadgeText: {
    color: '#FFD130',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  prCardDate: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '500',
  },
  prCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prCardWeight: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  aiInsightTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  emptyCard: {
    backgroundColor: '#12161D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.18)',
    padding: 26,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyGlowRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.22)',
  },
  emptyIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  emptyCtaBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 28,
    width: '100%',
  },
  emptyCtaBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emptyCtaBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptyFeatureList: {
    width: '100%',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
    gap: 10,
  },
  emptyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyFeatureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  emptyFeatureText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '500',
  },
});
