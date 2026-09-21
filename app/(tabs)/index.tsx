import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { hapticImpact, hapticLight, hapticMedium } from '@/lib/haptics';
import { countWorkoutsThisWeek, getStartOfWeek } from '@/lib/progressCalculator';
import { calculateMuscleRecovery } from '@/lib/recoveryEngine';
import { translateExercise, useI18n } from '@/lib/i18n';
import {
  generateFocusWorkout,
  WORKOUT_FOCUS_OPTIONS,
  type WorkoutFocus,
} from '@/lib/programGenerator';
import { generateUUID } from '@/lib/programMigration';
import { formatWeightWithUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import type { AppLanguage } from '@/store/userProfileStore';
import { WORKOUT_HISTORY_STORAGE_KEY, useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { defaultOnboarding, loadOnboarding, type OnboardingData } from '@/store/workoutStore';
import type { UserWorkout } from '@/types/userProgram';
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
  const setNextWorkout = useProgramProgressStore((state) => state.setNextWorkout);
  const history = useWorkoutHistoryStore((state) => state.workouts);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);

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

  const [selectedFocus, setSelectedFocus] = useState<WorkoutFocus | null>(null);
  const [focusCycle, setFocusCycle] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
      if (data) setOnboardingData(data);
    });
    useProgramStore.getState().loadProgram();
    useWorkoutHistoryStore.getState().loadHistory();
  }, []);

  const nextWorkout = program && program.workouts?.length ? getScheduledWorkout(program, progress) : null;

  const handleSelectFocus = async (focus: WorkoutFocus) => {
    hapticImpact();
    setSelectedFocus(focus);
    setFocusCycle(0);
    const data = onboardingData ?? (await loadOnboarding()) ?? defaultOnboarding;
    const generated = generateFocusWorkout(focus, data, 0);

    const userWorkout: UserWorkout = {
      id: generateUUID(),
      name: generated.name,
      dayLabel: language === 'uk' ? 'СЬОГОДНІ' : 'TODAY',
      muscleGroups: generated.muscleGroups,
      estimatedMinutes: generated.estimatedMinutes,
      defaultRestSeconds: generated.defaultRestSeconds,
      exercises: generated.exercises.map((e) => ({
        id: generateUUID(),
        name: e.name,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
        recommendedWeight: e.recommendedWeight,
        targetRepRange: e.targetRepRange,
        equipment: e.equipment,
        weightIncrement: e.weightIncrement,
        restSeconds: e.restSeconds,
      })),
    };

    const currentProg = useProgramStore.getState().program;
    const currentIndex = currentProg.workouts.findIndex((w) => w.id === nextWorkout?.id);
    const updatedWorkouts = [...currentProg.workouts];
    if (currentIndex >= 0) {
      updatedWorkouts[currentIndex] = userWorkout;
    } else {
      updatedWorkouts[0] = userWorkout;
    }

    await useProgramStore.getState().updateUserProgram({
      ...currentProg,
      workouts: updatedWorkouts,
    });
    await setNextWorkout(userWorkout.id);
  };

  const handleShuffleWorkout = async () => {
    hapticMedium();
    const activeFocus: WorkoutFocus = selectedFocus || 'full_body';
    const nextCycle = focusCycle + 1;
    setFocusCycle(nextCycle);
    if (!selectedFocus) setSelectedFocus(activeFocus);

    const data = onboardingData ?? (await loadOnboarding()) ?? defaultOnboarding;
    const generated = generateFocusWorkout(activeFocus, data, nextCycle);

    const userWorkout: UserWorkout = {
      id: generateUUID(),
      name: generated.name,
      dayLabel: language === 'uk' ? 'СЬОГОДНІ' : 'TODAY',
      muscleGroups: generated.muscleGroups,
      estimatedMinutes: generated.estimatedMinutes,
      defaultRestSeconds: generated.defaultRestSeconds,
      exercises: generated.exercises.map((e) => ({
        id: generateUUID(),
        name: e.name,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
        recommendedWeight: e.recommendedWeight,
        targetRepRange: e.targetRepRange,
        equipment: e.equipment,
        weightIncrement: e.weightIncrement,
        restSeconds: e.restSeconds,
      })),
    };

    const currentProg = useProgramStore.getState().program;
    const currentIndex = currentProg.workouts.findIndex((w) => w.id === nextWorkout?.id);
    const updatedWorkouts = [...currentProg.workouts];
    if (currentIndex >= 0) {
      updatedWorkouts[currentIndex] = userWorkout;
    } else {
      updatedWorkouts[0] = userWorkout;
    }

    await useProgramStore.getState().updateUserProgram({
      ...currentProg,
      workouts: updatedWorkouts,
    });
    await setNextWorkout(userWorkout.id);
  };

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

  if (!program || !program.workouts || program.workouts.length === 0 || !nextWorkout) {
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

      {/* 3. Daily Gym Focus Selector */}
      <View style={styles.focusSection}>
        <View style={styles.focusHeaderRow}>
          <Text style={styles.focusSectionTitle}>
            {language === 'uk' ? 'ЩО РОБИМО СЬОГОДНІ В ЗАЛІ?' : 'WHAT ARE WE TRAINING TODAY?'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shuffle workout"
            onPress={handleShuffleWorkout}
            style={({ pressed }) => [styles.shuffleBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="shuffle" size={13} color={colors.primary} />
            <Text style={styles.shuffleBtnText}>
              {language === 'uk' ? 'ІНШИЙ ВАРІАНТ' : 'SHUFFLE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.focusScrollContent}
        >
          {WORKOUT_FOCUS_OPTIONS.map((opt) => {
            const isSelected = selectedFocus === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityLabel={opt.labelUk}
                onPress={() => handleSelectFocus(opt.id)}
                style={({ pressed }) => [
                  styles.focusChip,
                  isSelected && styles.focusChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.focusChipIcon}>{opt.icon}</Text>
                <Text style={[styles.focusChipLabel, isSelected && styles.focusChipLabelActive]}>
                  {language === 'uk' ? opt.labelUk : opt.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Today's Workout Card with Deep Slate Elevation */}
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
                  {ex.sets} × {ex.recommendedWeight ? `${ex.recommendedWeight} кг` : 'ВТ'}
                </Text>
              </View>
            ))}
            {nextWorkout.exercises.length > 3 && (
              <Text style={styles.previewMoreText}>
                + ще {nextWorkout.exercises.length - 3}{' '}
                {language === 'uk' ? 'вправи (натисніть для перегляду)' : 'more exercises'}
              </Text>
            )}
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
              <Text style={styles.modalTitle}>
                {language === 'uk' ? 'Вибрати тренування' : 'Select Workout'}
              </Text>
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
                      hapticLight();
                      await setNextWorkout(w.id);
                      setSwitchModalVisible(false);
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
                    {isSelected ? (
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
    fontSize: 12,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.5,
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
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
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
    fontWeight: '600',
    color: '#D8DEE9',
  },
  previewExSets: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E959F',
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
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  workoutMuscles: {
    fontSize: 14,
    color: '#8E959F',
    marginTop: 4,
    marginBottom: 14,
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
});
