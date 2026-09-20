import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { countWorkoutsThisWeek, getStartOfWeek } from '@/lib/progressCalculator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { translateExercise, useI18n } from '@/lib/i18n';
import { formatWeightWithUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import type { AppLanguage } from '@/store/userProfileStore';
import { WORKOUT_HISTORY_STORAGE_KEY, useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';
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
      subtitle: isUk ? 'Тіло повністю відновилося' : 'Your body is fully recovered',
      color: colors.primary,
    };
  }

  const recoveryStatuses = calculateMuscleRecovery(history);
  if (!recoveryStatuses || recoveryStatuses.length === 0) {
    return {
      percentage: 100,
      label: isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN',
      subtitle: isUk ? 'Тіло готове до навантажень' : 'Your body is ready',
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
  let subtitle = isUk ? 'Цільові м’язи відновилися' : 'Target muscles fully recovered';
  let color: string = colors.primary;

  if (percentage >= 85) {
    label = isUk ? 'ГОТОВІ ДО ТРЕНУВАННЯ' : 'READY TO TRAIN';
    subtitle = isUk ? 'Цільові м’язи повністю відновилися' : 'Target muscles fully recovered';
    color = colors.primary;
  } else if (percentage >= 60) {
    label = isUk ? 'ОПТИМАЛЬНИЙ СТАН' : 'OPTIMAL STATE';
    subtitle = isUk ? 'Цільові м’язи відновлюються' : 'Target muscles recovering';
    color = colors.warning;
  } else {
    label = isUk ? 'ВІДНОВЛЕННЯ' : 'RECOVERING';
    subtitle = isUk ? 'Виявлено втому' : 'High fatigue detected';
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
  const [name, setName] = useState(defaultOnboarding.name);
  const [focusKey, setFocusKey] = useState(0);

  const program = useProgramStore((state) => state.program);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const progress = useProgramProgressStore((state) => state.progress);
  const history = useWorkoutHistoryStore((state) => state.workouts);

  // Focus synchronization
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY)
        .then((stored) => {
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                useWorkoutHistoryStore.setState({ workouts: parsed, hydrated: true });
              }
            } catch {}
          }
        })
        .catch(() => undefined);

      useWorkoutHistoryStore.getState().loadHistory();
      const currentProgram = useProgramStore.getState().program;
      if (currentProgram) {
        useProgramProgressStore.getState().loadProgress(currentProgram);
      } else {
        useProgramStore.getState().loadProgram().then((p) => {
          if (p) useProgramProgressStore.getState().loadProgress(p);
        });
      }
      setFocusKey((prev) => prev + 1);
    }, [])
  );

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
    });
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
  }, []);

  if (!program || !program.workouts || program.workouts.length === 0) {
    return null;
  }

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

  const nextWorkout = getScheduledWorkout(program, progress);
  if (!nextWorkout) {
    return null;
  }

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

  // Weekly tracker data
  const completedWorkoutsThisWeek = countWorkoutsThisWeek(history);
  const targetWorkouts = Math.max(1, program.daysPerWeek || 3);

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

  const isSessionActive = Boolean(activeSession && !activeSession.completed);
  const displayMuscles =
    nextWorkout.muscleGroups && nextWorkout.muscleGroups.length > 0
      ? nextWorkout.muscleGroups.slice(0, 3).map((m) => tm(m)).join(' • ')
      : language === 'uk'
      ? 'Груди • Спина • Руки'
      : 'Chest • Back • Arms';

  return (
    <Screen>
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.greetingTitle}>
          {greetingPrefix}, {name || 'Ihor'} 👋
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

      {/* 2. Readiness Section with Big Ring & Bold Typography */}
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

      {/* 3. Today's Workout Card with Deep Slate Elevation */}
      <View style={styles.workoutCard}>
        <Text style={styles.workoutCardLabel}>{t('todaysWorkout')}</Text>

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

      {/* 4. Electric Neon Lime CTA Button */}
      <Button
        style={styles.ctaButton}
        onPress={() => {
          if (isSessionActive && activeSession) {
            router.replace(restEndsAt !== null ? '/workout/rest' : '/workout/active');
          } else {
            router.push({ pathname: '/workout/preview', params: { workoutId: nextWorkout.id } });
          }
        }}
      >
        {isSessionActive ? t('resumeWorkout') : t('startWorkout')}
      </Button>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 18,
  },
  readinessPercentText: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  readinessTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  readinessLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.1,
  },
  readinessSubtitle: {
    fontSize: 15,
    color: '#8E959F',
    fontWeight: '400',
    lineHeight: 20,
  },
  workoutCard: {
    backgroundColor: '#15191F',
    borderColor: '#242B35',
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  workoutCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  workoutMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  workoutName: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontSize: 15,
    color: '#8E959F',
    marginTop: 4,
    marginBottom: 18,
    fontWeight: '500',
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
    fontSize: 14,
    color: '#8E959F',
    fontWeight: '600',
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
});
