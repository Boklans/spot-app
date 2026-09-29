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
import { colors } from '@/constants/colors';
import { type LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { resolveRestSeconds } from '@/lib/programGenerator';
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
  targetRepRange: string;
  recommendedWeight: number; // in kg
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
        return {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetRepRange: firstSet?.targetReps ?? '8-12',
          recommendedWeight: ex.recommendation.recommendedWeight,
          weight: weightKg,
          weightText: formatWeight(displayW),
          weightIncrement: ex.weightIncrement || 2.5,
          restSeconds: ex.restSeconds || 90,
          sets: ex.sets.map((s) => ({
            id: s.id,
            reps: s.reps,
            repsText: s.reps > 0 ? s.reps.toString() : '',
            targetReps: s.targetReps || '8-12',
            completed: s.completed,
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
        const recWeightKg = ex.recommendedWeight || 0;
        const displayW = convertWeightToActiveUnit(recWeightKg, unit);
        const repRange = ex.targetRepRange || '8-12';
        const defaultRep = parseTargetReps(repRange);
        const setsCount = ex.sets || 3;

        return {
          id: ex.id || `ex-${exIdx}`,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetRepRange: repRange,
          recommendedWeight: recWeightKg,
          weight: recWeightKg,
          weightText: formatWeight(displayW),
          weightIncrement: ex.weightIncrement || 2.5,
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
  }, [workoutId, activeSession, program, progress, unit]);

  // Fill all sets with target weights and target reps
  const handleFillAllAsPlanned = useCallback(() => {
    hapticSuccess();
    setExercises((prev) =>
      prev.map((ex) => {
        const targetRep = parseTargetReps(ex.targetRepRange);
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
        const nextKg = !isNaN(parsed) && parsed >= 0 ? toKg(parsed) : 0;
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
        const targetRep = parseTargetReps(ex.targetRepRange);
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
        if (idx !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: QuickSet = {
          id: `set-${exIdx}-${Date.now()}`,
          reps: lastSet?.reps ?? parseTargetReps(ex.targetRepRange),
          repsText: lastSet?.repsText || parseTargetReps(ex.targetRepRange).toString(),
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
    const defaultReps = parseTargetReps(libEx.defaultRepRange || '8-12');
    const recWeight = libEx.defaultWeight || 0;
    const newEx: QuickExercise = {
      id: `custom-quick-${Date.now()}`,
      name: libEx.name,
      muscleGroup: libEx.muscleGroup,
      targetRepRange: libEx.defaultRepRange || '8-12',
      recommendedWeight: recWeight,
      weight: recWeight,
      weightText: formatWeight(fromKg(recWeight)),
      weightIncrement: libEx.weightIncrement || 2.5,
      restSeconds: 90,
      sets: Array.from({ length: libEx.defaultSets || 3 }, (_, i) => ({
        id: `set-${Date.now()}-${i}`,
        reps: 0,
        repsText: '',
        targetReps: libEx.defaultRepRange || '8-12',
        completed: false,
      })),
    };
    setExercises((prev) => [...prev, newEx]);
    setIsAddPickerVisible(false);
  }, [fromKg]);

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
          previousSets: [],
          recommendation: {
            recommendedWeight: ex.recommendedWeight,
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
    <SafeAreaView style={styles.safe} edges={['top']}>
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
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerLabel}>{t('quickLog').toUpperCase()}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {tw(workoutName)}
            </Text>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Subtle toast message banner */}
        {bannerMessage && (
          <View style={styles.bannerToast}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
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
              <Ionicons name="flash" size={16} color="#0B0D0F" style={{ marginRight: 6 }} />
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
                  {/* Card Header: Muscle Tag + Name + Quick Fill Exercise */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.muscleTag}>
                        {tm(ex.muscleGroup).toUpperCase()}
                      </Text>
                      <Text style={styles.exerciseName}>{te(ex.name)}</Text>
                      <Text style={styles.targetInfo}>
                        {t('fillTarget')}:{' '}
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
                        color={hasCompletedSets ? colors.primary : '#8E959F'}
                      />
                      <Text
                        style={[
                          styles.quickFillExBtnText,
                          hasCompletedSets && styles.quickFillExBtnTextActive,
                        ]}
                      >
                        {language === 'uk' ? 'По плану' : 'Target'}
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
                        <Ionicons name="remove" size={18} color="#FFFFFF" />
                      </Pressable>

                      <TextInput
                        style={styles.weightInput}
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
                        <Ionicons name="add" size={18} color="#FFFFFF" />
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
                            <Ionicons name="remove-circle-outline" size={14} color="#8E959F" />
                            <Text style={styles.removeSetBtnText}>{t('delete')}</Text>
                          </Pressable>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleAddSet(exIdx)}
                          style={styles.addSetBtn}
                          hitSlop={6}
                        >
                          <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                          <Text style={styles.addSetBtnText}>{t('addSetBtn')}</Text>
                        </Pressable>
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
                              {t('set').toUpperCase()} {sIdx + 1}
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
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addExerciseCardText}>{t('addExercise')}</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* 4. Bottom Sticky Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryMetaItem}>
              <Ionicons name="layers-outline" size={14} color={colors.primary} />
              <Text style={styles.summaryMetaText}>
                {totalCompletedSets} {language === 'uk' ? 'підходів' : 'sets'}
              </Text>
            </View>

            <View style={styles.summaryMetaItem}>
              <MaterialCommunityIcons name="dumbbell" size={15} color="#8E959F" />
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#161B22',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSub: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  bannerToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16221C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1F3A2B',
  },
  bannerToastText: {
    color: colors.primary,
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
    gap: 16,
  },
  quickCard: {
    backgroundColor: '#12171E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D2531',
    gap: 12,
  },
  fillAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: 12,
  },
  fillAllBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    color: '#8E959F',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  whenPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  whenPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#19212C',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  whenPillActive: {
    backgroundColor: '#1F2A38',
    borderColor: colors.primary,
  },
  whenPillText: {
    color: '#8E959F',
    fontSize: 11,
    fontWeight: '600',
  },
  whenPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  exercisesList: {
    gap: 14,
  },
  exerciseCard: {
    backgroundColor: '#12171E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1D2531',
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  muscleTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  targetInfo: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  quickFillExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#18202C',
    borderWidth: 1,
    borderColor: '#242F40',
  },
  quickFillExBtnActive: {
    backgroundColor: '#16231E',
    borderColor: '#284E38',
  },
  quickFillExBtnText: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '700',
  },
  quickFillExBtnTextActive: {
    color: colors.primary,
  },
  weightConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#1A212C',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18202B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232D3B',
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInput: {
    minWidth: 50,
    height: 36,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 6,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#19202A',
    borderRadius: 8,
  },
  removeSetBtnText: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '600',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#16231E',
    borderRadius: 8,
  },
  addSetBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  setsScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  setBox: {
    width: 68,
    height: 64,
    backgroundColor: '#151D28',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#202A38',
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  setBoxFilled: {
    backgroundColor: '#14231C',
    borderColor: '#274D37',
  },
  setIndexLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  setIndexLabelFilled: {
    color: colors.primary,
  },
  repsInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    height: 32,
    width: '100%',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  repsInputFilled: {
    color: colors.primary,
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#232D3B',
    borderStyle: 'dashed',
    backgroundColor: '#10151C',
    gap: 8,
  },
  addExerciseCardText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#0F1318',
    borderTopWidth: 1,
    borderTopColor: '#1A212C',
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
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
