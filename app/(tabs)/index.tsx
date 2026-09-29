import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { countWorkoutsThisWeek, getStartOfWeek } from '@/lib/progressCalculator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { translateExercise, useI18n } from '@/lib/i18n';
import { formatWeightWithUnit, useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore, type AppLanguage } from '@/store/userProfileStore';
import { WORKOUT_HISTORY_STORAGE_KEY, useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { getSessionProgress, getSessionSummary, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding } from '@/store/workoutStore';
import type { CompletedWorkout } from '@/types/workout';

import { ReadinessRing } from '@/components/ui/ReadinessRing';

function computeReadinessScore(
  history: CompletedWorkout[],
  nextWorkout?: { muscleGroups?: string[] } | null,
  lang: 'en' | 'uk' = 'uk'
) {
  const isUk = lang === 'uk';
  if (!history || history.length === 0) {
    return {
      percentage: 100,
      label: isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN',
      subtitle: isUk ? 'Оцінка на основі ваших тренувань' : 'Based on your recent training',
      color: colors.primary,
    };
  }

  const recoveryStatuses = calculateMuscleRecovery(history);
  if (!recoveryStatuses || recoveryStatuses.length === 0) {
    return {
      percentage: 100,
      label: isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN',
      subtitle: isUk ? 'Оцінка на основі ваших тренувань' : 'Based on your recent training',
      color: colors.primary,
    };
  }

  // Focus readiness on the target muscles for the upcoming workout
  const targetMuscles = nextWorkout?.muscleGroups || [];
  const relevantStatuses =
    targetMuscles.length > 0
      ? recoveryStatuses.filter((s) =>
          targetMuscles.some(
            (tm) => tm.toLowerCase() === s.muscleGroup.toLowerCase()
          )
        )
      : recoveryStatuses;

  const activeList = relevantStatuses.length > 0 ? relevantStatuses : recoveryStatuses;
  const avg = Math.round(
    activeList.reduce((acc, curr) => acc + curr.readinessPercentage, 0) / activeList.length
  );
  const percentage = Math.min(100, Math.max(15, avg));

  let label = isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN';
  let subtitle = isUk ? 'Оцінка на основі ваших тренувань' : 'Based on your recent training';
  let color: string = colors.primary;

  if (percentage >= 85) {
    label = isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN';
    subtitle = isUk ? 'Оцінка на основі ваших тренувань' : 'Based on your recent training';
    color = colors.primary;
  } else if (percentage >= 60) {
    label = isUk ? 'ОПТИМАЛЬНИЙ СТАН' : 'OPTIMAL STATE';
    subtitle = isUk ? 'Цільові м’язи ще відновлюються' : 'Target muscles still recovering';
    color = colors.warning;
  } else {
    label = isUk ? 'ВІДНОВЛЕННЯ' : 'RECOVERING';
    subtitle = isUk ? 'Виявлено високе навантаження' : 'High fatigue detected';
    color = colors.danger;
  }

  return { percentage, label, subtitle, color };
}

function computeSpotInsight(history: CompletedWorkout[], lang: AppLanguage = 'en'): string {
  const sorted = [...(history || [])].sort((a, b) => {
    const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
    const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
    return timeB - timeA;
  });

  if (sorted.length > 0) {
    const latestPR = sorted.find((w) => w.personalRecords && w.personalRecords.length > 0);
    if (latestPR && latestPR.personalRecords[0]) {
      const pr = latestPR.personalRecords[0];
      const exName = translateExercise(pr.exerciseName, lang);
      return lang === 'uk'
        ? `Ваш показник у ${exName} калібровано на ${formatWeightWithUnit(pr.value + 2.5)} на основі недавніх тренувань.`
        : `Your ${pr.exerciseName} is calibrated for ${formatWeightWithUnit(pr.value + 2.5)} based on your recent training.`;
    }

    for (const w of sorted) {
      if (w.exercises && w.exercises.length > 0) {
        const topEx = w.exercises[0];
        const lastSet = topEx.sets[topEx.sets.length - 1];
        if (lastSet && lastSet.weight > 0) {
          const nextWeight = lastSet.weight + 2.5;
          const exName = translateExercise(topEx.exerciseName, lang);
          return lang === 'uk'
            ? `Ваш показник у ${exName} калібровано на ${formatWeightWithUnit(nextWeight)} на основі недавнього тренування.`
            : `Your ${topEx.exerciseName} is calibrated for ${formatWeightWithUnit(nextWeight)} based on your recent workout.`;
        }
      }
    }
  }

  return lang === 'uk'
    ? 'Почніть перше тренування, щоб встановити базову вагу та активувати прогресивне перевантаження.'
    : 'Start your workout to establish your baseline and activate progressive overload.';
}

export default function Home() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { formatVolume, formatWithUnit } = useWeightUnit();
  const [name, setName] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const profile = useUserProfileStore((state) => state.profile);
  const program = useProgramStore((state) => state.program);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const progress = useProgramProgressStore((state) => state.progress);
  const setNextWorkout = useProgramProgressStore((state) => state.setNextWorkout);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchModalMode, setSwitchModalMode] = useState<'switch' | 'start'>('switch');

  // Focus synchronization
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        useWorkoutSessionStore.getState().hydrateSession();
        useWorkoutHistoryStore.getState().loadHistory();
        useProgramStore.getState().getOrLoadProgram().then((p) => {
          if (p) {
            useProgramProgressStore.getState().loadProgress(p);
          }
        });
        setFocusKey((prev) => prev + 1);
      });
      return () => task.cancel();
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

  // Dynamic Readiness Score
  const readiness = useMemo(
    () => computeReadinessScore(history, nextWorkout, language),
    [history, nextWorkout, focusKey, language]
  );

  // Dynamic SPOT Insight
  const spotInsight = useMemo(
    () => computeSpotInsight(history, language),
    [history, focusKey, language]
  );

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

  // STATE C: Session completed today or a workout was completed today
  const isSessionCompletedToday = Boolean(
    activeSession &&
    activeSession.completed &&
    activeSession.completedAt &&
    new Date(activeSession.completedAt).toDateString() === new Date().toDateString()
  );

  const todayCompletedHistoryWorkout = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    return (
      (history || []).find((w) => {
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
    ? `${greetingPrefix}, ${userGreetingName} 👋`
    : `${greetingPrefix} 👋`;

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
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.greetingTitle}>
          {greetingText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* STATE A: No Active Workout */}
      {homeState === 'READY_TO_TRAIN' && (
        <>
          {/* 2. Readiness Section with Big Ring & Dynamic Recovery */}
          <View style={styles.readinessRow}>
            <ReadinessRing
              percentage={readiness.percentage}
              color={readiness.color}
              size={88}
              strokeWidth={6.5}
            />
            <View style={styles.readinessTextCol}>
              <Text style={styles.readinessLabel}>{readiness.label}</Text>
              <Text style={styles.readinessSubtitle}>{readiness.subtitle}</Text>
            </View>
          </View>

          {/* 3. Today's Workout Card */}
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeaderRow}>
              <Text style={styles.workoutCardLabel}>{t('todaysWorkout')}</Text>
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
                      {language === 'uk' ? 'СПИСОК' : 'LIST'}
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
              <Ionicons name="chevron-forward" size={24} color="#8E959F" />
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
                {nextWorkout.exercises.slice(0, 3).map((ex, idx) => (
                  <View key={ex.id || `${ex.name}-${idx}`} style={styles.previewExRow}>
                    <View style={styles.previewExDot} />
                    <Text style={styles.previewExName} numberOfLines={1}>
                      {te(ex.name)}
                    </Text>
                    <Text style={styles.previewExSets}>
                      {ex.sets} × {ex.recommendedWeight ? formatWithUnit(ex.recommendedWeight) : (language === 'uk' ? 'ВТ' : 'BW')}
                    </Text>
                  </View>
                ))}
                {nextWorkout.exercises.length > 3 && (() => {
                  const rem = nextWorkout.exercises.length - 3;
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
                <MaterialCommunityIcons name="dumbbell" size={18} color="#8E959F" />
                <Text style={styles.metaText}>
                  {nextWorkout.exercises.length} {t('exercises').toLowerCase()}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color="#8E959F" />
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
            hitSlop={10}
            style={({ pressed }) => [styles.quickLogHomeLink, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="flash-outline" size={13} color="#8E959F" style={{ marginRight: 5 }} />
            <Text style={styles.quickLogHomeLinkText}>{t('quickLog')}</Text>
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

          {/* Electric Neon Lime Dynamic CTA Button */}
          <Button
            style={styles.ctaButton}
            onPress={() => {
              router.replace(restEndsAt !== null ? '/workout/rest' : '/workout/active');
            }}
          >
            <Text style={styles.ctaButtonText}>
              {inProgressData.completedSets > 0 || inProgressData.completedExercises > 0
                ? (language === 'uk' ? '▶ ПРОДОВЖИТИ ТРЕНУВАННЯ' : '▶ RESUME WORKOUT')
                : (language === 'uk' ? '▶ ПОЧАТИ ТРЕНУВАННЯ' : '▶ START WORKOUT')}
            </Text>
          </Button>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to Quick Log"
            onPress={() => {
              hapticLight();
              router.push('/workout/quick-log');
            }}
            hitSlop={10}
            style={({ pressed }) => [styles.quickLogHomeLink, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="flash-outline" size={13} color="#8E959F" style={{ marginRight: 5 }} />
            <Text style={styles.quickLogHomeLinkText}>
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

          {/* Electric Neon Lime [VIEW SUMMARY] CTA */}
          <Button
            style={styles.ctaButton}
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

          {/* NEXT UP Card - Closes the training loop: READY -> TRAIN -> IN PROGRESS -> COMPLETE -> NEXT UP */}
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

      {/* 5. This Week Tracker & 6. AI SPOT Insight Card (Hidden when workout is in progress) */}
      {homeState !== 'IN_PROGRESS' && (
        <>
          {/* 5. This Week Tracker (Dots above, labels below) */}
          <View style={styles.weekSection}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{t('thisWeek')}</Text>
              <Text style={styles.weekCounter}>
                {completedWorkoutsThisWeek} / {targetWorkouts}
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

          {/* 6. AI SPOT Insight Card */}
          <View style={styles.insightCard}>
            <View style={styles.insightIconBadge}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.insightTextCol}>
              <Text style={styles.insightLabel}>{t('spotInsight')}</Text>
              <Text style={styles.insightMessage}>{spotInsight}</Text>
            </View>
          </View>
        </>
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
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 16,
  },
  readinessPercentText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  readinessTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  readinessLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  readinessSubtitle: {
    fontSize: 13,
    color: '#8E959F',
    fontWeight: '400',
    lineHeight: 18,
  },
  focusSection: {
    marginBottom: 20,
  },
  focusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  focusSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E959F',
    letterSpacing: 1.2,
  },
  shuffleBtn: {
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
  shuffleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  focusScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  focusChipActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
  },
  focusChipIcon: {
    fontSize: 14,
  },
  focusChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E959F',
  },
  focusChipLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  workoutCard: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  workoutCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 1.1,
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
    padding: 10,
    marginBottom: 14,
    gap: 6,
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
    fontWeight: '500',
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
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#8E959F',
    fontWeight: '500',
  },
  ctaButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 24,
    backgroundColor: '#C8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  weekSection: {
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.5,
  },
  weekCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E959F',
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
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
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
    fontWeight: '800',
  },
  weekDayLabelCompleted: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  insightIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  insightTextCol: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#F0F3F8',
    fontWeight: '500',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
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
  prMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 209, 48, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 48, 0.3)',
  },
  prMiniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD130',
  },
  baselineMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  baselineMiniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '600',
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
    fontWeight: '900',
    color: '#0B0D0F',
    letterSpacing: 0.6,
  },
  quickLogHomeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  quickLogHomeLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E959F',
    letterSpacing: 0.1,
  },
});
