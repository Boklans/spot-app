import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
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
  const { formatVolume, formatWithUnit } = useWeightUnit();
  const [name, setName] = useState('');
  const [focusKey] = useState(0);

  const profile = useUserProfileStore((state) => state.profile);
  const program = useProgramStore((state) => state.program);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const progress = useProgramProgressStore((state) => state.progress);
  const setNextWorkout = useProgramProgressStore((state) => state.setNextWorkout);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchModalMode, setSwitchModalMode] = useState<'switch' | 'start'>('switch');

  // Focus synchronization
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {}, 0);
      return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
    });
    useWorkoutSessionStore.getState().hydrateSession();
    useUserProfileStore.getState().loadProfile();
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
  }, []);

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
      return {
        workoutName: todayCompletedHistoryWorkout.workoutName,
        durationMinutes: Math.max(1, Math.round(todayCompletedHistoryWorkout.durationSeconds / 60)),
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

  const userGreetingName = (profile?.name && profile.name.trim().length > 0 ? profile.name.trim() : name) || '';
  const greetingText = userGreetingName
    ? `${greetingPrefix}, ${userGreetingName}`
    : greetingPrefix;

  if (!program || !program.workouts || program.workouts.length === 0 || !nextWorkout) {
    return (
      <Screen style={styles.screenContent}>
        <View style={styles.header}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.greetingTitle}>
            {greetingText}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screenContent}>
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.greetingTitle}>
            {greetingText}
          </Text>
          <Text style={styles.headerSubtitle}>
            {homeState === 'IN_PROGRESS'
              ? (language === 'uk' ? 'Активна сесія триває' : 'Active session in progress')
              : homeState === 'COMPLETED_TODAY'
              ? (language === 'uk' ? 'Тренування за сьогодні виконано' : 'Today’s workout completed')
              : (language === 'uk' ? `Сьогодні за планом — ${tw(nextWorkout.name)}` : `Scheduled today — ${tw(nextWorkout.name)}`)}
          </Text>
        </View>
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
              <Ionicons name="bookmark-outline" size={16} color="#F59E0B" />
              <Text style={styles.partialSavedBannerText} numberOfLines={1}>
                {language === 'uk'
                  ? `Сьогодні збережено частково: ${todayPartialHistoryWorkout.totalSets}/${todayPartialHistoryWorkout.plannedSets || todayPartialHistoryWorkout.totalSets} підх.`
                  : `Partial workout saved today: ${todayPartialHistoryWorkout.totalSets}/${todayPartialHistoryWorkout.plannedSets || todayPartialHistoryWorkout.totalSets} sets`}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#8E959F" />
            </Pressable>
          )}

          {/* 2. Today's Workout Card */}
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeaderRow}>
              <Text style={styles.workoutCardLabel}>
                {language === 'uk' ? 'НАСТУПНЕ ТРЕНУВАННЯ' : 'NEXT WORKOUT'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                    style={styles.switchWorkoutBtn}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                    <Text style={styles.switchWorkoutBtnText}>
                      {language === 'uk' ? 'ЗМІНИТИ ДЕНЬ' : 'CHANGE DAY'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } })
              }
              style={styles.workoutMainRow}
            >
              <Text style={styles.workoutName}>{tw(nextWorkout.name)}</Text>
              <Ionicons name="chevron-forward" size={22} color="#8E959F" />
            </Pressable>

            <Text style={styles.workoutMuscles}>{displayMuscles}</Text>

            {/* Exercise Quick Preview on Home Card */}
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
                  const rec = recommendWeight(exWithEquip, prevSets);
                  const effectiveWeight = rec.source === 'history'
                    ? rec.recommendedWeight
                    : (typeof ex.recommendedWeight === 'number' && ex.recommendedWeight > 0
                      ? ex.recommendedWeight
                      : rec.recommendedWeight);
                  return (
                    <View key={ex.id || `${ex.name}-${idx}`} style={styles.previewExRow}>
                      <View style={styles.previewExDot} />
                      <Text style={styles.previewExName} numberOfLines={1}>
                        {te(ex.name)}
                      </Text>
                      <Text style={styles.previewExSets}>
                        {ex.sets} × {effectiveWeight ? formatWithUnit(effectiveWeight) : (language === 'uk' ? 'ВТ' : 'BW')}
                      </Text>
                    </View>
                  );
                })}
                {nextWorkout.exercises.length > 4 && (() => {
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
                })()}
              </Pressable>
            )}

            <View style={styles.workoutFooterRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="dumbbell" size={16} color="#8E959F" />
                <Text style={styles.metaText}>
                  {nextWorkout.exercises.length} {t('exercises').toLowerCase()}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="layers-outline" size={16} color="#8E959F" />
                <Text style={styles.metaText}>
                  {nextWorkout.exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0)} {t('sets').toLowerCase()}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#8E959F" />
                <Text style={styles.metaText}>
                  ~{nextWorkout.estimatedMinutes} {t('min')}
                </Text>
              </View>
            </View>
          </View>

          {/* Clear [START WORKOUT] CTA */}
          <Button
            style={styles.ctaButton}
            onPress={() => {
              router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } });
            }}
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
            <Ionicons name="list-outline" size={16} color={colors.primary} />
            <Text style={styles.quickLogSecondaryBtnText}>
              {language === 'uk' ? 'Швидкий запис (без таймерів)' : 'Quick Log (no timers)'}
            </Text>
          </Pressable>
        </>
      )}

      {/* STATE B: Workout in Progress */}
      {homeState === 'IN_PROGRESS' && inProgressData && (
        <>
          <View style={styles.stateCard}>
            <View style={styles.stateCardHeaderRow}>
              <View style={styles.inProgressBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.inProgressBadgeText}>{t('workoutInProgress')}</Text>
              </View>
              <Text style={styles.progressCounterText}>{inProgressData.percent}%</Text>
            </View>

            <Text style={styles.workoutName}>{tw(inProgressData.routineName)}</Text>

            <View style={styles.inProgressStatsRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="dumbbell" size={16} color={colors.primary} />
                <Text style={styles.inProgressStatsText}>{inProgressData.progressText}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="layers-outline" size={15} color="#8E959F" />
                <Text style={styles.metaText}>
                  {inProgressData.completedSets} / {inProgressData.totalSets} {t('sets').toLowerCase()}
                </Text>
              </View>
            </View>

            {/* Progress Bar Track */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${inProgressData.percent}%` }]} />
            </View>

            {/* Current Active Exercise Info */}
            {inProgressData.currentExerciseName ? (
              <View style={styles.currentExBox}>
                {inProgressData.currentExerciseMuscle ? (
                  <View style={styles.muscleInlineBadge}>
                    <Text style={styles.muscleInlineBadgeText}>
                      {tm(inProgressData.currentExerciseMuscle).toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                <Text numberOfLines={1} style={styles.currentExName}>
                  {te(inProgressData.currentExerciseName)}
                </Text>
                <View style={styles.currentExDetailsRow}>
                  <Text style={styles.currentExSetIndicator}>
                    {t('set')} {(inProgressData.currentSetIndex ?? 0) + 1} / {inProgressData.currentExTotalSets}
                  </Text>
                  <Text style={styles.currentExTarget}>
                    {inProgressData.targetWeight > 0 ? formatWithUnit(inProgressData.targetWeight) : t('bodyweight')} · {inProgressData.targetReps} {t('reps').toLowerCase()}
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
              {inProgressData.completedSets > 0 || inProgressData.completedExercises > 0
                ? (language === 'uk' ? 'ПРОДОВЖИТИ ТРЕНУВАННЯ' : 'RESUME WORKOUT')
                : (language === 'uk' ? 'ПОЧАТИ ТРЕНУВАННЯ' : 'START WORKOUT')}
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
            <Ionicons name="list-outline" size={16} color={colors.primary} />
            <Text style={styles.quickLogSecondaryBtnText}>
              {language === 'uk' ? 'Швидкий запис списком' : 'Switch to Quick Log'}
            </Text>
          </Pressable>
        </>
      )}

      {/* STATE C: Workout Completed Today */}
      {homeState === 'COMPLETED_TODAY' && completedSummaryData && (
        <>
          <View style={styles.stateCard}>
            <View style={styles.stateCardHeaderRow}>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={15} color="#0B0D0F" />
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
                  {formatVolume(completedSummaryData.volume)}
                </Text>
                <Text style={styles.completedStatLbl}>{t('volume')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatVal}>
                  {completedSummaryData.exerciseCount}
                </Text>
                <Text style={styles.completedStatLbl}>{t('exercises')}</Text>
              </View>
            </View>
          </View>

          <Button
            style={[styles.ctaButton, { marginBottom: 24 }]}
            onPress={() => {
              if (completedSummaryData.isLiveSession) {
                router.push('/workout/complete');
              } else if (completedSummaryData.id) {
                router.push({ pathname: '/history/[id]', params: { id: completedSummaryData.id } });
              } else {
                router.push('/history');
              }
            }}
          >
            <View style={styles.btnContentRow}>
              <Ionicons name="stats-chart" size={18} color="#0B0D0F" style={{ marginRight: 6 }} />
              <Text style={styles.ctaButtonText}>{t('viewSummary')}</Text>
            </View>
          </Button>

          {/* NEXT UP Card */}
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
                <View style={styles.nextUpKickerBadge}>
                  <Ionicons name="calendar-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.nextUpKickerText}>
                    {language === 'uk' ? 'НАСТУПНЕ ТРЕНУВАННЯ' : 'NEXT UP'}
                  </Text>
                </View>
                <Text style={styles.nextUpDayText}>
                  {nextWorkout.dayLabel || (language === 'uk' ? 'За розкладом' : 'Scheduled')}
                </Text>
              </View>

              <View style={styles.nextUpTitleRow}>
                <Text numberOfLines={1} style={styles.nextUpWorkoutName}>
                  {tw(nextWorkout.name)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#8E959F" />
              </View>

              <Text numberOfLines={1} style={styles.nextUpMuscles}>
                {displayMuscles}
              </Text>

              <View style={styles.nextUpMetaRow}>
                <Ionicons name="time-outline" size={13} color="#6C7787" style={{ marginRight: 4 }} />
                <Text style={styles.nextUpMetaText}>
                  {nextWorkout.exercises.length} {t('exercises').toLowerCase()} · ~{nextWorkout.estimatedMinutes} {t('min')}
                </Text>
              </View>
            </Pressable>
          )}
        </>
      )}

      {/* This Week Tracker */}
      {homeState !== 'IN_PROGRESS' && (
        <View style={styles.weekSection}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekLabel}>{t('thisWeek')}</Text>
            <Text style={styles.weekCounter}>
              {completedWorkoutsThisWeek} / {targetWorkouts} {language === 'uk' ? 'тренувань' : 'workouts'}
            </Text>
          </View>
          <View style={styles.weekRow}>
            {weekDayStatuses.map((item, idx) => (
              <View key={idx} style={styles.weekDayCol}>
                <View style={styles.weekSlot}>
                  {item.completed ? (
                    <View style={styles.indicatorCompleted}>
                      <Ionicons name="checkmark" size={15} color="#0B0D0F" />
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
        </View>
      )}

      {/* Workout Switch Modal */}
      <Modal
        visible={switchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitchModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSwitchModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {switchModalMode === 'start'
                    ? (language === 'uk' ? 'Почати інше тренування' : 'Start Another Workout')
                    : (language === 'uk' ? 'Вибрати тренування' : 'Select Workout')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {switchModalMode === 'start'
                    ? (language === 'uk' ? 'Оберіть тренування для перегляду та старту' : 'Select a workout to preview & start')
                    : (language === 'uk' ? 'Оберіть заплановане тренування' : 'Choose your scheduled workout')}
                </Text>
              </View>
              <Pressable
                onPress={() => setSwitchModalVisible(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#8E959F" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
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
                        router.push({ pathname: '/workout/preview', params: { workoutId: w.id } });
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
                        <Ionicons name="play" size={11} color="#0B0D0F" style={{ marginRight: 3 }} />
                        <Text style={styles.switchItemStartBadgeText}>
                          {language === 'uk' ? 'СТАРТ' : 'START'}
                        </Text>
                      </View>
                    ) : isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#6C7685" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 6,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    gap: 12,
  },
  greetingTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8E959F',
    marginTop: 2,
    fontWeight: '500',
  },
  partialSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  partialSavedBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FDE68A',
  },
  workoutCard: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  workoutCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 1.0,
  },
  workoutCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  switchWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  switchWorkoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.4,
  },
  exercisePreviewWrap: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  previewExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewExDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  previewExName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#D8DEE9',
  },
  previewExSets: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E959F',
    fontVariant: ['tabular-nums'],
  },
  previewMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
    paddingLeft: 13,
  },
  workoutMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  workoutName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  workoutMuscles: {
    fontSize: 14,
    color: '#8E959F',
    marginTop: 4,
    marginBottom: 14,
    fontWeight: '400',
  },
  workoutFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#8E959F',
    fontWeight: '500',
  },
  ctaButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 24,
    backgroundColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  weekSection: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 1.0,
  },
  weekCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D8DEE9',
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
    backgroundColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorToday: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C8FF3D',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorTodayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C8FF3D',
  },
  indicatorFuture: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#242B35',
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6C7685',
  },
  weekDayLabelToday: {
    color: '#C8FF3D',
    fontWeight: '700',
  },
  weekDayLabelCompleted: {
    color: '#FFFFFF',
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
    backgroundColor: '#15191F',
    borderRadius: 22,
    borderColor: '#242B35',
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242B35',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: '#1E2530',
    marginBottom: 10,
  },
  switchItemActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderColor: '#C8FF3D',
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
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchItemBadgeActive: {
    backgroundColor: '#C8FF3D',
  },
  switchItemBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E959F',
  },
  switchItemBadgeTextActive: {
    color: '#0B0D0F',
  },
  switchItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchItemNameActive: {
    color: '#C8FF3D',
  },
  switchItemMuscles: {
    fontSize: 12,
    color: '#8E959F',
    marginTop: 2,
  },
  stateCard: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  stateCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  progressCounterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  inProgressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  inProgressStatsText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    width: '100%',
    backgroundColor: '#242B35',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  currentExBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 4,
  },
  muscleInlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    marginBottom: 6,
  },
  muscleInlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  currentExName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  currentExDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  currentExSetIndicator: {
    fontSize: 12,
    color: '#8E959F',
    fontWeight: '500',
  },
  currentExTarget: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.8,
  },
  completedSubtitle: {
    fontSize: 13,
    color: '#8E959F',
    fontWeight: '400',
    marginTop: 4,
    marginBottom: 16,
  },
  completedStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  completedStatVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  completedStatLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#717B8A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.2,
    includeFontPadding: false,
    lineHeight: 20,
  },
  nextUpCard: {
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginTop: -8,
    marginBottom: 24,
  },
  nextUpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nextUpKickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.2)',
  },
  nextUpKickerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  nextUpDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E959F',
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
    color: '#FFFFFF',
    letterSpacing: -0.3,
    flex: 1,
  },
  nextUpMuscles: {
    fontSize: 13,
    color: '#8E959F',
    fontWeight: '500',
    marginBottom: 8,
  },
  nextUpMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextUpMetaText: {
    fontSize: 12,
    color: '#6C7787',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8E959F',
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
    fontWeight: '800',
    color: '#0B0D0F',
    letterSpacing: 0.6,
  },
  quickLogSecondaryBtn: {
    width: '100%',
    height: 46,
    borderRadius: 20,
    backgroundColor: '#141820',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  quickLogSecondaryBtnPressed: {
    backgroundColor: '#1B222D',
    borderColor: 'rgba(200, 255, 61, 0.35)',
  },
  quickLogSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DCE2EC',
    letterSpacing: 0.1,
  },
});
