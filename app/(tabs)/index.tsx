import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SpotCoachCard } from '@/components/home/SpotCoachCard';
import { AnatomyPreview } from '@/components/progress/AnatomyPreview';
import { Screen } from '@/components/ui/Screen';
import { HomeSkeleton } from '@/components/ui/Skeleton';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { generateCoachInsight } from '@/lib/coachEngine';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { countWorkoutsThisWeek, getStartOfWeek } from '@/lib/progressCalculator';
import { findLatestExerciseSets, inferEquipmentFromName, recommendWeight } from '@/lib/adaptiveProgression';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { getSessionProgress, getSessionSummary, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding } from '@/store/workoutStore';

export default function Home() {
  const { t, tm, te, tw, language } = useI18n();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const { formatVolume, formatWithUnit } = useWeightUnit();
  const [name, setName] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const profile = useUserProfileStore((state) => state.profile);
  const program = useProgramStore((state) => state.program);
  const deloadActive = useProgramStore((state) => state.deloadActive);
  const applyDeloadWeek = useProgramStore((state) => state.applyDeloadWeek);
  const restoreFromDeload = useProgramStore((state) => state.restoreFromDeload);
  const programHydrated = useProgramStore((state) => state.hydrated);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const initializeSession = useWorkoutSessionStore((state) => state.initializeSession);
  const discardSession = useWorkoutSessionStore((state) => state.discardSession);
  const progress = useProgramProgressStore((state) => state.progress);
  const setNextWorkout = useProgramProgressStore((state) => state.setNextWorkout);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const historyHydrated = useWorkoutHistoryStore((state) => state.hydrated);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchModalMode, setSwitchModalMode] = useState<'switch' | 'start'>('switch');
  const [startingWorkout, setStartingWorkout] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);

  // Focus synchronization (skips redundant AsyncStorage re-reads once stores are hydrated — P2-04)
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
      if (!name) {
        loadOnboarding().then((data) => {
          if (data?.name) setName(data.name);
        });
      }
      if (!useWorkoutSessionStore.getState().hydrated) {
        void useWorkoutSessionStore.getState().hydrateSession();
      }
      if (!useUserProfileStore.getState().hydrated) {
        void useUserProfileStore.getState().loadProfile();
      }
      if (!useProgramStore.getState().hydrated) {
        void useProgramStore.getState().getOrLoadProgram();
      }
      if (!useWorkoutHistoryStore.getState().hydrated) {
        void useWorkoutHistoryStore.getState().loadHistory();
      }
    }, [name])
  );

  const nextWorkout = program && program.workouts?.length ? getScheduledWorkout(program, progress) : null;

  const currentHour = new Date().getHours();
  const greetingPrefix =
    language === 'uk'
      ? currentHour >= 5 && currentHour < 12
        ? 'Доброго ранку'
        : currentHour >= 12 && currentHour < 18
        ? 'Доброго дня'
        : currentHour >= 18 && currentHour < 23
        ? 'Доброго вечора'
        : 'Доброї ночі'
      : currentHour >= 5 && currentHour < 12
      ? 'Good morning'
      : currentHour >= 12 && currentHour < 18
      ? 'Good afternoon'
      : currentHour >= 18 && currentHour < 23
      ? 'Good evening'
      : 'Good night';

  // Weekly tracker data
  const completedWorkoutsThisWeek = countWorkoutsThisWeek(history);
  const targetWorkouts = Math.max(1, program?.daysPerWeek || 3);

  const DAY_LABELS =
    language === 'uk'
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const startOfWeek = getStartOfWeek();
  const weekDayStatuses = DAY_LABELS.map((label, idx) => {
    const targetDayStart = new Date(startOfWeek);
    targetDayStart.setDate(targetDayStart.getDate() + idx);
    targetDayStart.setHours(0, 0, 0, 0);

    const targetDayEnd = new Date(targetDayStart);
    targetDayEnd.setHours(23, 59, 59, 999);

    const isCompleted = (history || []).some((w) => {
      if (w.isPartial) return false;
      const dateStr = w.completedAt || w.startedAt;
      if (!dateStr) return false;
      const workoutTime = new Date(dateStr).getTime();
      return workoutTime >= targetDayStart.getTime() && workoutTime <= targetDayEnd.getTime();
    });

    const isToday = idx === (new Date().getDay() + 6) % 7;

    return {
      label,
      completed: isCompleted,
      isToday,
    };
  });

  // Determine user states strictly:
  // STATE B: Active session exists and is NOT completed
  const isSessionInProgress = Boolean(activeSession && !activeSession.completed);

  // STATE C: Full session completed today or a full workout was completed today
  const isSessionCompletedToday = Boolean(
    activeSession &&
    activeSession.completed &&
    !getSessionSummary(activeSession).isPartial &&
    activeSession.completedAt &&
    new Date(activeSession.completedAt).toDateString() === new Date().toDateString()
  );

  const todayCompletedHistoryWorkout = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    return (
      (history || []).find((w) => {
        if (w.isPartial) return false;
        const timeStr = w.completedAt || w.startedAt;
        if (!timeStr) return false;
        const time = new Date(timeStr).getTime();
        return time >= startOfDay && time <= endOfDay;
      }) || null
    );
  }, [history, focusKey]);

  const todayPartialHistoryWorkout = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    return (
      (history || []).find((w) => {
        if (!w.isPartial) return false;
        const timeStr = w.completedAt || w.startedAt;
        if (!timeStr) return false;
        const time = new Date(timeStr).getTime();
        return time >= startOfDay && time <= endOfDay;
      }) || null
    );
  }, [history, focusKey]);

  const isWorkoutCompletedToday = isSessionCompletedToday || Boolean(todayCompletedHistoryWorkout);

  // Strict 3-state selector:
  const homeState: 'IN_PROGRESS' | 'COMPLETED_TODAY' | 'READY_TO_TRAIN' = isSessionInProgress
    ? 'IN_PROGRESS'
    : isWorkoutCompletedToday
    ? 'COMPLETED_TODAY'
    : 'READY_TO_TRAIN';

  const inProgressData = useMemo(() => {
    if (!activeSession) return null;
    const totalExercises = activeSession.exercises.length;
    const completedExercises = activeSession.exercises.filter(
      (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
    ).length;
    const sessionProgress = getSessionProgress(activeSession);
    const percent = Math.round(sessionProgress.percentage);
    const currentEx = activeSession.exercises[activeSession.currentExerciseIndex] ?? activeSession.exercises[0];
    const currentSet = currentEx?.sets[activeSession.currentSetIndex] ?? currentEx?.sets[0];

    return {
      routineName: activeSession.workoutName,
      totalExercises,
      completedExercises,
      progressText: `${completedExercises} / ${totalExercises} ${t('exercises').toLowerCase()}`,
      percent,
      completedSets: sessionProgress.completedSets,
      totalSets: sessionProgress.totalSets,
      currentExerciseName: currentEx?.name ?? '',
      currentExerciseMuscle: currentEx?.muscleGroup ?? '',
      currentSetIndex: activeSession.currentSetIndex,
      currentExTotalSets: currentEx?.sets.length ?? 0,
      targetWeight: currentSet?.weight ?? 0,
      targetReps: currentSet?.targetReps ?? '8-12',
    };
  }, [activeSession, t]);

  const completedSummaryData = useMemo(() => {
    if (isSessionCompletedToday && activeSession) {
      const summary = getSessionSummary(activeSession);
      return {
        workoutName: activeSession.workoutName,
        durationMinutes: summary.durationMinutes,
        volume: summary.volume,
        exerciseCount: summary.exerciseCount,
        completedSets: summary.completedSets,
        prsCount: activeSession.personalRecords?.length ?? 0,
        isLiveSession: true,
        id: activeSession.id,
      };
    }
    if (todayCompletedHistoryWorkout) {
      const rawMins = Math.max(1, Math.round(todayCompletedHistoryWorkout.durationSeconds / 60));
      return {
        workoutName: todayCompletedHistoryWorkout.workoutName,
        durationMinutes: Math.min(rawMins, 360),
        volume: todayCompletedHistoryWorkout.totalVolume,
        exerciseCount: todayCompletedHistoryWorkout.exercises.length,
        completedSets: todayCompletedHistoryWorkout.totalSets,
        prsCount: todayCompletedHistoryWorkout.personalRecords?.length ?? 0,
        isLiveSession: false,
        id: todayCompletedHistoryWorkout.id,
      };
    }
    return null;
  }, [isSessionCompletedToday, activeSession, todayCompletedHistoryWorkout]);

  const displayMuscles = useMemo(() => {
    if (!nextWorkout) return language === 'uk' ? 'Все тіло' : 'Full Body';
    if (nextWorkout.muscleGroups && nextWorkout.muscleGroups.length > 0) {
      return nextWorkout.muscleGroups.slice(0, 3).map((m) => tm(m)).join(' • ');
    }
    if (nextWorkout.exercises && nextWorkout.exercises.length > 0) {
      const fromEx = Array.from(new Set(nextWorkout.exercises.map((e) => e.muscleGroup).filter(Boolean)));
      if (fromEx.length > 0) {
        return fromEx.slice(0, 3).map((m) => tm(m)).join(' • ');
      }
    }
    return language === 'uk' ? 'Все тіло' : 'Full Body';
  }, [nextWorkout, tm, language]);

  const targetAnatomyMuscles = useMemo(() => {
    if (!nextWorkout) return [];
    const list: string[] = [];
    if (nextWorkout.muscleGroups?.length) list.push(...nextWorkout.muscleGroups);
    if (nextWorkout.exercises?.length) {
      for (const ex of nextWorkout.exercises) {
        if (ex.muscleGroup) list.push(ex.muscleGroup);
      }
    }
    return Array.from(new Set(list));
  }, [nextWorkout]);

  const todayDateKicker = useMemo(() => {
    const now = new Date();
    return now
      .toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      .toUpperCase();
  }, [language]);

  const rawGreetingName = (profile?.name && profile.name.trim().length > 0 ? profile.name.trim() : name) || '';
  const userGreetingName = rawGreetingName.slice(0, 20);
  const coachInsight = useMemo(
    () =>
      generateCoachInsight({
        history,
        deloadActive,
        language,
        translateExercise: te,
        translateMuscle: tm,
        formatWeightDiff: (kgDiff) => formatWithUnit(kgDiff),
      }),
    [history, deloadActive, language, te, tm, formatWithUnit]
  );

  const handleCoachAction = async (actionType: 'apply_deload' | 'restore_deload' | 'open_muscles') => {
    if (actionType === 'apply_deload') {
      await applyDeloadWeek();
    } else if (actionType === 'restore_deload') {
      await restoreFromDeload();
    } else if (actionType === 'open_muscles') {
      router.push({ pathname: '/(tabs)/progress', params: { tab: 'muscles' } });
    }
  };

  const handleOneTapStartWorkout = useCallback(async () => {
    if (!nextWorkout || startingWorkout) return;
    setStartingWorkout(true);
    try {
      await initializeSession(nextWorkout);
      router.push('/workout/active');
    } finally {
      setStartingWorkout(false);
    }
  }, [initializeSession, nextWorkout, startingWorkout]);

  const greetingText = userGreetingName
    ? `${greetingPrefix}, ${userGreetingName}`
    : greetingPrefix;

  useEffect(() => {
    if (homeState !== 'IN_PROGRESS' || reducedMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.45,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [homeState, reducedMotion, pulseAnim]);

  useEffect(() => {
    const targetPct = inProgressData?.percent ?? 0;
    if (reducedMotion) {
      progressAnim.setValue(targetPct);
      return;
    }
    Animated.spring(progressAnim, {
      toValue: targetPct,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [inProgressData?.percent, reducedMotion, progressAnim]);

  const animatedProgressTranslateX = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [-Math.max(1, progressTrackWidth), 0],
    extrapolate: 'clamp',
  });

  if (!programHydrated || (!historyHydrated && history.length === 0) || !program || !program.workouts || program.workouts.length === 0 || !nextWorkout) {
    return (
      <Screen style={styles.screenContent}>
        <View style={styles.header}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.greetingTitle}>
            {greetingText}
          </Text>
        </View>
        <HomeSkeleton />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screenContent}>
      {/* 1. Athletic Cockpit Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateKicker}>{todayDateKicker}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.greetingTitle}>
            {greetingText}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Weekly progress"
          onPress={() => {
            hapticLight();
            router.push('/(tabs)/progress');
          }}
          style={({ pressed }) => [styles.weeklyGoalPill, pressed && { opacity: 0.75 }]}
        >
          <View
            style={[
              styles.weeklyGoalDot,
              {
                backgroundColor:
                  completedWorkoutsThisWeek >= targetWorkouts ? colors.primary : colors.accentLine,
              },
            ]}
          />
          <Text style={styles.weeklyGoalText}>
            {completedWorkoutsThisWeek}/{targetWorkouts}
          </Text>
          <Text style={styles.weeklyGoalSub}>{language === 'uk' ? 'тижд.' : 'wk'}</Text>
        </Pressable>
      </View>

      {/* STATE A: Ready to Train */}
      {homeState === 'READY_TO_TRAIN' && (
        <>
          {todayPartialHistoryWorkout && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/history/[id]',
                  params: { id: todayPartialHistoryWorkout.id },
                })
              }
              style={styles.partialSavedBanner}
            >
              <Ionicons name="bookmark-outline" size={16} color={colors.warning} />
              <Text style={styles.partialSavedBannerText} numberOfLines={1}>
                {language === 'uk'
                  ? `Сьогодні збережено частково: ${todayPartialHistoryWorkout.totalSets}/${todayPartialHistoryWorkout.plannedSets || todayPartialHistoryWorkout.totalSets} підх.`
                  : `Partial workout saved today: ${todayPartialHistoryWorkout.totalSets}/${todayPartialHistoryWorkout.plannedSets || todayPartialHistoryWorkout.totalSets} sets`}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}

          {/* 2. Hero Today's Workout Card with Mini Target Anatomy */}
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeaderRow}>
              <View style={styles.upNextPill}>
                <View style={styles.upNextPillDot} />
                <Text style={styles.workoutCardLabel}>
                  {language === 'uk' ? 'СЬОГОДНІ ЗА ПЛАНОМ' : 'UP NEXT'}
                </Text>
              </View>
              {program.workouts && program.workouts.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Switch workout"
                  onPress={() => {
                    hapticLight();
                    setSwitchModalMode('switch');
                    setSwitchModalVisible(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.switchWorkoutBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="swap-horizontal" size={13} color={colors.secondary} />
                  <Text style={styles.switchWorkoutBtnText}>
                    {language === 'uk' ? 'Змінити день' : 'Change day'}
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } })
              }
              style={styles.heroSplitRow}
            >
              <View style={styles.heroTextCol}>
                <Text style={styles.workoutName} numberOfLines={2}>
                  {tw(nextWorkout.name)}
                </Text>
                <Text style={styles.workoutMuscles} numberOfLines={2}>
                  {displayMuscles}
                </Text>
                <View style={styles.heroMetaPills}>
                  <View style={styles.heroMetaBadge}>
                    <Ionicons name="barbell-outline" size={12} color={colors.secondary} />
                    <Text style={styles.heroMetaText}>
                      {nextWorkout.exercises.length} {t('exercises').toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.heroMetaBadge}>
                    <Ionicons name="time-outline" size={12} color={colors.secondary} />
                    <Text style={styles.heroMetaText}>
                      ~{nextWorkout.estimatedMinutes} {t('min')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroAnatomyWrap}>
                <AnatomyPreview
                  muscles={targetAnatomyMuscles}
                  sex={profile.sex}
                  height={98}
                  showBack
                />
              </View>
            </Pressable>

            {/* Clean Exercise List directly on card surface (no nested box) */}
            {nextWorkout.exercises && nextWorkout.exercises.length > 0 && (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } })
                }
                style={styles.exercisePreviewWrap}
              >
                {nextWorkout.exercises.slice(0, 4).map((ex, idx) => {
                  const equipment = (ex as any).equipment || inferEquipmentFromName(ex.name);
                  const exWithEquip = { ...ex, equipment } as any;
                  const prevSets = findLatestExerciseSets(history, exWithEquip);
                  const rec = recommendWeight(exWithEquip, prevSets, { deloadActive });
                  const effectiveWeight = rec.source === 'history'
                    ? rec.recommendedWeight
                    : (typeof ex.recommendedWeight === 'number' && ex.recommendedWeight > 0
                      ? ex.recommendedWeight
                      : rec.recommendedWeight);
                  return (
                    <View
                      key={ex.id || `${ex.name}-${idx}`}
                      style={[styles.previewExRow, idx > 0 && styles.previewExRowBorder]}
                    >
                      <Text style={styles.previewExIndex}>
                        {String(idx + 1).padStart(2, '0')}
                      </Text>
                      <Text style={styles.previewExName} numberOfLines={1}>
                        {te(ex.name)}
                      </Text>
                      <Text style={styles.previewExSets}>
                        {ex.sets} × {effectiveWeight ? formatWithUnit(effectiveWeight) : (language === 'uk' ? 'ВТ' : 'BW')} × {ex.targetRepRange || '8-12'}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.previewFooterRow}>
                  {nextWorkout.exercises.length > 4 ? (() => {
                    const rem = nextWorkout.exercises.length - 4;
                    const label =
                      language === 'uk'
                        ? rem === 1
                          ? '+ ще 1 вправа'
                          : rem < 5
                          ? `+ ще ${rem} вправи`
                          : `+ ще ${rem} вправ`
                        : `+ ${rem} more ${rem === 1 ? 'exercise' : 'exercises'}`;
                    return (
                      <Text style={styles.previewMoreText}>
                        {label}
                      </Text>
                    );
                  })() : <View />}

                  <View style={styles.previewInspectLink}>
                    <Text style={styles.previewInspectLinkText}>
                      {language === 'uk' ? 'Перегляд і зміна' : 'Preview & Edit'}
                    </Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.secondary} />
                  </View>
                </View>
              </Pressable>
            )}
          </View>

          {/* Primary 1-Tap CTA — launches Active Workout directly with zero friction */}
          <Button
            style={styles.ctaButton}
            loading={startingWorkout}
            onPress={handleOneTapStartWorkout}
          >
            {t('startWorkout')}
          </Button>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quick Log"
            onPress={() => {
              hapticLight();
              router.push({ pathname: '/workout/quick-log', params: { workoutId: nextWorkout.id } });
            }}
            style={({ pressed }) => [
              styles.quickLogSecondaryBtn,
              pressed && styles.quickLogSecondaryBtnPressed,
            ]}
          >
            <Ionicons name="flash-outline" size={15} color="#8E959F" />
            <Text style={styles.quickLogSecondaryBtnText}>
              {language === 'uk' ? 'Швидкий запис без таймерів' : 'Quick log without timers'}
            </Text>
          </Pressable>
        </>
      )}

      {/* STATE B: Workout in Progress */}
      {homeState === 'IN_PROGRESS' && inProgressData && (
        <View>
          <View style={styles.stateCard}>
            <View style={styles.stateCardHeaderRow}>
              <View style={styles.inProgressBadge}>
                <Animated.View
                  style={[
                    styles.pulseDot,
                    {
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />
                <Text style={styles.inProgressBadgeText}>{t('workoutInProgress')}</Text>
              </View>
              <Text style={styles.progressCounterText}>{inProgressData.percent}%</Text>
            </View>

            <Text style={styles.workoutName}>{tw(inProgressData.routineName)}</Text>

            <Text style={styles.workoutMuscles}>
              {inProgressData.progressText}  ·  {inProgressData.completedSets} / {inProgressData.totalSets} {t('sets').toLowerCase()}
            </Text>

            {/* Progress Bar Track (60fps native driver) */}
            <View
              style={styles.progressBarTrack}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && w !== progressTrackWidth) setProgressTrackWidth(w);
              }}
            >
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: '100%',
                    transform: [
                      {
                        translateX: progressTrackWidth > 0 ? animatedProgressTranslateX : -9999,
                      },
                    ],
                  },
                ]}
              />
            </View>

            {/* Current Active Exercise Info */}
            {inProgressData.currentExerciseName ? (
              <View style={styles.currentExBox}>
                <Text style={styles.currentExKicker}>
                  {inProgressData.currentExerciseMuscle
                    ? `${tm(inProgressData.currentExerciseMuscle)} · ${t('set')} ${(inProgressData.currentSetIndex ?? 0) + 1} / ${inProgressData.currentExTotalSets}`
                    : `${t('set')} ${(inProgressData.currentSetIndex ?? 0) + 1} / ${inProgressData.currentExTotalSets}`}
                </Text>
                <View style={styles.currentExDetailsRow}>
                  <Text numberOfLines={1} style={styles.currentExName}>
                    {te(inProgressData.currentExerciseName)}
                  </Text>
                  <Text style={styles.currentExTarget}>
                    {inProgressData.targetWeight > 0 ? formatWithUnit(inProgressData.targetWeight) : t('bodyweight')} × {inProgressData.targetReps}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <Button
            style={styles.ctaButton}
            onPress={() => {
              router.replace('/workout/active');
            }}
          >
            <Text style={styles.ctaButtonText}>
              {language === 'uk' ? 'ПРОДОВЖИТИ ТРЕНУВАННЯ' : 'RESUME WORKOUT'}
            </Text>
          </Button>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to Quick Log"
            onPress={() => {
              hapticLight();
              router.push('/workout/quick-log');
            }}
            style={({ pressed }) => [
              styles.quickLogSecondaryBtn,
              pressed && styles.quickLogSecondaryBtnPressed,
            ]}
          >
            <Ionicons name="list-outline" size={15} color="#8E959F" />
            <Text style={styles.quickLogSecondaryBtnText}>
              {language === 'uk' ? 'Швидкий запис списком' : 'Switch to Quick Log'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard workout"
            onPress={() => {
              hapticLight();
              const title = language === 'uk' ? 'Скасувати тренування?' : 'Discard Workout?';
              const msg =
                language === 'uk'
                  ? 'Активну сесію буде закрито без збереження в історію.'
                  : 'This active session will be closed without saving to your workout history.';
              if (Platform.OS === 'web') {
                if (typeof window === 'undefined' || window.confirm(`${title}\n\n${msg}`)) {
                  void discardSession();
                }
                return;
              }
              Alert.alert(title, msg, [
                { text: language === 'uk' ? 'Залишити' : 'Keep Session', style: 'cancel' },
                {
                  text: language === 'uk' ? 'Скасувати тренування' : 'Discard Workout',
                  style: 'destructive',
                  onPress: () => {
                    void discardSession();
                  },
                },
              ]);
            }}
            style={({ pressed }) => [
              styles.quickLogSecondaryBtn,
              { marginTop: 8 },
              pressed && styles.quickLogSecondaryBtnPressed,
            ]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={[styles.quickLogSecondaryBtnText, { color: colors.danger }]}>
              {language === 'uk' ? 'Скасувати тренування' : 'Discard Workout'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* STATE C: Workout Completed Today */}
      {homeState === 'COMPLETED_TODAY' && completedSummaryData && (
        <>
          <View style={styles.stateCard}>
            <View style={styles.stateCardHeaderRow}>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryText} />
                <Text style={styles.completedBadgeText}>{t('workoutCompletedToday')}</Text>
              </View>
            </View>

            <Text style={styles.workoutName}>{tw(completedSummaryData.workoutName)}</Text>
            <Text style={styles.completedSubtitle}>{t('completedTodaySubtitle')}</Text>

            <View style={styles.completedStatsGrid}>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatVal}>
                  {completedSummaryData.durationMinutes} {t('min')}
                </Text>
                <Text style={styles.completedStatLbl}>{t('duration')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatVal}>
                  {completedSummaryData.exerciseCount}
                </Text>
                <Text style={styles.completedStatLbl}>{t('exercises')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatVal}>
                  {completedSummaryData.completedSets}
                </Text>
                <Text style={styles.completedStatLbl}>{t('sets')}</Text>
              </View>
            </View>
          </View>

          <Button
            variant="secondary"
            style={styles.completedSummaryBtn}
            onPress={() => {
              if (completedSummaryData.isLiveSession) {
                router.push('/workout/complete');
              } else if (completedSummaryData.id) {
                router.push({ pathname: '/history/[id]', params: { id: completedSummaryData.id } });
              } else {
                router.push({ pathname: '/(tabs)/progress', params: { view: 'history' } });
              }
            }}
          >
            {t('viewSummary')}
          </Button>

          {/* NEXT UP Card with Mini Target Anatomy */}
          {nextWorkout && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View next workout"
              onPress={() => {
                hapticLight();
                router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } });
              }}
              style={({ pressed }) => [styles.nextUpCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.nextUpHeaderRow}>
                <Text style={styles.nextUpKickerText}>
                  {language === 'uk' ? 'ДАЛІ ЗА ПЛАНОМ' : 'NEXT UP'}
                </Text>
                <Text style={styles.nextUpDayText}>
                  {nextWorkout.dayLabel || (language === 'uk' ? 'За розкладом' : 'Scheduled')}
                </Text>
              </View>

              <View style={styles.heroSplitRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.nextUpTitleRow}>
                    <Text numberOfLines={1} style={styles.nextUpWorkoutName}>
                      {tw(nextWorkout.name)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>

                  <Text numberOfLines={2} style={styles.nextUpMuscles}>
                    {displayMuscles}  ·  {nextWorkout.exercises.length} {t('exercises').toLowerCase()}  ·  ~{nextWorkout.estimatedMinutes} {t('min')}
                  </Text>
                </View>

                <View style={styles.heroAnatomyWrap}>
                  <AnatomyPreview
                    muscles={targetAnatomyMuscles}
                    sex={profile.sex}
                    height={72}
                    showBack
                  />
                </View>
              </View>
            </Pressable>
          )}
        </>
      )}

      {/* This Week Tracker (1-tap access to Workout History) */}
      {homeState !== 'IN_PROGRESS' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === 'uk' ? 'Відкрити історію тренувань' : 'Open workout history'}
          onPress={() => {
            hapticLight();
            router.push({ pathname: '/(tabs)/progress', params: { view: 'history' } });
          }}
          style={({ pressed }) => [styles.weekSection, pressed && { opacity: 0.88 }]}
        >
          <View style={styles.weekHeader}>
            <Text style={styles.weekLabel}>{t('thisWeek')}</Text>
            <View style={styles.weekHeaderRight}>
              <Text style={styles.weekCounter}>
                {completedWorkoutsThisWeek} / {targetWorkouts} {language === 'uk' ? 'трен.' : 'sessions'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </View>
          </View>
          <View style={styles.weekRow}>
            {weekDayStatuses.map((item, idx) => (
              <View key={idx} style={styles.weekDayCol}>
                <View style={styles.weekSlot}>
                  {item.completed ? (
                    <View style={styles.indicatorCompleted}>
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                    </View>
                  ) : item.isToday ? (
                    <View style={styles.indicatorToday}>
                      <View style={styles.indicatorTodayDot} />
                    </View>
                  ) : (
                    <View style={styles.indicatorFuture} />
                  )}
                </View>
                <Text
                  style={[
                    styles.weekDayLabel,
                    item.isToday && styles.weekDayLabelToday,
                    item.completed && styles.weekDayLabelCompleted,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
      )}

      {/* SPOT Coach: Weekly Insights & 1-Tap Deload */}
      {!isSessionInProgress && coachInsight ? (
        <SpotCoachCard insight={coachInsight} onAction={handleCoachAction} />
      ) : null}

      {/* Workout Switch BottomSheet */}
      <BottomSheet
        visible={switchModalVisible}
        onClose={() => setSwitchModalVisible(false)}
        title={
          switchModalMode === 'start'
            ? (language === 'uk' ? 'Почати інше тренування' : 'Start Another Workout')
            : (language === 'uk' ? 'Вибрати тренування' : 'Select Workout')
        }
        subtitle={
          switchModalMode === 'start'
            ? (language === 'uk' ? 'Оберіть тренування для швидкого старту' : 'Select a workout to start')
            : (language === 'uk' ? 'Оберіть заплановане тренування' : 'Choose your scheduled workout')
        }
      >
        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {program.workouts.map((w, idx) => {
            const isSelected = w.id === nextWorkout.id;
            const muscles = w.muscleGroups?.slice(0, 3).map((m) => tm(m)).join(' • ') || '';
            return (
              <Pressable
                key={w.id}
                style={[styles.switchItem, isSelected && styles.switchItemActive]}
                onPress={async () => {
                  hapticMedium();
                  await setNextWorkout(w.id);
                  setSwitchModalVisible(false);
                  if (switchModalMode === 'start') {
                    await initializeSession(w);
                    router.push('/workout/active');
                  }
                }}
              >
                <View style={styles.switchItemLeft}>
                  <View style={[styles.switchItemBadge, isSelected && styles.switchItemBadgeActive]}>
                    <Text style={[styles.switchItemBadgeText, isSelected && styles.switchItemBadgeTextActive]}>
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchItemName, isSelected && styles.switchItemNameActive]}>
                      {tw(w.name)}
                    </Text>
                    {muscles ? (
                      <Text style={styles.switchItemMuscles}>{muscles}</Text>
                    ) : null}
                  </View>
                </View>
                {switchModalMode === 'start' ? (
                  <View style={styles.switchItemStartBadge}>
                    <Ionicons name="play" size={11} color={colors.onPrimary} style={{ marginRight: 3 }} />
                    <Text style={styles.switchItemStartBadgeText}>
                      {language === 'uk' ? 'СТАРТ' : 'START'}
                    </Text>
                  </View>
                ) : isSelected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primaryText} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screenContent: {
    paddingTop: 6,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 2,
    gap: 12,
  },
  dateKicker: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  greetingTitle: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  weeklyGoalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...cardElevation(colors),
  },
  weeklyGoalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  weeklyGoalText: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  weeklyGoalSub: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.muted,
  },
  partialSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(217, 119, 6, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radii.sm + 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  partialSavedBannerText: {
    fontFamily: fonts.semiBold,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.isDark ? '#FDE68A' : colors.warning,
  },
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 14,
    ...cardElevation(colors),
  },
  upNextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upNextPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentLine,
  },
  workoutCardLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: colors.primaryText,
  },
  workoutCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.elevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchWorkoutBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.secondary,
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextCol: {
    flex: 1,
    gap: 6,
  },
  heroMetaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  heroMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.xs,
    backgroundColor: colors.elevated,
  },
  heroMetaText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.secondary,
    fontVariant: ['tabular-nums'],
  },
  heroAnatomyWrap: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.sm + 2,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePreviewWrap: {
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  previewExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  previewExRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  previewExIndex: {
    fontFamily: fonts.monoSemiBold,
    width: 22,
    fontSize: 11.5,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  previewExName: {
    fontFamily: fonts.medium,
    flex: 1,
    fontSize: 14,
    color: colors.text,
    includeFontPadding: false,
  },
  previewExSets: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 12.5,
    color: colors.secondary,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  previewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
  },
  previewMoreText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.secondary,
    paddingLeft: 32,
    includeFontPadding: false,
  },
  previewInspectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  previewInspectLinkText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.secondary,
    includeFontPadding: false,
  },
  workoutMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutName: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  ctaButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  weekSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 4,
    ...cardElevation(colors),
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weekLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  weekHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekCounter: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  weekDayCol: {
    alignItems: 'center',
    gap: 8,
  },
  weekSlot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorCompleted: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorToday: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorTodayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.text,
  },
  indicatorFuture: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.elevated,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
  },
  weekDayLabelToday: {
    color: colors.text,
    fontWeight: '700',
  },
  weekDayLabelCompleted: {
    color: colors.text,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    padding: 4,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    marginBottom: 8,
  },
  switchItemActive: {
    backgroundColor: colors.elevated,
  },
  switchItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  switchItemBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchItemBadgeActive: {
    backgroundColor: colors.activeChipBg,
  },
  switchItemBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
  },
  switchItemBadgeTextActive: {
    color: colors.activeChipText,
  },
  switchItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  switchItemNameActive: {
    fontWeight: '700',
  },
  switchItemMuscles: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
  },
  stateCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    ...cardElevation(colors),
  },
  stateCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accentLine,
  },
  inProgressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryText,
  },
  progressCounterText: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  progressBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: colors.elevated,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentLine,
    borderRadius: 2,
  },
  currentExBox: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  currentExKicker: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondary,
    marginBottom: 4,
  },
  currentExName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 10,
  },
  currentExDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentExTarget: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 13.5,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryText,
  },
  completedSubtitle: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '400',
    marginTop: 4,
    marginBottom: 16,
  },
  completedStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  completedStatVal: {
    fontFamily: fonts.monoBold,
    fontSize: 17,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  completedSummaryBtn: {
    width: '100%',
    marginBottom: 18,
  },
  completedStatLbl: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.secondary,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.divider,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 0.2,
    includeFontPadding: false,
    lineHeight: 20,
  },
  nextUpCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...cardElevation(colors),
  },
  nextUpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  nextUpKickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  nextUpDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondary,
  },
  nextUpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nextUpWorkoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  nextUpMuscles: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500',
    marginTop: 3,
  },
  switchItemStartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  switchItemStartBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 0.4,
  },
  quickLogSecondaryBtn: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  quickLogSecondaryBtnPressed: {
    opacity: 0.65,
  },
  quickLogSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
  },
});
