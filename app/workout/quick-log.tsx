import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { type LibraryExercise } from '@/lib/exerciseLibrary';
import {
  findLatestExerciseSets,
  inferEquipmentFromName,
  practicalIncrement,
  recommendWeight,
  type WeightRecommendation,
} from '@/lib/adaptiveProgression';
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { resolveRestSeconds, type EquipmentId, type GeneratedExercise } from '@/lib/programGenerator';
import { convertWeightToActiveUnit, formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import {
  useWorkoutSessionStore,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutSet,
} from '@/store/workoutSessionStore';

type QuickSet = {
  id: string;
  reps: number;
  repsText: string;
  targetReps: string;
  completed: boolean;
};

type QuickExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment?: EquipmentId;
  targetRepRange: string;
  recommendedWeight: number; // in kg
  recommendedReps: number;
  recommendation?: WeightRecommendation;
  weight: number; // in kg
  weightText: string; // in user unit
  weightIncrement: number;
  restSeconds: number;
  sets: QuickSet[];
};

type WhenOption = 'now' | 'earlier' | 'yesterday';

function parseTargetReps(repRange: string): number {
  if (!repRange) return 10;
  const parts = repRange.split('-');
  const parsed = parseInt(parts[0], 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : 10;
}

export default function QuickLogScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, tm, te, tw, language } = useI18n();
  const { unit, unitLabel, fromKg, toKg } = useWeightUnit();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();

  const program = useProgramStore((state) => state.program);
  const progress = useProgramProgressStore((state) => state.progress);
  const activeSession = useWorkoutSessionStore((state) => state.session);
  const history = useWorkoutHistoryStore((state) => state.workouts);

  const [workoutName, setWorkoutName] = useState<string>('');
  const [programWorkoutId, setProgramWorkoutId] = useState<string>('');
  const [exercises, setExercises] = useState<QuickExercise[]>([]);
  const [when, setWhen] = useState<WhenOption>('now');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAddPickerVisible, setIsAddPickerVisible] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const isInitializedRef = useRef(false);

  // Initialize data once on mount or when data becomes ready
  useEffect(() => {
    if (isInitializedRef.current) return;

    // 1. Check if user opened an existing in-progress session
    if (activeSession && !activeSession.completed && (!workoutId || workoutId === activeSession.programWorkoutId)) {
      setWorkoutName(activeSession.workoutName);
      setProgramWorkoutId(activeSession.programWorkoutId);
      const mapped: QuickExercise[] = activeSession.exercises.map((ex) => {
        const firstSet = ex.sets[0];
        const weightKg = firstSet?.weight ?? ex.recommendation.recommendedWeight;
        const displayW = convertWeightToActiveUnit(weightKg, unit);
        const repRange = firstSet?.targetReps ?? '8-12';
        return {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment || inferEquipmentFromName(ex.name),
          targetRepRange: repRange,
          recommendedWeight: ex.recommendation.recommendedWeight,
          recommendedReps: ex.recommendation.recommendedReps ?? firstSet?.reps ?? parseTargetReps(repRange),
          recommendation: ex.recommendation,
          weight: weightKg,
          weightText: formatWeight(displayW),
          weightIncrement: ex.weightIncrement || 2.5,
          restSeconds: ex.restSeconds || 90,
          sets: ex.sets.map((s) => ({
            id: s.id,
            reps: s.completed ? s.reps : 0,
            repsText: s.completed && s.reps > 0 ? s.reps.toString() : '',
            targetReps: s.targetReps || '8-12',
            completed: Boolean(s.completed && s.reps > 0),
          })),
        };
      });
      setExercises(mapped);
      setDurationMinutes(Math.max(20, Math.min(120, mapped.length * 8)));
      isInitializedRef.current = true;
      return;
    }

    // 2. Otherwise load target workout from program or scheduled
    let target = program?.workouts?.find((w) => w.id === workoutId);
    if (!target && program?.workouts?.length) {
      target = getScheduledWorkout(program, progress);
    }

    if (target) {
      setWorkoutName(target.name);
      setProgramWorkoutId(target.id);
      const mapped: QuickExercise[] = target.exercises.map((ex, exIdx) => {
        const repRange = ex.targetRepRange || '8-12';
        const setsCount = ex.sets || 3;
        const equipment = (ex as any).equipment || inferEquipmentFromName(ex.name);
        const exWithEquip = { ...ex, equipment, sets: setsCount, targetRepRange: repRange } as GeneratedExercise;
        const previousSets = findLatestExerciseSets(history, exWithEquip);
        const recommendation = recommendWeight(exWithEquip, previousSets);
        const recWeightKg = recommendation.source === 'history'
          ? recommendation.recommendedWeight
          : (typeof ex.recommendedWeight === 'number' && ex.recommendedWeight > 0
            ? ex.recommendedWeight
            : recommendation.recommendedWeight);
        const recReps = recommendation.recommendedReps ?? parseTargetReps(repRange);
        const displayW = convertWeightToActiveUnit(recWeightKg, unit);
        const equipInc = practicalIncrement(equipment, recWeightKg);
        const weightIncrement = typeof ex.weightIncrement === 'number' && ex.weightIncrement > 0
          ? Math.max(ex.weightIncrement, equipInc)
          : equipInc;

        return {
          id: ex.id || `ex-${exIdx}`,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment,
          targetRepRange: repRange,
          recommendedWeight: recWeightKg,
          recommendedReps: recReps,
          recommendation,
          weight: recWeightKg,
          weightText: formatWeight(displayW),
          weightIncrement,
          restSeconds: ex.restSeconds || resolveRestSeconds(ex as any, target as any),
          sets: Array.from({ length: setsCount }, (_, sIdx) => ({
            id: `set-${exIdx}-${sIdx}`,
            reps: 0,
            repsText: '',
            targetReps: repRange,
            completed: false,
          })),
        };
      });
      setExercises(mapped);
      setDurationMinutes(Math.max(20, Math.min(120, mapped.length * 8)));
      isInitializedRef.current = true;
    }
  }, [workoutId, activeSession, program, progress, history, unit]);

  // Fill all sets with target weights and target reps
  const handleFillAllAsPlanned = useCallback(() => {
    hapticSuccess();
    setExercises((prev) =>
      prev.map((ex) => {
        const targetRep = ex.recommendedReps || parseTargetReps(ex.targetRepRange);
        const weightKg = ex.recommendedWeight || 0;
        const displayW = fromKg(weightKg);
        return {
          ...ex,
          weight: weightKg,
          weightText: formatWeight(displayW),
          sets: ex.sets.map((s) => ({
            ...s,
            reps: targetRep,
            repsText: targetRep.toString(),
            completed: true,
          })),
        };
      })
    );
    setBannerMessage(t('allPlannedFilled'));
    setTimeout(() => setBannerMessage(null), 3500);
  }, [fromKg, t]);

  // Adjust Exercise Weight via Stepper
  const handleStepWeight = useCallback((exIdx: number, delta: number) => {
    hapticLight();
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== exIdx) return ex;
        const currentDisplay = parseFloat(ex.weightText.replace(',', '.')) || 0;
        const nextDisplay = Math.max(0, Math.round((currentDisplay + delta) * 10) / 10);
        const nextKg = toKg(nextDisplay);
        return {
          ...ex,
          weight: nextKg,
          weightText: formatWeight(nextDisplay),
        };
      })
    );
  }, [toKg]);

  // Direct Weight text change
  const handleWeightTextChange = useCallback((exIdx: number, text: string) => {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== exIdx) return ex;
        const parsed = parseFloat(text.replace(',', '.'));
        const nextKg = !isNaN(parsed) && parsed >= 0 ? toKg(Math.min(999, parsed)) : 0;
        return {
          ...ex,
          weight: nextKg,
          weightText: text,
        };
      })
    );
  }, [toKg]);

  // Set Reps change
  const handleSetRepsChange = useCallback((exIdx: number, setIdx: number, text: string) => {
    setExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, sIdx) => {
            if (sIdx !== setIdx) return s;
            const parsed = parseInt(text, 10);
            const valid = !isNaN(parsed) && parsed > 0;
            return {
              ...s,
              reps: valid ? parsed : 0,
              repsText: text,
              completed: valid,
            };
          }),
        };
      })
    );
  }, []);

  // Quick fill one exercise
  const handleFillExercise = useCallback((exIdx: number) => {
    hapticMedium();
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== exIdx) return ex;
        const targetRep = ex.recommendedReps || parseTargetReps(ex.targetRepRange);
        return {
          ...ex,
          sets: ex.sets.map((s) => ({
            ...s,
            reps: targetRep,
            repsText: targetRep.toString(),
            completed: true,
          })),
        };
      })
    );
  }, []);

  // Add Set to exercise
  const handleAddSet = useCallback((exIdx: number) => {
    hapticLight();
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== exIdx || ex.sets.length >= 15) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const fallbackRep = ex.recommendedReps || parseTargetReps(ex.targetRepRange);
        const newSet: QuickSet = {
          id: `set-${exIdx}-${Date.now()}`,
          reps: lastSet?.reps ?? fallbackRep,
          repsText: lastSet?.repsText || fallbackRep.toString(),
          targetReps: ex.targetRepRange,
          completed: true,
        };
        return {
          ...ex,
          sets: [...ex.sets, newSet],
        };
      })
    );
  }, []);

  // Remove Set from exercise
  const handleRemoveSet = useCallback((exIdx: number, setIdx: number) => {
    hapticLight();
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== exIdx || ex.sets.length <= 1) return ex;
        return {
          ...ex,
          sets: ex.sets.filter((_, sIdx) => sIdx !== setIdx),
        };
      })
    );
  }, []);

  // Add Exercise from Picker
  const handleSelectExerciseFromPicker = useCallback((libEx: LibraryExercise) => {
    hapticSuccess();
    const repRange = libEx.defaultRepRange || '8-12';
    const setsCount = libEx.defaultSets || 3;
    const isBw = typeof libEx.defaultWeight === 'number' && libEx.defaultWeight === 0;
    const equipment: EquipmentId = isBw ? 'bodyweight' : inferEquipmentFromName(libEx.name);
    const exId = libEx.id || libEx.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const generatedEx: GeneratedExercise = {
      id: exId,
      name: libEx.name,
      muscleGroup: libEx.muscleGroup,
      equipment,
      sets: setsCount,
      targetRepRange: repRange,
      recommendedWeight: libEx.defaultWeight || 0,
      weightIncrement: libEx.weightIncrement || practicalIncrement(equipment, libEx.defaultWeight || 0),
      restSeconds: 90,
    };
    const previousSets = findLatestExerciseSets(history, generatedEx);
    const recommendation = recommendWeight(generatedEx, previousSets);
    const recWeight = recommendation.source === 'history'
      ? recommendation.recommendedWeight
      : (libEx.defaultWeight || 0);
    const recReps = recommendation.recommendedReps ?? parseTargetReps(repRange);

    const newEx: QuickExercise = {
      id: exId,
      name: libEx.name,
      muscleGroup: libEx.muscleGroup,
      equipment,
      targetRepRange: repRange,
      recommendedWeight: recWeight,
      recommendedReps: recReps,
      recommendation,
      weight: recWeight,
      weightText: formatWeight(fromKg(recWeight)),
      weightIncrement: practicalIncrement(equipment, recWeight),
      restSeconds: 90,
      sets: Array.from({ length: setsCount }, (_, i) => ({
        id: `set-${Date.now()}-${i}`,
        reps: 0,
        repsText: '',
        targetReps: repRange,
        completed: false,
      })),
    };
    setExercises((prev) => [...prev, newEx]);
    setIsAddPickerVisible(false);
  }, [fromKg, history]);

  // Overall Live Stats
  const { totalCompletedSets, totalVolumeKg } = useMemo(() => {
    let completedSets = 0;
    let volumeKg = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (s.reps > 0) {
          completedSets++;
          volumeKg += ex.weight * s.reps;
        }
      }
    }
    return { totalCompletedSets: completedSets, totalVolumeKg: volumeKg };
  }, [exercises]);

  // Save Workout
  const handleSaveWorkout = async () => {
    if (isSaving) return;
    if (totalCompletedSets === 0) {
      hapticImpact();
      Alert.alert(
        language === 'uk' ? 'Увага' : 'Notice',
        t('noSetsCompletedWarning')
      );
      return;
    }

    hapticMedium();
    setIsSaving(true);

    try {
      // Calculate timestamps based on 'when' selection
      const nowMs = Date.now();
      let completedAtMs = nowMs;
      if (when === 'earlier') {
        completedAtMs = nowMs - 2 * 60 * 60 * 1000; // 2 hours ago
      } else if (when === 'yesterday') {
        completedAtMs = nowMs - 24 * 60 * 60 * 1000; // 24 hours ago
      }

      const startedAtMs = completedAtMs - durationMinutes * 60 * 1000;
      const startedAt = new Date(startedAtMs).toISOString();
      const completedAt = new Date(completedAtMs).toISOString();
      const workoutDate = new Date(completedAtMs).toISOString().slice(0, 10);

      // Convert QuickExercise[] to standard WorkoutExercise[]
      const canonicalExercises: WorkoutExercise[] = exercises.map((ex, exIdx) => {
        const canonicalSets: WorkoutSet[] = ex.sets.map((s, sIdx) => ({
          id: s.id || `quick-set-${exIdx}-${sIdx}`,
          weight: Math.round(ex.weight * 100) / 100,
          reps: s.reps > 0 ? s.reps : 0,
          targetReps: s.targetReps || ex.targetRepRange,
          completed: s.reps > 0,
          completedAt: s.reps > 0 ? completedAt : undefined,
        }));

        return {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment || inferEquipmentFromName(ex.name),
          previousSets: [],
          recommendation: ex.recommendation || {
            recommendedWeight: ex.recommendedWeight,
            recommendedReps: ex.recommendedReps,
            recommendationReason: 'maintain',
            source: 'program_default',
            explanation: '',
          },
          weightIncrement: ex.weightIncrement,
          restSeconds: ex.restSeconds,
          sets: canonicalSets,
        };
      });

      const session: WorkoutSession = {
        id: `session-quick-${Date.now()}`,
        programWorkoutId: programWorkoutId || 'custom-quick-workout',
        workoutName: workoutName || (language === 'uk' ? 'Швидке тренування' : 'Quick Workout'),
        workoutDate,
        startedAt,
        completedAt,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        exercises: canonicalExercises,
        personalRecords: [],
        completed: true,
      };

      // Set session in store
      useWorkoutSessionStore.setState({
        session,
        restEndsAt: null,
        restNextType: null,
      });

      // Run unified canonical finalization pipeline
      await finalizeWorkoutSession(session);

      // Navigate to summary screen
      router.replace('/workout/complete');
    } catch (err) {
      console.error('Failed to save quick log workout:', err);
      setIsSaving(false);
      Alert.alert(
        language === 'uk' ? 'Помилка' : 'Error',
        language === 'uk' ? 'Не вдалося зберегти тренування. Спробуйте ще раз.' : 'Failed to save workout. Please try again.'
      );
    }
  };

  // Discard back confirmation
  const handleBack = () => {
    hapticLight();
    if (totalCompletedSets > 0) {
      Alert.alert(
        t('discardQuickLogTitle'),
        t('discardQuickLogMessage'),
        [
          { text: t('keepEditing'), style: 'cancel' },
          {
            text: t('discard'),
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const stepVal = unit === 'lbs' ? 5 : 2.5;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 1. Header Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={handleBack}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerSub} numberOfLines={1}>
              {tw(workoutName)}
            </Text>
            <Text style={styles.headerLabel}>{t('quickLog')}</Text>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Subtle toast message banner */}
        {bannerMessage && (
          <View style={styles.bannerToast}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primaryText} />
            <Text style={styles.bannerToastText}>{bannerMessage}</Text>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 2. Top Quick Actions Card */}
          <View style={styles.quickCard}>
            <Pressable
              accessibilityRole="button"
              onPress={handleFillAllAsPlanned}
              style={({ pressed }) => [styles.fillAllBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="flash" size={16} color={colors.primaryText} style={{ marginRight: 6 }} />
              <Text style={styles.fillAllBtnText}>{t('fillAllAsPlanned')}</Text>
            </Pressable>

            {/* When / Duration Selectors */}
            <View style={styles.timeSectionRow}>
              <View style={styles.whenCol}>
                <Text style={styles.timeLabel}>{t('whenDidYouTrain')}</Text>
                <View style={styles.whenPillsRow}>
                  {(['now', 'earlier', 'yesterday'] as WhenOption[]).map((opt) => {
                    const isSelected = when === opt;
                    const label =
                      opt === 'now'
                        ? t('todayNow')
                        : opt === 'earlier'
                        ? t('todayEarlier')
                        : t('yesterday');
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => {
                          hapticLight();
                          setWhen(opt);
                        }}
                        style={[styles.whenPill, isSelected && styles.whenPillActive]}
                      >
                        <Text style={[styles.whenPillText, isSelected && styles.whenPillTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* 3. Exercises List */}
          <View style={styles.exercisesList}>
            {exercises.map((ex, exIdx) => {
              const displayRec = formatWeight(fromKg(ex.recommendedWeight));
              const hasCompletedSets = ex.sets.some((s) => s.reps > 0);

              return (
                <View key={ex.id || `ex-${exIdx}`} style={styles.exerciseCard}>
                  {/* Card Header: Name + Unified Meta + Quick Fill Exercise */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.exerciseName}>{te(ex.name)}</Text>
                      <Text style={styles.targetInfo}>
                        {tm(ex.muscleGroup)} · {t('fillTarget')}:{' '}
                        {ex.recommendedWeight > 0
                          ? `${displayRec} ${unitLabel}`
                          : t('bodyweight')}{' '}
                        × {ex.targetRepRange}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => handleFillExercise(exIdx)}
                      style={[
                        styles.quickFillExBtn,
                        hasCompletedSets && styles.quickFillExBtnActive,
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={hasCompletedSets ? colors.primaryText : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.quickFillExBtnText,
                          hasCompletedSets && styles.quickFillExBtnTextActive,
                        ]}
                      >
                        {language === 'uk' ? 'За планом' : 'Target'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Weight Row */}
                  <View style={styles.weightConfigRow}>
                    <Text style={styles.fieldLabel}>
                      {t('weight')} ({unitLabel})
                    </Text>

                    <View style={styles.stepperWrap}>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => handleStepWeight(exIdx, -stepVal)}
                        style={styles.stepBtn}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>

                      <TextInput
                        style={styles.weightInput}
                        maxLength={5}
                        keyboardType="decimal-pad"
                        value={ex.weightText}
                        onChangeText={(txt) => handleWeightTextChange(exIdx, txt)}
                        selectTextOnFocus
                        placeholder="0"
                        placeholderTextColor="#6C7A8E"
                      />

                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => handleStepWeight(exIdx, stepVal)}
                        style={styles.stepBtn}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Reps Row */}
                  <View style={styles.repsSection}>
                    <View style={styles.repsHeaderRow}>
                      <Text style={styles.fieldLabel}>{t('repsPerSet')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {ex.sets.length > 1 && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => handleRemoveSet(exIdx, ex.sets.length - 1)}
                            style={styles.removeSetBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="remove" size={13} color="#94A3B8" />
                            <Text style={styles.removeSetBtnText}>{t('delete')}</Text>
                          </Pressable>
                        )}
                        {ex.sets.length < 15 && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleAddSet(exIdx)}
                          style={styles.addSetBtn}
                          hitSlop={6}
                        >
                          <Ionicons name="add" size={14} color={colors.text} />
                          <Text style={styles.addSetBtnText}>{t('addSetBtn')}</Text>
                        </Pressable>
                        )}
                      </View>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.setsScrollRow}
                    >
                      {ex.sets.map((set, sIdx) => {
                        const isSetFilled = set.reps > 0;
                        return (
                          <View
                            key={set.id || `set-${sIdx}`}
                            style={[
                              styles.setBox,
                              isSetFilled && styles.setBoxFilled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.setIndexLabel,
                                isSetFilled && styles.setIndexLabelFilled,
                              ]}
                            >
                              {sIdx + 1}
                            </Text>

                            <TextInput
                              style={[
                                styles.repsInput,
                                isSetFilled && styles.repsInputFilled,
                              ]}
                              keyboardType="number-pad"
                              value={set.repsText}
                              onChangeText={(txt) =>
                                handleSetRepsChange(exIdx, sIdx, txt)
                              }
                              selectTextOnFocus
                              placeholder={parseTargetReps(set.targetReps).toString()}
                              placeholderTextColor="#4B5563"
                              maxLength={3}
                            />
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              );
            })}

            {/* Add Exercise CTA */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setIsAddPickerVisible(true);
              }}
              style={({ pressed }) => [styles.addExerciseCard, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={styles.addExerciseCardText}>{t('addExercise')}</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* 4. Bottom Sticky Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryMetaItem}>
              <Ionicons name="checkmark-done" size={15} color={colors.primaryText} />
              <Text style={styles.summaryMetaText}>
                {totalCompletedSets} {language === 'uk' ? 'підходів' : 'sets'}
              </Text>
            </View>

            <View style={styles.summaryMetaItem}>
              <MaterialCommunityIcons name="dumbbell" size={15} color="#8E9BAE" />
              <Text style={styles.summaryMetaText}>
                {Math.round(totalVolumeKg)} {unitLabel}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleSaveWorkout}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.btnPressed,
              isSaving && { opacity: 0.7 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#0B0D0F" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={19} color="#0B0D0F" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>{t('saveWorkout')}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Exercise Picker Modal */}
        <ExercisePickerModal
          visible={isAddPickerVisible}
          onClose={() => setIsAddPickerVisible(false)}
          onSelect={handleSelectExerciseFromPicker}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerSub: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerLabel: {
    color: colors.secondary,
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightPlaceholder: {
    width: 38,
  },
  bannerToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 8,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  bannerToastText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  quickCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  fillAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
    height: 44,
    borderRadius: 12,
  },
  fillAllBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  timeSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  whenCol: {
    flex: 1,
    gap: 6,
  },
  timeLabel: {
    color: colors.secondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  whenPillsRow: {
    flexDirection: 'row',
    backgroundColor: colors.elevated,
    padding: 3,
    borderRadius: 11,
    gap: 4,
  },
  whenPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whenPillActive: {
    backgroundColor: colors.surface,
  },
  whenPillText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  whenPillTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  exercisesList: {
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15.5,
    fontWeight: '700',
  },
  targetInfo: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  quickFillExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.elevated,
  },
  quickFillExBtnActive: {
    backgroundColor: colors.primaryMuted,
  },
  quickFillExBtnText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickFillExBtnTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  weightConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  fieldLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInput: {
    minWidth: 52,
    height: 36,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 6,
    fontVariant: ['tabular-nums'],
  },
  repsSection: {
    gap: 8,
  },
  repsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.elevated,
    borderRadius: 8,
  },
  removeSetBtnText: {
    color: colors.secondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.elevated,
    borderRadius: 8,
  },
  addSetBtnText: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '600',
  },
  setsScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  setBox: {
    width: 66,
    height: 62,
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingTop: 7,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  setBoxFilled: {
    backgroundColor: colors.primaryMuted,
  },
  setIndexLabel: {
    color: colors.secondary,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  setIndexLabelFilled: {
    color: colors.primaryText,
  },
  repsInput: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    height: 30,
    width: '100%',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontVariant: ['tabular-nums'],
  },
  repsInputFilled: {
    color: colors.primaryText,
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 6,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.border,
  },
  addExerciseCardText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  summaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryMetaText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
