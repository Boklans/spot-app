import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { generateUUID } from '@/lib/programMigration';
import { getWorkoutDayLabel } from '@/lib/programGenerator';
import { useI18n } from '@/lib/i18n';
import { useProgramStore } from '@/store/programStore';
import type { UserExercise, UserProgram } from '@/types/userProgram';

export default function ProgramEdit() {
  const { t, tm, td, language } = useI18n();
  const activeProgram = useProgramStore((state) => state.program);
  const updateUserProgram = useProgramStore((state) => state.updateUserProgram);

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
    useProgramStore.getState().getOrLoadProgram().then((loaded) => {
      if (loaded && loaded.id !== draft.id) {
        setDraft(JSON.parse(JSON.stringify(loaded)));
      }
    });
  }, [draft.id]);

  // Program Level Handlers
  const handleProgramNameChange = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      name,
    }));
  };

  const handleMoveWorkoutUp = (index: number) => {
    if (index <= 0) return;
    hapticMedium();
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
      Alert.alert('Cannot delete', 'Your program must have at least one workout.');
      return;
    }

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
  };

  // Workout Level Handlers
  const handleWorkoutNameChange = (workoutId: string, name: string) => {
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => (w.id === workoutId ? { ...w, name } : w)),
    }));
  };

  // Exercise Level Handlers
  const handleMoveExerciseUp = (workoutId: string, exerciseIndex: number) => {
    if (exerciseIndex <= 0) return;
    hapticMedium();
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        const exercises = [...w.exercises];
        const temp = exercises[exerciseIndex - 1];
        exercises[exerciseIndex - 1] = exercises[exerciseIndex];
        exercises[exerciseIndex] = temp;
        return { ...w, exercises };
      }),
    }));
  };

  const handleMoveExerciseDown = (workoutId: string, exerciseIndex: number) => {
    const currentWorkout = draft.workouts.find((w) => w.id === workoutId);
    if (!currentWorkout || exerciseIndex >= currentWorkout.exercises.length - 1) return;
    hapticMedium();
    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        if (exerciseIndex >= w.exercises.length - 1) return w;
        const exercises = [...w.exercises];
        const temp = exercises[exerciseIndex + 1];
        exercises[exerciseIndex + 1] = exercises[exerciseIndex];
        exercises[exerciseIndex] = temp;
        return { ...w, exercises };
      }),
    }));
  };

  const handleDeleteExercise = (workoutId: string, exerciseId: string) => {
    const currentWorkout = draft.workouts.find((w) => w.id === workoutId);
    if (currentWorkout && currentWorkout.exercises.length <= 1) {
      Alert.alert('Cannot delete', 'Each workout must have at least one exercise.');
      return;
    }

    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        return {
          ...w,
          exercises: w.exercises.filter((ex) => ex.id !== exerciseId),
        };
      }),
    }));
  };

  const handleAddExercise = (workoutId: string, libExercise: LibraryExercise) => {
    const newExercise: UserExercise = {
      id: generateUUID(),
      name: libExercise.name,
      muscleGroup: libExercise.muscleGroup,
      sets: libExercise.defaultSets ?? 3,
      recommendedWeight: libExercise.defaultWeight ?? 0,
      targetRepRange: libExercise.defaultRepRange ?? '8-10',
      equipment: libExercise.equipment,
      weightIncrement: libExercise.weightIncrement,
      restSeconds: 90,
    };

    setDraft((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        return {
          ...w,
          exercises: [...w.exercises, newExercise],
        };
      }),
    }));
  };

  const handleUpdateExercise = (
    workoutId: string,
    exerciseId: string,
    updates: Partial<UserExercise>
  ) => {
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
    const nextSets = Math.max(1, exercise.sets + delta);
    handleUpdateExercise(workoutId, exercise.id, { sets: nextSets });
  };

  const handleWeightDelta = (workoutId: string, exercise: UserExercise, delta: number) => {
    hapticLight();
    const next = Math.max(0, parseFloat((exercise.recommendedWeight + delta).toFixed(2)));
    setRawWeightInputs((prev) => ({ ...prev, [exercise.id]: String(next) }));
    handleUpdateExercise(workoutId, exercise.id, { recommendedWeight: next });
  };

  // Top Level Save / Cancel Handlers
  const handleCancel = () => {
    router.back();
  };

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

    await updateUserProgram({
      ...draft,
      name: trimmed,
    });
    hapticSuccess();
    router.back();
  };

  const selectedWorkout = selectedWorkoutId
    ? draft.workouts.find((w) => w.id === selectedWorkoutId)
    : null;

  // Render Sub-View: Workout Editor
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
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedWorkoutId(null)}
            style={styles.navButton}
          >
            <Text style={styles.saveNavText}>{t('done')}</Text>
          </Pressable>
        </View>

        {/* Workout Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('workoutName')}</Text>
          <TextInput
            value={selectedWorkout.name}
            onChangeText={(text) => handleWorkoutNameChange(selectedWorkout.id, text)}
            placeholder="Workout Name"
            placeholderTextColor={colors.muted}
            style={styles.textInput}
            autoCapitalize="words"
          />
          <Text style={styles.workoutSubFocus}>
            {selectedWorkout.muscleGroups.map((m) => tm(m)).join(' • ')}
          </Text>
        </View>

        {/* Exercises List */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              {t('exercises').toUpperCase()} ({selectedWorkout.exercises.length})
            </Text>
            <Text style={styles.subHelpText}>{t('reorderVariables')}</Text>
          </View>

          {selectedWorkout.exercises.map((exercise, exIndex) => {
            const isFirst = exIndex === 0;
            const isLast = exIndex === selectedWorkout.exercises.length - 1;
            const weightDisplay =
              rawWeightInputs[exercise.id] !== undefined
                ? rawWeightInputs[exercise.id]
                : String(exercise.recommendedWeight);
            const incrementDisplay =
              rawIncrementInputs[exercise.id] !== undefined
                ? rawIncrementInputs[exercise.id]
                : String(exercise.weightIncrement);

            return (
              <Card key={exercise.id} style={styles.exerciseCard}>
                {/* Exercise Header & Order Controls */}
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseMetaCol}>
                    <Text style={styles.exerciseTitle}>{exercise.name}</Text>
                    <Text style={styles.exerciseMuscle}>
                      {tm(exercise.muscleGroup)}  •  {exercise.equipment}
                    </Text>
                  </View>

                  <View style={styles.exerciseTopActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleMoveExerciseUp(selectedWorkout.id, exIndex)}
                      disabled={isFirst}
                      style={({ pressed }) => [
                        styles.miniIconButton,
                        isFirst && styles.iconButtonDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.miniIconText, isFirst && styles.iconTextDisabled]}>▲</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleMoveExerciseDown(selectedWorkout.id, exIndex)}
                      disabled={isLast}
                      style={({ pressed }) => [
                        styles.miniIconButton,
                        isLast && styles.iconButtonDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.miniIconText, isLast && styles.iconTextDisabled]}>▼</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleDeleteExercise(selectedWorkout.id, exercise.id)}
                      style={({ pressed }) => [
                        styles.miniDeleteButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.miniDeleteText}>✕</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Exercise Variables Grid */}
                <View style={styles.variablesGrid}>
                  {/* Sets Control */}
                  <View style={styles.variableCol}>
                    <Text style={styles.variableLabel}>{t('sets').toUpperCase()}</Text>
                    <View style={styles.stepperContainer}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleSetsDelta(selectedWorkout.id, exercise, -1)}
                        style={({ pressed }) => [
                          styles.stepperButton,
                          exercise.sets <= 1 && styles.iconButtonDisabled,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.stepperButtonText}>-</Text>
                      </Pressable>

                      <Text style={styles.stepperValueText}>{exercise.sets}</Text>

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleSetsDelta(selectedWorkout.id, exercise, 1)}
                        style={({ pressed }) => [
                          styles.stepperButton,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Target Rep Range */}
                  <View style={styles.variableCol}>
                    <Text style={styles.variableLabel}>{t('reps')}</Text>
                    <TextInput
                      value={exercise.targetRepRange}
                      onChangeText={(text) =>
                        handleUpdateExercise(selectedWorkout.id, exercise.id, {
                          targetRepRange: text,
                        })
                      }
                      placeholder="8-10"
                      placeholderTextColor={colors.muted}
                      style={styles.gridInput}
                    />
                  </View>
                </View>

                <View style={[styles.variablesGrid, { marginTop: spacing.md }]}>
                  {/* Recommended Weight */}
                  <View style={styles.variableCol}>
                    <View style={styles.weightLabelRow}>
                      <Text style={styles.variableLabel}>{t('recWeight')}</Text>
                      <View style={styles.quickWeightRow}>
                        <Pressable
                          onPress={() => handleWeightDelta(selectedWorkout.id, exercise, -2.5)}
                          style={styles.tinyStepBtn}
                        >
                          <Text style={styles.tinyStepText}>-2.5</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleWeightDelta(selectedWorkout.id, exercise, 2.5)}
                          style={styles.tinyStepBtn}
                        >
                          <Text style={styles.tinyStepText}>+2.5</Text>
                        </Pressable>
                      </View>
                    </View>
                    <TextInput
                      value={weightDisplay}
                      onChangeText={(text) => {
                        setRawWeightInputs((prev) => ({ ...prev, [exercise.id]: text }));
                        const num = parseFloat(text);
                        if (!isNaN(num) && num >= 0) {
                          handleUpdateExercise(selectedWorkout.id, exercise.id, {
                            recommendedWeight: num,
                          });
                        }
                      }}
                      onBlur={() => {
                        const num = parseFloat(weightDisplay);
                        if (isNaN(num)) {
                          setRawWeightInputs((prev) => ({
                            ...prev,
                            [exercise.id]: String(exercise.recommendedWeight),
                          }));
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      style={styles.gridInput}
                    />
                  </View>

                  {/* Weight Increment */}
                  <View style={styles.variableCol}>
                    <Text style={styles.variableLabel}>{t('increment')}</Text>
                    <TextInput
                      value={incrementDisplay}
                      onChangeText={(text) => {
                        setRawIncrementInputs((prev) => ({ ...prev, [exercise.id]: text }));
                        const num = parseFloat(text);
                        if (!isNaN(num) && num >= 0) {
                          handleUpdateExercise(selectedWorkout.id, exercise.id, {
                            weightIncrement: num,
                          });
                        }
                      }}
                      onBlur={() => {
                        const num = parseFloat(incrementDisplay);
                        if (isNaN(num)) {
                          setRawIncrementInputs((prev) => ({
                            ...prev,
                            [exercise.id]: String(exercise.weightIncrement),
                          }));
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="2.5"
                      placeholderTextColor={colors.muted}
                      style={styles.gridInput}
                    />
                  </View>
                </View>

                <View style={[styles.variablesGrid, { marginTop: spacing.md }]}>
                  {/* Rest Duration */}
                  <View style={styles.variableCol}>
                    <Text style={styles.variableLabel}>
                      {language === 'uk' ? 'ВІДПОЧИНОК (СЕК)' : 'REST DURATION (SEC)'}
                    </Text>
                    <TextInput
                      value={String(exercise.restSeconds ?? 90)}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        if (!isNaN(num) && num >= 10 && num <= 600) {
                          handleUpdateExercise(selectedWorkout.id, exercise.id, {
                            restSeconds: num,
                          });
                        }
                      }}
                      keyboardType="number-pad"
                      placeholder="90"
                      placeholderTextColor={colors.muted}
                      style={styles.gridInput}
                    />
                  </View>
                </View>
              </Card>
            );
          })}

          {/* Add Exercise Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsExercisePickerVisible(true)}
            style={({ pressed }) => [styles.addExerciseButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.addExerciseText}>+ {t('addExercise').toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Done Button */}
        <View style={styles.bottomActions}>
          <Button onPress={() => setSelectedWorkoutId(null)}>{t('done').toUpperCase()}</Button>
        </View>

        {/* Exercise Picker Modal */}
        <ExercisePickerModal
          visible={isExercisePickerVisible}
          onClose={() => setIsExercisePickerVisible(false)}
          onSelect={(libExercise) => handleAddExercise(selectedWorkout.id, libExercise)}
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
      </View>

      {/* Bottom Save / Cancel Controls */}
      <View style={styles.bottomActions}>
        <Button onPress={handleSave}>{t('saveChanges').toUpperCase()}</Button>
        <Button secondary onPress={handleCancel}>{t('discardChanges')}</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    color: colors.primary,
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
    color: colors.primary,
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
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  editWorkoutText: {
    color: colors.primary,
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
    marginBottom: 6,
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
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
