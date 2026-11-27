import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExercisePickerModal } from '@/components/program/ExercisePickerModal';
import { WorkoutDayEditor } from '@/components/program/WorkoutDayEditor';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import type { LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { generateUUID } from '@/lib/programMigration';
import type { UserExercise, UserWorkout } from '@/types/userProgram';

interface WorkoutEditorModalProps {
  visible: boolean;
  workout: UserWorkout | null;
  onSaveWorkout: (updatedWorkout: UserWorkout) => void;
  onDeleteWorkout?: (workoutId: string) => void;
  onClose: () => void;
}

export function WorkoutEditorModal({
  visible,
  workout,
  onSaveWorkout,
  onDeleteWorkout,
  onClose,
}: WorkoutEditorModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, td, tw, language } = useI18n();
  const isUk = language === 'uk';

  const [workoutName, setWorkoutName] = useState(workout ? tw(workout.name) : '');
  const [dayLabel, setDayLabel] = useState(workout?.dayLabel || 'MON');
  const [exercises, setExercises] = useState<UserExercise[]>(workout?.exercises ?? []);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (workout && visible) {
      setWorkoutName(tw(workout.name));
      setDayLabel(workout.dayLabel || 'MON');
      setExercises(workout.exercises);
      setPickerVisible(false);
    }
  }, [workout?.id, visible]);

  if (!workout) return null;

  const mapLibraryToUserExercise = (item: LibraryExercise): UserExercise => ({
    id: generateUUID(),
    name: item.name,
    muscleGroup: item.muscleGroup,
    sets: item.defaultSets || 3,
    recommendedWeight: item.defaultWeight || 0,
    targetRepRange: item.defaultRepRange || '8-12',
    equipment: item.equipment,
    weightIncrement: item.weightIncrement || 2.5,
    restSeconds: 90,
    customImageUri: item.customImageUri,
    isCustom: item.isCustom,
  });

  const handleAddBatch = (items: LibraryExercise[]) => {
    const mapped = items.map(mapLibraryToUserExercise);
    setExercises((prev) => [...prev, ...mapped]);
  };

  const handleSave = () => {
    if (exercises.length === 0) {
      Alert.alert(
        isUk ? 'Увага' : 'Notice',
        isUk
          ? 'Додайте хоча б одну вправу перед збереженням'
          : 'Add at least one exercise before saving'
      );
      return;
    }
    hapticSuccess();
    const uniqueMuscles = [...new Set(exercises.map((e) => e.muscleGroup))];
    onSaveWorkout({
      ...workout,
      name: workoutName.trim() || workout.name,
      dayLabel,
      exercises,
      muscleGroups: uniqueMuscles,
      estimatedMinutes: Math.max(30, exercises.length * 9),
    });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="92%"
      backgroundColor={colors.background}
    >
      <View style={styles.sheetWrap}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('customizeWorkout')}</Text>
            <Text style={styles.headerSubtitle}>{td(dayLabel)}</Text>
          </View>

          <View style={styles.headerActions}>
            {onDeleteWorkout && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete workout day"
                hitSlop={10}
                onPress={() => onDeleteWorkout(workout.id)}
                style={styles.deleteDayBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.secondary} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WorkoutDayEditor
            workoutName={workoutName}
            dayLabel={dayLabel}
            exercises={exercises}
            onChangeWorkoutName={setWorkoutName}
            onChangeDayLabel={setDayLabel}
            onUpdateExercise={(index, patch) =>
              setExercises((prev) =>
                prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
              )
            }
            onMoveExerciseUp={(index) => {
              if (index <= 0) return;
              hapticLight();
              setExercises((prev) => {
                const next = [...prev];
                const tmp = next[index - 1];
                next[index - 1] = next[index];
                next[index] = tmp;
                return next.map((ex, i) =>
                  i === next.length - 1 ? { ...ex, supersetWithNext: false } : ex
                );
              });
            }}
            onMoveExerciseDown={(index) => {
              setExercises((prev) => {
                if (index >= prev.length - 1) return prev;
                hapticLight();
                const next = [...prev];
                const tmp = next[index + 1];
                next[index + 1] = next[index];
                next[index] = tmp;
                return next.map((ex, i) =>
                  i === next.length - 1 ? { ...ex, supersetWithNext: false } : ex
                );
              });
            }}
            onToggleSuperset={(index) => {
              hapticMedium();
              setExercises((prev) => {
                if (index < 0 || index >= prev.length - 1) return prev;
                const willEnable = !prev[index].supersetWithNext;
                return prev.map((ex, i) => {
                  if (i === index) return { ...ex, supersetWithNext: willEnable };
                  if (willEnable && (i === index - 1 || i === index + 1)) {
                    return { ...ex, supersetWithNext: false };
                  }
                  return ex;
                });
              });
            }}
            onRemoveExercise={(index) => {
              hapticImpact();
              setExercises((prev) =>
                prev
                  .filter((_, i) => i !== index)
                  .map((ex, i, arr) =>
                    i === arr.length - 1 ? { ...ex, supersetWithNext: false } : ex
                  )
              );
            }}
            onOpenAddExercises={() => setPickerVisible(true)}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button onPress={handleSave}>
            {isUk ? 'Зберегти зміни' : 'Save Changes'}
          </Button>
        </View>

        <ExercisePickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={(item) => handleAddBatch([item])}
          onSelectMultiple={handleAddBatch}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheetWrap: {
      height: 620,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 10,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: 19,
      color: colors.text,
      letterSpacing: -0.3,
      includeFontPadding: false,
    },
    headerSubtitle: {
      fontFamily: fonts.medium,
      fontSize: 12.5,
      color: colors.secondary,
      marginTop: 2,
      includeFontPadding: false,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deleteDayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 24,
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.background,
    },
  });
