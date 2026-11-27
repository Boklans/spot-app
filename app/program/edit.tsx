import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import { WorkoutDayEditor } from '@/components/program/WorkoutDayEditor';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { generateUUID } from '@/lib/programMigration';
import { ALL_WEEKDAYS, getNextAvailableWeekday, getWorkoutDayLabel } from '@/lib/programGenerator';
import { useI18n } from '@/lib/i18n';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useProgramStore } from '@/store/programStore';
import { defaultOnboarding, loadOnboarding, saveOnboarding } from '@/store/workoutStore';
import type { UserExercise, UserProgram, UserWorkout } from '@/types/userProgram';

export default function ProgramEdit() {
  const { t, tm, td, te, tq, language } = useI18n();
  const { unitLabel, step: weightStep, fromKg, toKg } = useWeightUnit();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeProgram = useProgramStore((state) => state.program);
  const setCustomProgram = useProgramStore((state) => state.setCustomProgram);
  const saveRoutine = useProgramStore((state) => state.saveRoutine);

  // Track if user made modifications in this editing session
  const isDirtyRef = useRef(false);

  // Local draft state holding deep clone of the active program
  const [draft, setDraft] = useState<UserProgram>(() =>
    JSON.parse(JSON.stringify(activeProgram))
  );

  // Sub-view navigation state: null = Program Editor; string = Workout Editor
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Exercise Picker Modal state
  const [isExercisePickerVisible, setIsExercisePickerVisible] = useState(false);

  // Local raw text input buffers for decimal numbers to prevent decimal-point stripping during typing
  const [rawWeightInputs, setRawWeightInputs] = useState<Record<string, string>>({});
  const [rawIncrementInputs, setRawIncrementInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    useProgramStore.getState().getOrLoadProgram().then((loaded) => {
      if (isMounted && loaded && !isDirtyRef.current) {
        setDraft(JSON.parse(JSON.stringify(loaded)));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Program Level Handlers
  const handleProgramNameChange = (name: string) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      name,
    }));
  };

  const handleMoveWorkoutUp = (index: number) => {
    if (index <= 0) return;
    hapticMedium();
    isDirtyRef.current = true;
    setDraft((prev) => {
      const workouts = [...prev.workouts];
      const temp = workouts[index - 1];
      workouts[index - 1] = workouts[index];
      workouts[index] = temp;
      return { ...prev, workouts };
    });
  };

  const handleMoveWorkoutDown = (index: number) => {
    if (index >= draft.workouts.length - 1) return;
    hapticMedium();
    isDirtyRef.current = true;
    setDraft((prev) => {
      if (index >= prev.workouts.length - 1) return prev;
      const workouts = [...prev.workouts];
      const temp = workouts[index + 1];
      workouts[index + 1] = workouts[index];
      workouts[index] = temp;
      return { ...prev, workouts };
    });
  };

  const handleDeleteWorkout = (workoutId: string) => {
    if (draft.workouts.length <= 1) {
      Alert.alert(
        language === 'uk' ? 'Неможливо видалити' : 'Cannot delete',
        language === 'uk'
          ? 'У вашій програмі має бути хоча б одне тренування.'
          : 'Your program must have at least one workout.'
      );
      return;
    }

    Alert.alert(
      language === 'uk' ? 'Видалити тренування?' : 'Delete workout day?',
      language === 'uk'
        ? 'Цей день тренування та всі його вправи будуть видалені з програми.'
        : 'This workout day and all its exercises will be removed from your program.',
      [
        { text: language === 'uk' ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: language === 'uk' ? 'Видалити' : 'Delete',
          style: 'destructive',
          onPress: () => {
            hapticMedium();
            isDirtyRef.current = true;
            setDraft((prev) => {
              const filtered = prev.workouts.filter((w) => w.id !== workoutId);
              return {
                ...prev,
                workouts: filtered,
                daysPerWeek: Math.min(prev.daysPerWeek, filtered.length),
              };
            });

            if (selectedWorkoutId === workoutId) {
              setSelectedWorkoutId(null);
            }
          },
        },
      ]
    );
  };

  const handleAddNewWorkout = () => {
    hapticMedium();
    isDirtyRef.current = true;
    const count = draft.workouts.length;
    const letter = String.fromCharCode(65 + count);
    const nextWeekday = getNextAvailableWeekday(draft.workouts);
    const newWorkout: UserWorkout = {
      id: generateUUID(),
      name: language === 'uk' ? `Тренування ${letter}` : `Workout ${letter}`,
      dayLabel: nextWeekday,
      muscleGroups: [],
      estimatedMinutes: 45,
      defaultRestSeconds: 90,
      exercises: [],
    };

    setDraft((prev) => ({
      ...prev,
      daysPerWeek: Math.min(7, prev.workouts.length + 1),
      workouts: [...prev.workouts, newWorkout],
    }));

    setSelectedWorkoutId(newWorkout.id);
  };

  // Workout Level Handlers
  const handleWorkoutNameChange = (workoutId: string, name: string) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => (w.id === workoutId ? { ...w, name } : w)),
    }));
  };

  const handleWorkoutDayLabelChange = (workoutId: string, dayLabel: string) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => (w.id === workoutId ? { ...w, dayLabel } : w)),
    }));
  };

  // Exercise Level Handlers
  const handleMoveExerciseUp = (workoutId: string, exerciseIndex: number) => {
    if (exerciseIndex <= 0) return;
    hapticMedium();
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        const exercises = [...w.exercises];
        const temp = exercises[exerciseIndex - 1];
        exercises[exerciseIndex - 1] = exercises[exerciseIndex];
        exercises[exerciseIndex] = temp;
        return {
          ...w,
          exercises: exercises.map((ex, i) =>
            i === exercises.length - 1 ? { ...ex, supersetWithNext: false } : ex
          ),
        };
      }),
    }));
  };

  const handleMoveExerciseDown = (workoutId: string, exerciseIndex: number) => {
    const currentWorkout = draft.workouts.find((w) => w.id === workoutId);
    if (!currentWorkout || exerciseIndex >= currentWorkout.exercises.length - 1) return;
    hapticMedium();
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        if (exerciseIndex >= w.exercises.length - 1) return w;
        const exercises = [...w.exercises];
        const temp = exercises[exerciseIndex + 1];
        exercises[exerciseIndex + 1] = exercises[exerciseIndex];
        exercises[exerciseIndex] = temp;
        return {
          ...w,
          exercises: exercises.map((ex, i) =>
            i === exercises.length - 1 ? { ...ex, supersetWithNext: false } : ex
          ),
        };
      }),
    }));
  };

  const handleToggleSuperset = (workoutId: string, exerciseIndex: number) => {
    hapticMedium();
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        if (exerciseIndex < 0 || exerciseIndex >= w.exercises.length - 1) return w;
        const targetWillEnable = !w.exercises[exerciseIndex].supersetWithNext;
        return {
          ...w,
          exercises: w.exercises.map((ex, i) => {
            if (i === exerciseIndex) {
              return { ...ex, supersetWithNext: targetWillEnable };
            }
            if (targetWillEnable && (i === exerciseIndex - 1 || i === exerciseIndex + 1)) {
              return { ...ex, supersetWithNext: false };
            }
            return ex;
          }),
        };
      }),
    }));
  };

  const handleDeleteExercise = (workoutId: string, exerciseId: string) => {
    const currentWorkout = draft.workouts.find((w) => w.id === workoutId);
    if (currentWorkout && currentWorkout.exercises.length <= 1) {
      Alert.alert('Cannot delete', 'Each workout must have at least one exercise.');
      return;
    }

    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        const remainingExercises = w.exercises
          .filter((ex) => ex.id !== exerciseId)
          .map((ex, i, arr) =>
            i === arr.length - 1 ? { ...ex, supersetWithNext: false } : ex
          );
        const updatedMuscles = [...new Set(remainingExercises.map((e) => e.muscleGroup))];
        return {
          ...w,
          muscleGroups: updatedMuscles,
          exercises: remainingExercises,
        };
      }),
    }));
  };

  const handleAddExercisesBatch = (workoutId: string, libItems: LibraryExercise[]) => {
    if (libItems.length === 0) return;
    isDirtyRef.current = true;
    const mapped: UserExercise[] = libItems.map((libExercise) => ({
      id: generateUUID(),
      name: libExercise.name,
      muscleGroup: libExercise.muscleGroup,
      sets: libExercise.defaultSets ?? 3,
      recommendedWeight: libExercise.defaultWeight ?? 0,
      targetRepRange: libExercise.defaultRepRange ?? '8-12',
      equipment: libExercise.equipment,
      weightIncrement: libExercise.weightIncrement ?? 2.5,
      restSeconds: 90,
      customImageUri: libExercise.customImageUri,
      isCustom: libExercise.isCustom,
    }));

    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        const nextExercises = [...w.exercises, ...mapped];
        const updatedMuscles = [...new Set(nextExercises.map((e) => e.muscleGroup))];
        return {
          ...w,
          muscleGroups: updatedMuscles,
          estimatedMinutes: Math.max(30, nextExercises.length * 9),
          exercises: nextExercises,
        };
      }),
    }));
    hapticSuccess();
  };

  const handleAddExercise = (workoutId: string, libExercise: LibraryExercise) => {
    handleAddExercisesBatch(workoutId, [libExercise]);
  };

  const handleUpdateExercise = (
    workoutId: string,
    exerciseId: string,
    updates: Partial<UserExercise>
  ) => {
    isDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        return {
          ...w,
          exercises: w.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, ...updates } : ex)),
        };
      }),
    }));
  };

  const handleSetsDelta = (workoutId: string, exercise: UserExercise, delta: number) => {
    hapticLight();
    isDirtyRef.current = true;
    const nextSets = Math.max(1, Math.min(15, exercise.sets + delta));
    handleUpdateExercise(workoutId, exercise.id, { sets: nextSets });
  };

  const handleWeightDelta = (workoutId: string, exercise: UserExercise, deltaDisplay: number) => {
    hapticLight();
    isDirtyRef.current = true;
    const currentDisplay = fromKg(exercise.recommendedWeight || 0);
    const nextDisplay = Math.max(0, Math.min(999, parseFloat((currentDisplay + deltaDisplay).toFixed(2))));
    setRawWeightInputs((prev) => ({ ...prev, [exercise.id]: formatWeight(nextDisplay) }));
    handleUpdateExercise(workoutId, exercise.id, { recommendedWeight: toKg(nextDisplay) });
  };

  // Top Level Save / Cancel Handlers + Android BackHandler
  const handleCancel = useCallback(() => {
    if (!isDirtyRef.current) {
      router.back();
      return;
    }
    Alert.alert(
      language === 'uk' ? 'Скасувати зміни?' : 'Discard Changes?',
      language === 'uk'
        ? 'Усі незбережені зміни програми буде втрачено.'
        : 'All unsaved edits to your routine will be lost.',
      [
        { text: language === 'uk' ? 'Продовжити редагування' : 'Keep Editing', style: 'cancel' },
        {
          text: language === 'uk' ? 'Скасувати зміни' : 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  }, [language]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExercisePickerVisible) {
        setIsExercisePickerVisible(false);
        return true;
      }
      if (selectedWorkoutId) {
        setSelectedWorkoutId(null);
        return true;
      }
      handleCancel();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isExercisePickerVisible, selectedWorkoutId, handleCancel]);

  const handleSave = async () => {
    const trimmed = draft.name.trim();
    if (!trimmed) {
      Alert.alert(t('validationError'), t('programNameEmpty'));
      return;
    }
    if (draft.workouts.length === 0) {
      Alert.alert(t('validationError'), t('programMustHaveWorkout'));
      return;
    }

    // Ensure all workouts have at least one exercise
    for (const w of draft.workouts) {
      if (!w.exercises || w.exercises.length === 0) {
        Alert.alert(
          language === 'uk' ? 'Порожнє тренування' : 'Empty Workout',
          language === 'uk'
            ? `Тренування "${w.name}" не містить вправ. Додайте хоча б одну вправу перед збереженням.`
            : `Workout "${w.name}" has no exercises. Please add at least one exercise before saving.`
        );
        return;
      }
    }

    // Pass the full draft object deeply cloned and guaranteed splitType: 'custom'
    const customProgram: UserProgram = {
      ...JSON.parse(JSON.stringify(draft)),
      name: trimmed,
      splitType: 'custom',
    };

    await setCustomProgram(customProgram);

    try {
      const currentOnboarding = await loadOnboarding();
      await saveOnboarding({
        ...(currentOnboarding ?? defaultOnboarding),
        splitPreference: 'custom',
      });
    } catch {
      // Storage error ignored
    }

    hapticSuccess();
    router.back();
  };

  const selectedWorkout = selectedWorkoutId
    ? draft.workouts.find((w) => w.id === selectedWorkoutId)
    : null;

  // Render Sub-View: Workout Editor (64pt Accordion via WorkoutDayEditor)
  if (selectedWorkoutId && selectedWorkout) {
    return (
      <Screen>
        {/* Workout Editor Top Header */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedWorkoutId(null)}
            style={styles.navButton}
          >
            <Text style={styles.cancelText}>‹ {t('routine')}</Text>
          </Pressable>
          <Text style={styles.topTitle}>{t('editWorkout')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete workout day"
              hitSlop={8}
              onPress={() => handleDeleteWorkout(selectedWorkout.id)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedWorkoutId(null)}
              style={styles.navButton}
            >
              <Text style={styles.saveNavText}>{t('done')}</Text>
            </Pressable>
          </View>
        </View>

        <WorkoutDayEditor
          workoutName={selectedWorkout.name}
          dayLabel={selectedWorkout.dayLabel || 'MON'}
          exercises={selectedWorkout.exercises}
          onChangeWorkoutName={(text) => handleWorkoutNameChange(selectedWorkout.id, text)}
          onChangeDayLabel={(day) => handleWorkoutDayLabelChange(selectedWorkout.id, day)}
          onUpdateExercise={(index, patch) => {
            const targetEx = selectedWorkout.exercises[index];
            if (targetEx) {
              handleUpdateExercise(selectedWorkout.id, targetEx.id, patch);
            }
          }}
          onMoveExerciseUp={(index) => handleMoveExerciseUp(selectedWorkout.id, index)}
          onMoveExerciseDown={(index) => handleMoveExerciseDown(selectedWorkout.id, index)}
          onToggleSuperset={(index) => handleToggleSuperset(selectedWorkout.id, index)}
          onRemoveExercise={(index) => {
            const targetEx = selectedWorkout.exercises[index];
            if (targetEx) {
              handleDeleteExercise(selectedWorkout.id, targetEx.id);
            }
          }}
          onOpenAddExercises={() => setIsExercisePickerVisible(true)}
        />

        {/* Delete Workout Day Button */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete Workout Day"
            onPress={() => handleDeleteWorkout(selectedWorkout.id)}
            style={({ pressed }) => [styles.deleteWorkoutFullBtn, pressed && styles.buttonPressed]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteWorkoutFullText}>
              {language === 'uk' ? 'Видалити цей день тренування' : 'Delete this workout day'}
            </Text>
          </Pressable>
        </View>

        {/* Done Button */}
        <View style={styles.bottomActions}>
          <Button onPress={() => setSelectedWorkoutId(null)}>{t('done').toUpperCase()}</Button>
        </View>

        {/* Unified Exercise Picker Modal (Supports Multi-Select Batch Adding!) */}
        <ExercisePickerModal
          visible={isExercisePickerVisible}
          onClose={() => setIsExercisePickerVisible(false)}
          onSelect={(libExercise) => handleAddExercise(selectedWorkout.id, libExercise)}
          onSelectMultiple={(items) => handleAddExercisesBatch(selectedWorkout.id, items)}
        />
      </Screen>
    );
  }

  // Render Main View: Program Editor
  return (
    <Screen>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={handleCancel} style={styles.navButton}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t('editProgram')}</Text>
        <Pressable accessibilityRole="button" onPress={handleSave} style={styles.navButton}>
          <Text style={styles.saveNavText}>{t('save')}</Text>
        </Pressable>
      </View>

      {/* Program Name Input */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('programName')}</Text>
        <TextInput
          value={draft.name}
          onChangeText={handleProgramNameChange}
          placeholder="Program Name"
          placeholderTextColor={colors.muted}
          style={styles.textInput}
          autoCapitalize="words"
        />
      </View>

      {/* Workouts List */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{t('sessions')} ({draft.workouts.length})</Text>
          <Text style={styles.subHelpText}>{t('reorderHelp')}</Text>
        </View>

        {draft.workouts.map((workout, index) => {
          const isFirst = index === 0;
          const isLast = index === draft.workouts.length - 1;

          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedWorkoutId(workout.id)}
                style={styles.cardHeader}
              >
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutIndex}>
                    {td(getWorkoutDayLabel(workout.dayLabel, index, undefined, draft.workouts.length))}
                  </Text>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {workout.exercises.length} {t('exercises').toLowerCase()}  •  ~{workout.estimatedMinutes} {t('min')}
                  </Text>
                  <Text style={styles.workoutFocus}>
                    {workout.muscleGroups.map((m) => tm(m)).join(' • ')}
                  </Text>
                </View>
                <Text style={styles.chevronArrow}>›</Text>
              </Pressable>

              {/* Action Buttons Row */}
              <View style={styles.actionsRow}>
                <View style={styles.reorderButtons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleMoveWorkoutUp(index)}
                    disabled={isFirst}
                    style={({ pressed }) => [
                      styles.iconButton,
                      isFirst && styles.iconButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.iconText, isFirst && styles.iconTextDisabled]}>▲ {t('moveUp')}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleMoveWorkoutDown(index)}
                    disabled={isLast}
                    style={({ pressed }) => [
                      styles.iconButton,
                      isLast && styles.iconButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.iconText, isLast && styles.iconTextDisabled]}>▼ {t('moveDown')}</Text>
                  </Pressable>
                </View>

                <View style={styles.rightActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedWorkoutId(workout.id)}
                    style={({ pressed }) => [
                      styles.editWorkoutButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.editWorkoutText}>{t('edit')}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleDeleteWorkout(workout.id)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.deleteText}>{t('delete')}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })}

        {/* Add Workout Button */}
        <Pressable
          accessibilityRole="button"
          onPress={handleAddNewWorkout}
          style={({ pressed }) => [styles.addWorkoutButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primaryText} />
          <Text style={styles.addWorkoutText}>
            {language === 'uk' ? 'ДОДАТИ НОВЕ ТРЕНУВАННЯ' : 'ADD NEW WORKOUT'}
          </Text>
        </Pressable>
      </View>

      {/* Bottom Save / Cancel Controls */}
      <View style={styles.bottomActions}>
        <Button onPress={handleSave}>{t('saveChanges').toUpperCase()}</Button>
        <Button secondary onPress={handleCancel}>{t('discardChanges')}</Button>
      </View>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  navButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 60,
  },
  cancelText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '700',
  },
  topTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  saveNavText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: spacing.sm,
  },
  subHelpText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  workoutSubFocus: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  workoutCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutIndex: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  workoutName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  workoutMeta: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  workoutFocus: {
    color: colors.muted,
    fontSize: 12,
  },
  chevronArrow: {
    color: colors.secondary,
    fontSize: 24,
    paddingLeft: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    backgroundColor: colors.elevated,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  iconText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  iconTextDisabled: {
    color: colors.muted,
  },
  editWorkoutButton: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  editWorkoutText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.3)',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  bottomActions: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },

  /* Exercise Card Styles */
  exerciseCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  exerciseMetaCol: {
    flex: 1,
  },
  exerciseTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  exerciseMuscle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miniIconButton: {
    backgroundColor: colors.elevated,
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniIconText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  miniDeleteButton: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.3)',
    marginLeft: spacing.xs,
  },
  miniDeleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  variablesGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  variableCol: {
    flex: 1,
  },
  variableLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  variableLabelRow: {
    height: 22,
    justifyContent: 'center',
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 44,
    alignItems: 'center',
  },
  presetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  presetBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  weightLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickWeightRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tinyStepBtn: {
    backgroundColor: colors.elevated,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tinyStepText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  gridInput: {
    backgroundColor: colors.elevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 4,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  stepperValueText: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  stepperInputCenter: {
    flex: 1,
    textAlign: 'center',
    borderWidth: 0,
    minHeight: 38,
    height: 38,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontWeight: '800',
  },
  addExerciseButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  addExerciseText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.accentLine,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryMuted,
    marginTop: spacing.md,
  },
  addWorkoutText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emptyWorkoutCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  emptyWorkoutTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyWorkoutSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  weekdayChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  weekdayChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekdayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekdayChipText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  weekdayChipTextSelected: {
    color: colors.onPrimary,
    fontWeight: '900',
  },
  deleteWorkoutFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
    backgroundColor: 'rgba(255, 69, 58, 0.06)',
    marginTop: 8,
    marginBottom: 8,
  },
  deleteWorkoutFullText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '700',
  },
});
