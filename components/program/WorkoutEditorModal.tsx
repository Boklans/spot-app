import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { colors } from '@/constants/colors';
import { type CatalogExercise } from '@/lib/exerciseCatalog';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticImpact, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { UserExercise, UserWorkout } from '@/types/userProgram';

interface WorkoutEditorModalProps {
  visible: boolean;
  workout: UserWorkout | null;
  onSaveWorkout: (updatedWorkout: UserWorkout) => void;
  onClose: () => void;
}

export function WorkoutEditorModal({
  visible,
  workout,
  onSaveWorkout,
  onClose,
}: WorkoutEditorModalProps) {
  const { t, tm, td, te, tw } = useI18n();
  const [workoutName, setWorkoutName] = useState(workout ? tw(workout.name) : '');
  const [exercises, setExercises] = useState<UserExercise[]>(workout?.exercises ?? []);
  const [libraryVisible, setLibraryVisible] = useState(false);

  React.useEffect(() => {
    if (workout) {
      setWorkoutName(tw(workout.name));
      setExercises(workout.exercises);
    }
  }, [workout, tw]);

  if (!workout) return null;

  const handleRemoveExercise = (index: number) => {
    if (exercises.length <= 1) {
      Alert.alert(t('cannotRemove'), t('minOneExercise'));
      return;
    }
    hapticImpact();
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFromLibrary = (item: CatalogExercise) => {
    const newEx: UserExercise = {
      id: `custom-ex-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: item.name,
      muscleGroup: item.muscleGroup,
      sets: item.sets,
      recommendedWeight: item.defaultWeight,
      targetRepRange: item.targetRepRange,
      equipment: item.equipment,
      weightIncrement: 2.5,
    };
    setExercises((prev) => [...prev, newEx]);
  };

  const handleSave = () => {
    hapticSuccess();
    const uniqueMuscles = [
      ...new Set(exercises.map((e) => e.muscleGroup)),
    ];
    const updated: UserWorkout = {
      ...workout,
      name: workoutName.trim() || workout.name,
      exercises,
      muscleGroups: uniqueMuscles,
      estimatedMinutes: Math.max(30, exercises.length * 9),
    };
    onSaveWorkout(updated);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('customizeWorkout')}</Text>
              <Text style={styles.headerSubtitle}>{td(workout.dayLabel)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Workout Name Field */}
            <Text style={styles.inputLabel}>{t('workoutName')}</Text>
            <View style={styles.nameInputWrap}>
              <TextInput
                style={styles.nameInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="e.g., Chest & Triceps"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Exercise List */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.inputLabel}>
                {t('exercises').toUpperCase()} ({exercises.length})
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticMedium();
                  setLibraryVisible(true);
                }}
                style={styles.addBtnSmall}
              >
                <Ionicons name="add" size={16} color="#0B0D0F" />
                <Text style={styles.addBtnSmallText}>{t('addExercise')}</Text>
              </Pressable>
            </View>

            <View style={styles.exercisesList}>
              {exercises.map((ex, index) => (
                <View key={ex.id || index} style={styles.exerciseRow}>
                  <View style={styles.exerciseRowLeft}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseThumbWrap}>
                      <Image
                        source={getExerciseImage(ex.name)}
                        style={styles.exerciseThumb}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.exerciseRowInfo}>
                      <Text style={styles.exerciseRowName}>{te(ex.name)}</Text>
                      <Text style={styles.exerciseRowMeta}>
                        {ex.sets} {t('sets').toLowerCase()} • {ex.targetRepRange} • {tm(ex.muscleGroup)}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove exercise"
                    hitSlop={10}
                    onPress={() => handleRemoveExercise(index)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#F87171"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save Workout"
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.saveBtnPressed,
              ]}
            >
              <Text style={styles.saveBtnText}>{t('saveWorkout')}</Text>
            </Pressable>
          </View>

          {/* Nested Exercise Library Picker */}
          <ExerciseLibraryModal
            visible={libraryVisible}
            onSelectExercise={handleAddFromLibrary}
            onClose={() => setLibraryVisible(false)}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#12161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#242C38',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212B',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C232E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  nameInputWrap: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242C38',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  nameInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtnSmallText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '800',
  },
  exercisesList: {
    gap: 10,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2733',
    padding: 12,
  },
  exerciseRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#202836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  exerciseThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseRowInfo: {
    flex: 1,
  },
  exerciseRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  exerciseRowMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A212B',
    backgroundColor: '#12161D',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

