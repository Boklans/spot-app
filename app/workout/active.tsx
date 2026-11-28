import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseDetailModal } from '@/components/program/ExerciseDetailModal';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import { Button } from '@/components/ui/Button';
import { ActiveWorkoutSkeleton } from '@/components/ui/Skeleton';
import { ActiveExerciseCard } from '@/components/workout/ActiveExerciseCard';
import { CollapsedExerciseRow } from '@/components/workout/CollapsedExerciseRow';
import { ExerciseNoteModal } from '@/components/workout/ExerciseNoteModal';
import { ProgressionGuideModal } from '@/components/workout/ProgressionGuideModal';
import { RestCockpitDock } from '@/components/workout/RestCockpitDock';
import { WorkoutKeypadSheet } from '@/components/workout/WorkoutKeypadSheet';
import { WorkoutElapsedClock } from '@/components/workout/WorkoutTimers';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { resolveCanonicalExerciseId } from '@/lib/exercises';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  cancelRestTimerNotification,
  dismissActiveWorkoutNotification,
  initNotifications,
  requestNotificationPermissions,
  syncActiveWorkoutNotification,
} from '@/lib/notificationService';
import { useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import {
  getSessionProgress,
  getSupersetBadgeLabel,
  useWorkoutSessionStore,
} from '@/store/workoutSessionStore';

type SheetGroup =
  | { type: 'single'; index: number }
  | { type: 'superset'; firstIndex: number; secondIndex: number };

export default function Active() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const { t, te, tw, language } = useI18n();
  const isUk = language === 'uk';
  const { unit, unitLabel, formatWithUnit, fromKg } = useWeightUnit();

  const session = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const restTotalSeconds = useWorkoutSessionStore((state) => state.restTotalSeconds);
  const toggleSetCompletion = useWorkoutSessionStore((state) => state.toggleSetCompletion);
  const cycleSetType = useWorkoutSessionStore((state) => state.cycleSetType);
  const swapExercise = useWorkoutSessionStore((state) => state.swapExercise);
  const addExercise = useWorkoutSessionStore((state) => state.addExercise);
  const toggleSuperset = useWorkoutSessionStore((state) => state.toggleSuperset);
  const setCurrentExerciseIndex = useWorkoutSessionStore((state) => state.setCurrentExerciseIndex);
  const addRestTime = useWorkoutSessionStore((state) => state.addRestTime);
  const skipRest = useWorkoutSessionStore((state) => state.skipRest);
  const addWarmupSets = useWorkoutSessionStore((state) => state.addWarmupSets);
  const discardSession = useWorkoutSessionStore((state) => state.discardSession);

  const [finishing, setFinishing] = useState(false);
  const [submittingSet, setSubmittingSet] = useState(false);
  const isSubmittingSetRef = useRef(false);
  const isExitingRef = useRef(false);

  const [pickerState, setPickerState] = useState<{
    mode: 'swap' | 'add';
    exerciseIndex: number;
  } | null>(null);
  const [detailExerciseIndex, setDetailExerciseIndex] = useState<number | null>(null);
  const [noteExerciseIndex, setNoteExerciseIndex] = useState<number | null>(null);
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    exerciseIndex: number;
    setIndex: number;
    initialFocusField: 'weight' | 'reps';
  } | null>(null);

  const exerciseNotes = useExerciseNotesStore((state) => state.notes);
  const notesHydrated = useExerciseNotesStore((state) => state.hydrated);
  const loadExerciseNotes = useExerciseNotesStore((state) => state.loadNotes);
  const saveExerciseNote = useExerciseNotesStore((state) => state.setNote);

  const [isHydrating, setIsHydrating] = useState(!session);
  const headerProgressAnim = useRef(new Animated.Value(0)).current;
  const [headerTrackWidth, setHeaderTrackWidth] = useState(0);

  const isResting = Boolean(restEndsAt && restEndsAt > Date.now());
  const prevIsRestingRef = useRef(isResting);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!notesHydrated) {
      loadExerciseNotes();
    }
  }, [notesHydrated, loadExerciseNotes]);

  useEffect(() => {
    initNotifications()
      .then(() => requestNotificationPermissions())
      .then(() => syncActiveWorkoutNotification(false))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (prevIsRestingRef.current !== isResting) {
      prevIsRestingRef.current = isResting;
      if (!reducedMotion && Platform.OS !== 'web') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    }
  }, [isResting, reducedMotion]);

  useEffect(() => {
    isSubmittingSetRef.current = false;
    setSubmittingSet(false);
  }, [session?.currentExerciseIndex, session?.currentSetIndex]);

  useEffect(() => {
    if (!session) {
      useWorkoutSessionStore.getState().hydrateSession().finally(() => {
        setIsHydrating(false);
      });
    } else {
      setIsHydrating(false);
    }
  }, [session]);

  // Keep OS Notification Shade synchronized whenever session or rest timer changes
  useEffect(() => {
    if (session && !session.completed) {
      void syncActiveWorkoutNotification(false);
    } else if (session?.completed) {
      void dismissActiveWorkoutNotification();
    }
  }, [
    session?.id,
    session?.completed,
    session?.currentExerciseIndex,
    session?.currentSetIndex,
    restEndsAt,
    language,
  ]);

  const progress = session
    ? getSessionProgress(session)
    : { completedSets: 0, totalSets: 0, percentage: 0 };
  const percent = Math.round(progress.percentage);

  useEffect(() => {
    if (reducedMotion) {
      headerProgressAnim.setValue(percent);
      return;
    }
    Animated.spring(headerProgressAnim, {
      toValue: percent,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [percent, reducedMotion, headerProgressAnim]);

  const headerProgressTranslateX = headerProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [-Math.max(1, headerTrackWidth), 0],
    extrapolate: 'clamp',
  });

  const exitWorkout = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    router.replace('/(tabs)');
  }, []);

  const confirmDiscardWorkout = useCallback(() => {
    const title = isUk ? 'Скасувати тренування?' : 'Discard Workout?';
    const message = isUk
      ? 'Усі підходи поточної сесії буде скасовано без збереження в історію.'
      : 'All sets in this session will be discarded without saving to your workout history.';

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true;
      if (confirmed) {
        void discardSession().then(() => exitWorkout());
      }
      return;
    }

    Alert.alert(title, message, [
      { text: isUk ? 'Продовжити тренування' : 'Keep Training', style: 'cancel' },
      {
        text: isUk ? 'Скасувати тренування' : 'Discard Workout',
        style: 'destructive',
        onPress: async () => {
          await discardSession();
          exitWorkout();
        },
      },
    ]);
  }, [discardSession, exitWorkout, isUk]);

  const handleFinishSessionNow = useCallback(async () => {
    if (!session || finishing) return;
    setFinishing(true);
    try {
      await finalizeWorkoutSession(session);
      router.replace('/workout/complete');
    } catch {
      setFinishing(false);
      Alert.alert(t('couldNotSave'), t('couldNotSaveDesc'));
    }
  }, [session, finishing, t]);

  const handleClose = useCallback(() => {
    if (!session) {
      exitWorkout();
      return;
    }

    if (Platform.OS === 'web') {
      const promptMsg =
        progress.completedSets === 0
          ? isUk
            ? 'Поставити тренування на паузу та повернутися на головну?'
            : 'Pause this workout and return to Home?'
          : isUk
            ? `Виконано ${progress.completedSets} із ${progress.totalSets} підходів. Поставити тренування на паузу та повернутися на головну?`
            : `You completed ${progress.completedSets} of ${progress.totalSets} sets. Pause this workout and return to Home?`;
      if (typeof window === 'undefined' || window.confirm(promptMsg)) {
        exitWorkout();
      }
      return;
    }

    if (progress.completedSets === 0) {
      Alert.alert(
        isUk ? 'Вийти з тренування?' : 'Leave Workout?',
        isUk
          ? 'Ви ще не завершили жодного підходу. Поставити сесію на паузу чи скасувати її?'
          : 'No sets have been completed yet. Pause to resume later, or discard this workout?',
        [
          { text: isUk ? 'Залишитись' : 'Keep Training', style: 'cancel' },
          {
            text: isUk ? 'Пауза (на головну)' : 'Pause & Exit',
            onPress: exitWorkout,
          },
          {
            text: isUk ? 'Скасувати тренування' : 'Discard Workout',
            style: 'destructive',
            onPress: async () => {
              await discardSession();
              exitWorkout();
            },
          },
        ]
      );
      return;
    }

    const isPartialNow = progress.completedSets < progress.totalSets;
    const saveAction = {
      text: isPartialNow
        ? isUk
          ? `Зберегти частково (${progress.completedSets}/${progress.totalSets})`
          : `Save Partial (${progress.completedSets}/${progress.totalSets})`
        : isUk
          ? 'Завершити та зберегти'
          : 'Finish & Save',
      onPress: () => {
        void handleFinishSessionNow();
      },
    };

    const buttons =
      Platform.OS === 'ios'
        ? [
            { text: isUk ? 'Продовжити тренування' : 'Keep Training', style: 'cancel' as const },
            { text: isUk ? 'Пауза (на головну)' : 'Pause & Exit', onPress: exitWorkout },
            saveAction,
            {
              text: isUk ? 'Скасувати тренування' : 'Discard Workout',
              style: 'destructive' as const,
              onPress: async () => {
                await discardSession();
                exitWorkout();
              },
            },
          ]
        : [
            { text: isUk ? 'Продовжити' : 'Keep Training', style: 'cancel' as const },
            { text: isUk ? 'Пауза' : 'Pause & Exit', onPress: exitWorkout },
            saveAction,
          ];

    Alert.alert(
      isUk ? 'Перервати тренування?' : 'Interrupt Workout?',
      isUk
        ? `Виконано ${progress.completedSets} із ${progress.totalSets} підходів. Зберегти виконані підходи як часткове тренування чи поставити на паузу?`
        : `You completed ${progress.completedSets} of ${progress.totalSets} sets. Save completed sets as a partial workout, or pause to resume later?`,
      buttons
    );
  }, [session, progress.completedSets, progress.totalSets, isUk, exitWorkout, discardSession, handleFinishSessionNow]);

  // Android BackHandler: dismiss docked keypad or sheets first before showing exit prompt
  useEffect(() => {
    const onBackPress = () => {
      if (editingTarget !== null) {
        setEditingTarget(null);
        return true;
      }
      if (pickerState !== null) {
        setPickerState(null);
        return true;
      }
      if (detailExerciseIndex !== null) {
        setDetailExerciseIndex(null);
        return true;
      }
      if (noteExerciseIndex !== null) {
        setNoteExerciseIndex(null);
        return true;
      }
      if (showProgressionModal) {
        setShowProgressionModal(false);
        return true;
      }
      handleClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [
    editingTarget,
    pickerState,
    detailExerciseIndex,
    noteExerciseIndex,
    showProgressionModal,
    handleClose,
  ]);

  // Group consecutive A1+A2 superset pairs so they render inside a shared purple connector rail
  const sheetGroups = useMemo<SheetGroup[]>(() => {
    if (!session?.exercises) return [];
    const groups: SheetGroup[] = [];
    let i = 0;
    while (i < session.exercises.length) {
      const curr = session.exercises[i];
      if (curr?.supersetWithNext && i + 1 < session.exercises.length) {
        groups.push({ type: 'superset', firstIndex: i, secondIndex: i + 1 });
        i += 2;
      } else {
        groups.push({ type: 'single', index: i });
        i += 1;
      }
    }
    return groups;
  }, [session?.exercises]);

  const getNoteForExercise = useCallback(
    (name: string) => {
      const canonical = resolveCanonicalExerciseId(name);
      if (canonical && exerciseNotes[canonical]) return exerciseNotes[canonical];
      return exerciseNotes[name.trim().toLowerCase()] || '';
    },
    [exerciseNotes]
  );

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActiveWorkoutSkeleton />
      </SafeAreaView>
    );
  }

  if (
    !session ||
    !session.exercises ||
    session.exercises.length === 0 ||
    !session.exercises[session.currentExerciseIndex]
  ) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Button onPress={() => router.replace('/(tabs)')}>{t('backToHome')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const currentIdx = session.currentExerciseIndex;

  const isExerciseExpanded = (exIdx: number): boolean => {
    if (exIdx === currentIdx) return true;
    // Keep both A1 and A2 expanded together when either partner in a superset is active!
    if (exIdx + 1 === currentIdx && session.exercises[exIdx]?.supersetWithNext) return true;
    if (exIdx - 1 === currentIdx && session.exercises[currentIdx]?.supersetWithNext) return true;
    return false;
  };

  const handleSelectExercise = (exIdx: number) => {
    if (exIdx === currentIdx) return;
    hapticLight();
    if (!reducedMotion && Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setCurrentExerciseIndex(exIdx);
  };

  const handleToggleSet = async (targetExerciseIndex: number, targetSetIndex: number) => {
    if (isSubmittingSetRef.current || finishing || submittingSet) return;
    const targetEx = session.exercises[targetExerciseIndex];
    const targetSet = targetEx?.sets[targetSetIndex];
    if (!targetEx || !targetSet) return;

    if (targetSet.completed) {
      hapticLight();
      void cancelRestTimerNotification();
      toggleSetCompletion(targetExerciseIndex, targetSetIndex);
      return;
    }

    isSubmittingSetRef.current = true;
    setSubmittingSet(true);
    try {
      // P3-01 Haptic hierarchy: medium for normal set completion, success reserved for full workout completion
      toggleSetCompletion(targetExerciseIndex, targetSetIndex);

      const latestSession = useWorkoutSessionStore.getState().session;
      if (latestSession?.completed) {
        hapticSuccess();
        setFinishing(true);
        await finalizeWorkoutSession(latestSession);
        router.replace('/workout/complete');
      } else {
        hapticMedium();
        setTimeout(() => {
          isSubmittingSetRef.current = false;
          setSubmittingSet(false);
        }, 120);
      }
    } catch {
      setFinishing(false);
      setSubmittingSet(false);
      isSubmittingSetRef.current = false;
      Alert.alert(t('couldNotSave'), t('couldNotSaveDesc'));
    }
  };

  const applySavedSetValues = (
    exerciseIndex: number,
    setIndex: number,
    values: { weight: number; reps: number; rir?: number | null }
  ) => {
    const editedSet = session.exercises[exerciseIndex]?.sets[setIndex];
    const shouldPropagate =
      exerciseIndex === session.currentExerciseIndex &&
      setIndex === session.currentSetIndex &&
      Boolean(editedSet && !editedSet.completed);
    useWorkoutSessionStore
      .getState()
      .updateSet(exerciseIndex, setIndex, values, shouldPropagate);
  };

  const handleSaveEditedSet = (values: { weight: number; reps: number; rir?: number | null }) => {
    if (!editingTarget) return;
    applySavedSetValues(editingTarget.exerciseIndex, editingTarget.setIndex, values);
    setEditingTarget(null);
  };

  const handleSaveAndCompleteEditedSet = (values: {
    weight: number;
    reps: number;
    rir?: number | null;
  }) => {
    if (!editingTarget) return;
    const { exerciseIndex, setIndex } = editingTarget;
    applySavedSetValues(exerciseIndex, setIndex, values);
    setEditingTarget(null);
    void handleToggleSet(exerciseIndex, setIndex);
  };

  const renderExerciseNode = (exIdx: number) => {
    const exItem = session.exercises[exIdx];
    if (!exItem) return null;
    const supersetBadge = getSupersetBadgeLabel(session.exercises, exIdx);
    const expanded = isExerciseExpanded(exIdx);

    if (!expanded) {
      const firstWorking =
        exItem.sets.find((s) => s.setType !== 'warmup') ?? exItem.sets[0];
      const prescribedWeightLabel = firstWorking?.weight
        ? formatWithUnit(firstWorking.weight)
        : isUk
          ? 'ВТ'
          : 'BW';
      return (
        <CollapsedExerciseRow
          key={exItem.id || `ex-${exIdx}`}
          exercise={exItem}
          exerciseIndex={exIdx}
          displayName={te(exItem.name)}
          supersetBadge={supersetBadge}
          prescribedWeightLabel={prescribedWeightLabel}
          onSelect={() => handleSelectExercise(exIdx)}
        />
      );
    }

    return (
      <ActiveExerciseCard
        key={exItem.id || `ex-${exIdx}`}
        exercise={exItem}
        exerciseIndex={exIdx}
        totalExercises={session.exercises.length}
        isFocusedExercise={exIdx === currentIdx}
        focusedSetIndex={session.currentSetIndex}
        supersetBadge={supersetBadge}
        noteText={getNoteForExercise(exItem.name)}
        onFocusExercise={() => handleSelectExercise(exIdx)}
        onOpenDetail={() => setDetailExerciseIndex(exIdx)}
        onOpenSwap={() => {
          if (exIdx !== currentIdx) setCurrentExerciseIndex(exIdx);
          setPickerState({ mode: 'swap', exerciseIndex: exIdx });
        }}
        onOpenProgression={() => {
          if (exIdx !== currentIdx) setCurrentExerciseIndex(exIdx);
          setShowProgressionModal(true);
        }}
        onOpenNote={() => setNoteExerciseIndex(exIdx)}
        onToggleSuperset={() => {
          if (exIdx > 0 && session.exercises[exIdx - 1]?.supersetWithNext) {
            toggleSuperset(exIdx - 1);
          } else {
            toggleSuperset(exIdx);
          }
        }}
        onAddWarmup={() => {
          if (!reducedMotion && Platform.OS !== 'web') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          addWarmupSets(exIdx);
        }}
        onCycleSetType={(setIdx) => cycleSetType(exIdx, setIdx)}
        onSelectSetRow={(setIdx) => {
          if (exIdx !== currentIdx) {
            setCurrentExerciseIndex(exIdx);
          }
          useWorkoutSessionStore.getState().setCurrentSetIndex(setIdx);
        }}
        onEditCell={(setIdx, field) => {
          setEditingTarget({
            exerciseIndex: exIdx,
            setIndex: setIdx,
            initialFocusField: field,
          });
        }}
        onToggleSetComplete={(setIdx) => {
          void handleToggleSet(exIdx, setIdx);
        }}
        onAddSet={() => useWorkoutSessionStore.getState().addSet(exIdx)}
        onRemoveSet={() => useWorkoutSessionStore.getState().removeSet(exIdx)}
      />
    );
  };

  const targetExerciseForEditing =
    editingTarget !== null ? session.exercises[editingTarget.exerciseIndex] : null;
  const targetSetForEditing =
    targetExerciseForEditing && editingTarget !== null
      ? targetExerciseForEditing.sets[editingTarget.setIndex]
      : null;

  const detailExercise =
    detailExerciseIndex !== null ? session.exercises[detailExerciseIndex] : null;
  const noteExercise =
    noteExerciseIndex !== null ? session.exercises[noteExerciseIndex] : null;
  const swapTargetExercise =
    pickerState?.mode === 'swap'
      ? session.exercises[pickerState.exerciseIndex] ?? session.exercises[currentIdx]
      : session.exercises[currentIdx];

  const remainingWorkingSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.setType !== 'warmup' && !s.completed).length,
    0
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* 1. Top Telemetry Bar (Zero 1Hz Re-Renders on Active!) */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={handleClose}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.topCenter}>
          <Text numberOfLines={1} style={styles.topWorkoutName}>
            {tw(session.workoutName)}
          </Text>
          <WorkoutElapsedClock startedAt={session.startedAt} style={styles.stopwatchText} />
        </View>

        <Text style={styles.topPercent}>{percent}%</Text>
      </View>

      {/* 2. 3px GPU-Driven Progress Line */}
      <View
        style={styles.progressTrack}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== headerTrackWidth) setHeaderTrackWidth(w);
        }}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: '100%',
              transform: [{ translateX: headerTrackWidth > 0 ? headerProgressTranslateX : -9999 }],
            },
          ]}
        />
      </View>

      {/* 3. Vertical Multi-Exercise Scrollable Sheet */}
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={[
          styles.scrollContent,
          isResting && { paddingBottom: 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sheetGroups.map((group) => {
          if (group.type === 'single') {
            return renderExerciseNode(group.index);
          }

          const badgeA1 = getSupersetBadgeLabel(session.exercises, group.firstIndex) || 'A1';
          const badgeA2 = getSupersetBadgeLabel(session.exercises, group.secondIndex) || 'A2';

          return (
            <View
              key={`ss-${group.firstIndex}-${group.secondIndex}`}
              style={styles.supersetPairFrame}
            >
              <View style={styles.supersetHeaderStrip}>
                <View style={styles.supersetStripLeft}>
                  <Ionicons name="link" size={13} color={colors.superset} />
                  <Text style={styles.supersetStripLabel}>
                    {isUk
                      ? `СУПЕРСЕТ ${badgeA1} + ${badgeA2}`
                      : `SUPERSET ${badgeA1} + ${badgeA2}`}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isUk ? 'Розірвати суперсет' : 'Unlink superset'}
                  hitSlop={8}
                  onPress={() => {
                    hapticMedium();
                    toggleSuperset(group.firstIndex);
                  }}
                  style={styles.unlinkBtn}
                >
                  <Text style={styles.unlinkBtnText}>
                    {isUk ? 'Розʼєднати' : 'Unlink'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.supersetCardsStack}>
                {renderExerciseNode(group.firstIndex)}
                {renderExerciseNode(group.secondIndex)}
              </View>
            </View>
          );
        })}

        {/* Sheet Footer Controls: + Add Exercise, Finish Partial/Full, Discard */}
        <View style={styles.sheetFooter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? 'Додати вправу' : 'Add exercise'}
            onPress={() => {
              hapticLight();
              setPickerState({ mode: 'add', exerciseIndex: currentIdx });
            }}
            style={({ pressed }) => [styles.addExerciseBtn, pressed && { opacity: 0.78 }]}
          >
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.addExerciseBtnText}>
              {isUk ? 'Додати вправу' : 'Add Exercise'}
            </Text>
          </Pressable>

          {progress.completedSets > 0 && remainingWorkingSets > 0 && (
            <Button
              variant="secondary"
              loading={finishing}
              onPress={() => {
                Alert.alert(
                  isUk ? 'Завершити тренування достроково?' : 'Finish Workout Early?',
                  isUk
                    ? `Виконано ${progress.completedSets} із ${progress.totalSets} робочих підходів. Зберегти виконані підходи в історію?`
                    : `You completed ${progress.completedSets} of ${progress.totalSets} working sets. Save completed sets to history?`,
                  [
                    { text: isUk ? 'Продовжити' : 'Keep Training', style: 'cancel' },
                    {
                      text: isUk ? 'Зберегти та завершити' : 'Save & Finish',
                      onPress: () => {
                        void handleFinishSessionNow();
                      },
                    },
                  ]
                );
              }}
            >
              {isUk
                ? `Завершити сесію (${progress.completedSets}/${progress.totalSets})`
                : `Finish Session (${progress.completedSets}/${progress.totalSets})`}
            </Button>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? 'Скасувати тренування' : 'Discard workout'}
            hitSlop={8}
            onPress={() => {
              hapticLight();
              confirmDiscardWorkout();
            }}
            style={({ pressed }) => [styles.discardBtn, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.discardBtnText}>
              {isUk ? 'Скасувати тренування' : 'Discard workout'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 4. Thumb-Zone Bottom Dock: Cryo-Cyan Rest Dock while resting OR Volt Finish CTA when all working sets done */}
      {isResting ? (
        <RestCockpitDock
          restEndsAt={restEndsAt}
          restTotalSeconds={restTotalSeconds}
          isUk={isUk}
          onAdjustRest={(delta) => addRestTime(delta)}
          onSkipRest={() => {
            void cancelRestTimerNotification();
            skipRest();
          }}
        />
      ) : remainingWorkingSets === 0 && progress.completedSets > 0 ? (
        <View style={styles.finishDock}>
          <Button loading={finishing} onPress={handleFinishSessionNow}>
            {t('finishWorkout')}
          </Button>
        </View>
      ) : null}

      {/* 5. Exercise Swap / Add Picker Modal */}
      <ExercisePickerModal
        visible={pickerState !== null}
        mode={pickerState?.mode === 'swap' ? 'swap' : 'add'}
        initialMuscle={
          pickerState?.mode === 'swap' ? swapTargetExercise?.muscleGroup || 'All' : 'All'
        }
        activeExerciseName={
          pickerState?.mode === 'swap' ? swapTargetExercise?.name : undefined
        }
        onClose={() => setPickerState(null)}
        onSelect={(selectedEx) => {
          const payload = {
            name: selectedEx.name,
            muscleGroup: selectedEx.muscleGroup,
            defaultWeight: selectedEx.defaultWeight,
            customImageUri: selectedEx.customImageUri,
            isCustom: selectedEx.isCustom,
            equipment: selectedEx.equipment,
          };
          if (pickerState?.mode === 'swap' && swapTargetExercise) {
            if (
              selectedEx.name.trim().toLowerCase() !==
              swapTargetExercise.name.trim().toLowerCase()
            ) {
              const completedInExercise = swapTargetExercise.sets.filter(
                (s) => s.completed
              ).length;
              if (completedInExercise > 0) {
                setPickerState(null);
                Alert.alert(
                  isUk ? 'Замінити вправу?' : 'Swap Exercise?',
                  isUk
                    ? `Ви вже виконали ${completedInExercise} підх. у вправі «${te(swapTargetExercise.name)}». Зберегти виконані підходи й додати «${te(selectedEx.name)}» на залишок підходів?`
                    : `You already completed ${completedInExercise} set(s) of "${swapTargetExercise.name}". Keep those completed sets and add "${selectedEx.name}" for the remaining sets?`,
                  [
                    { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
                    {
                      text: isUk ? 'Замінити все' : 'Replace All',
                      style: 'destructive',
                      onPress: () => {
                        hapticMedium();
                        swapExercise(payload, { mode: 'replace_all' });
                      },
                    },
                    {
                      text: isUk ? 'Зберегти виконані' : 'Keep Completed',
                      onPress: () => {
                        hapticMedium();
                        swapExercise(payload, { mode: 'preserve_completed' });
                      },
                    },
                  ]
                );
                return;
              }
              hapticMedium();
              swapExercise(payload, { mode: 'replace_all' });
            }
          } else if (pickerState?.mode === 'add') {
            hapticMedium();
            addExercise(payload);
          }
          setPickerState(null);
        }}
      />

      {/* 6. Exercise Detail Modal */}
      {detailExercise && (
        <ExerciseDetailModal
          visible={detailExerciseIndex !== null}
          onClose={() => setDetailExerciseIndex(null)}
          exerciseName={detailExercise.name}
          muscleGroup={detailExercise.muscleGroup}
          equipment={detailExercise.equipment}
          customImageUri={detailExercise.customImageUri}
        />
      )}

      {/* 7. Docked Gym Numpad (Zero OS Keyboard!) */}
      {targetSetForEditing && targetExerciseForEditing && editingTarget && (
        <WorkoutKeypadSheet
          visible={editingTarget !== null}
          exerciseName={te(targetExerciseForEditing.name)}
          canonicalExerciseName={targetExerciseForEditing.name}
          equipment={targetExerciseForEditing.equipment}
          setNumber={editingTarget.setIndex + 1}
          totalSets={targetExerciseForEditing.sets.length}
          isCompleted={targetSetForEditing.completed}
          initialWeightKg={targetSetForEditing.weight}
          initialReps={targetSetForEditing.reps}
          initialRir={targetSetForEditing.rir}
          unitLabel={unitLabel}
          unit={unit}
          fromKg={fromKg}
          initialFocusField={editingTarget.initialFocusField}
          onClose={() => setEditingTarget(null)}
          onSave={handleSaveEditedSet}
          onSaveAndComplete={handleSaveAndCompleteEditedSet}
        />
      )}

      {/* 8. Progression Guide Modal */}
      <ProgressionGuideModal
        visible={showProgressionModal}
        onClose={() => setShowProgressionModal(false)}
        language={language}
      />

      {/* 9. Persistent Exercise Note Modal */}
      {noteExercise && (
        <ExerciseNoteModal
          visible={noteExerciseIndex !== null}
          exerciseName={te(noteExercise.name)}
          initialNote={getNoteForExercise(noteExercise.name)}
          language={language}
          onClose={() => setNoteExerciseIndex(null)}
          onSave={(newNote) => saveExerciseNote(noteExercise.name, newNote)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 9,
    },
    navBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    topWorkoutName: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.text,
      letterSpacing: -0.25,
      includeFontPadding: false,
    },
    stopwatchText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12.5,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    topPercent: {
      fontFamily: fonts.monoBold,
      fontSize: 13.5,
      color: colors.primaryText,
      width: 46,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    progressTrack: {
      width: '100%',
      height: 3,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accentLine,
    },
    sheetScroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 36,
      gap: 10,
    },
    supersetPairFrame: {
      borderLeftWidth: 3,
      borderLeftColor: colors.superset,
      paddingLeft: 9,
      gap: 8,
    },
    supersetHeaderStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    supersetStripLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    supersetStripLabel: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      color: colors.superset,
      letterSpacing: 0.5,
      includeFontPadding: false,
    },
    unlinkBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.supersetMuted,
    },
    unlinkBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      color: colors.superset,
      includeFontPadding: false,
    },
    supersetCardsStack: {
      gap: 8,
    },
    sheetFooter: {
      marginTop: 6,
      gap: 10,
    },
    addExerciseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addExerciseBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    discardBtn: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 2,
    },
    discardBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: colors.danger,
      includeFontPadding: false,
    },
    finishDock: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 16,
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      fontSize: 20,
      color: colors.text,
      includeFontPadding: false,
    },
  });
