import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
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
import { hapticImpact, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
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
  const { t, tm, td, te, tw, language } = useI18n();
  const [workoutName, setWorkoutName] = useState(workout ? tw(workout.name) : '');
  const [exercises, setExercises] = useState<UserExercise[]>(workout?.exercises ?? []);
  const [libraryVisible, setLibraryVisible] = useState(false);

  React.useEffect(() => {
    if (workout && visible) {
      setWorkoutName(tw(workout.name));
      setExercises(workout.exercises);
      setLibraryVisible(false);
    }
  }, [workout?.id, visible]);

  if (!workout) return null;

  const handleUpdateExercise = (index: number, patch: Partial<UserExercise>) => {
    setExercises((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveExercise = (index: number) => {
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
    if (exercises.length === 0) {
      Alert.alert(
        language === 'uk' ? 'Увага' : 'Notice',
        language === 'uk' ? 'Додайте хоча б одну вправу перед збереженням' : 'Add at least one exercise before saving'
      );
      return;
    }
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
          {libraryVisible ? (
            <ExerciseLibraryModal
              visible={true}
              embedded={true}
              onSelectExercise={(item) => {
                handleAddFromLibrary(item);
                setLibraryVisible(false);
              }}
              onClose={() => setLibraryVisible(false)}
            />
          ) : (
            <>
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
                style={styles.mainScrollView}
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

                {exercises.length === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      hapticMedium();
                      setLibraryVisible(true);
                    }}
                    style={styles.emptyCard}
                  >
                    <Ionicons name="barbell-outline" size={32} color="#8E9BAE" style={{ marginBottom: 6 }} />
                    <Text style={styles.emptyTitle}>
                      {language === 'uk' ? 'Вправи відсутні' : 'No exercises'}
                    </Text>
                    <Text style={styles.emptySub}>
                      {language === 'uk'
                        ? 'Натисніть сюди, щоб обрати вправи з каталогу'
                        : 'Tap here to add exercises from catalog'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.exercisesList}>
                    {exercises.map((ex, index) => (
                      <View key={ex.id || `${ex.name}-${index}`} style={styles.exerciseCard}>
                        {/* Header Row: Number, Thumb, Name, Muscle, Delete button */}
                        <View style={styles.exerciseCardHeader}>
                          <View style={styles.exerciseHeaderLeft}>
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
                            <View style={styles.exerciseHeaderInfo}>
                              <Text style={styles.exerciseRowName} numberOfLines={1}>
                                {te(ex.name)}
                              </Text>
                              <Text style={styles.exerciseRowMeta}>
                                {tm(ex.muscleGroup)} • {ex.equipment}
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

                        {/* Parameter Controls Grid */}
                        <View style={styles.paramsGrid}>
                          {/* Row 1: Sets (Підходи) and Reps (Повторення) */}
                          <View style={styles.paramsRow}>
                            {/* Sets Stepper */}
                            <View style={styles.paramCol}>
                              <View style={styles.paramLabelRow}>
                                <Text style={styles.paramLabel}>
                                  {language === 'uk' ? 'ПІДХОДИ' : 'SETS'}
                                </Text>
                              </View>
                              <View style={styles.stepperWrap}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Decrease sets"
                                  hitSlop={6}
                                  onPress={() =>
                                    handleUpdateExercise(index, { sets: Math.max(1, ex.sets - 1) })
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>-</Text>
                                </Pressable>
                                <Text style={styles.stepperValue}>{ex.sets}</Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Increase sets"
                                  hitSlop={6}
                                  onPress={() =>
                                    handleUpdateExercise(index, { sets: Math.min(10, ex.sets + 1) })
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>+</Text>
                                </Pressable>
                              </View>
                            </View>

                            {/* Reps Input */}
                            <View style={styles.paramCol}>
                              <View style={styles.paramLabelRow}>
                                <Text style={styles.paramLabel}>
                                  {language === 'uk' ? 'ПОВТОРЕННЯ' : 'REPS'}
                                </Text>
                              </View>
                              <TextInput
                                style={styles.paramInput}
                                value={ex.targetRepRange}
                                onChangeText={(text) =>
                                  handleUpdateExercise(index, { targetRepRange: text })
                                }
                                placeholder="8-12"
                                placeholderTextColor="#64748B"
                              />
                            </View>
                          </View>

                          {/* Row 2: Weight (Вага) and Rest (Відпочинок) */}
                          <View style={styles.paramsRow}>
                            {/* Weight Stepper */}
                            <View style={styles.paramCol}>
                              <View style={styles.paramLabelRow}>
                                <Text style={styles.paramLabel}>
                                  {language === 'uk' ? 'ВАГА (КГ)' : 'WEIGHT (KG)'}
                                </Text>
                              </View>
                              <View style={styles.stepperWrap}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Decrease weight"
                                  hitSlop={6}
                                  onPress={() => {
                                    hapticImpact();
                                    handleUpdateExercise(index, {
                                      recommendedWeight: Math.max(
                                        0,
                                        Math.round(((ex.recommendedWeight || 0) - 2.5) * 10) / 10
                                      ),
                                    });
                                  }}
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>-</Text>
                                </Pressable>
                                <TextInput
                                  style={styles.stepperInput}
                                  value={String(ex.recommendedWeight ?? 0)}
                                  onChangeText={(text) => {
                                    const num = parseFloat(text);
                                    if (!isNaN(num) && num >= 0) {
                                      handleUpdateExercise(index, { recommendedWeight: num });
                                    }
                                  }}
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor="#64748B"
                                />
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Increase weight"
                                  hitSlop={6}
                                  onPress={() => {
                                    hapticImpact();
                                    handleUpdateExercise(index, {
                                      recommendedWeight:
                                        Math.round(((ex.recommendedWeight || 0) + 2.5) * 10) / 10,
                                    });
                                  }}
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>+</Text>
                                </Pressable>
                              </View>
                            </View>

                            {/* Rest Stepper */}
                            <View style={styles.paramCol}>
                              <View style={styles.paramLabelRow}>
                                <Text style={styles.paramLabel}>
                                  {language === 'uk' ? 'ВІДПОЧИНОК' : 'REST'}
                                </Text>
                              </View>
                              <View style={styles.stepperWrap}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Decrease rest"
                                  hitSlop={6}
                                  onPress={() => {
                                    hapticImpact();
                                    handleUpdateExercise(index, {
                                      restSeconds: Math.max(0, (ex.restSeconds ?? 90) - 15),
                                    });
                                  }}
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>-</Text>
                                </Pressable>
                                <Text style={styles.stepperValue} numberOfLines={1}>
                                  {(ex.restSeconds ?? 90) === 0
                                    ? (language === 'uk' ? '0s Суперсет' : '0s Superset')
                                    : `${ex.restSeconds ?? 90}s`}
                                </Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Increase rest"
                                  hitSlop={6}
                                  onPress={() => {
                                    hapticImpact();
                                    handleUpdateExercise(index, {
                                      restSeconds: Math.min(300, (ex.restSeconds ?? 90) + 15),
                                    });
                                  }}
                                  style={styles.stepperBtn}
                                >
                                  <Text style={styles.stepperBtnText}>+</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>

                          {/* Quick Rest Presets (0s Суперсет, 15s, 60s, 90s, 120s) */}
                          <View style={styles.quickRestRow}>
                            {[
                              { sec: 0, labelUk: '0s (Суперсет)', labelEn: '0s (Superset)' },
                              { sec: 15, labelUk: '15s', labelEn: '15s' },
                              { sec: 60, labelUk: '60s', labelEn: '60s' },
                              { sec: 90, labelUk: '90s', labelEn: '90s' },
                              { sec: 120, labelUk: '120s', labelEn: '120s' },
                            ].map((preset) => {
                              const isCurrent = (ex.restSeconds ?? 90) === preset.sec;
                              return (
                                <Pressable
                                  key={preset.sec}
                                  onPress={() => {
                                    hapticLight();
                                    handleUpdateExercise(index, { restSeconds: preset.sec });
                                  }}
                                  style={[
                                    styles.quickRestChip,
                                    isCurrent && styles.quickRestChipActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.quickRestChipText,
                                      isCurrent && styles.quickRestChipTextActive,
                                    ]}
                                  >
                                    {language === 'uk' ? preset.labelUk : preset.labelEn}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
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
            </>
          )}
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
    height: '90%',
    display: 'flex',
    flexDirection: 'column',
  },
  mainScrollView: {
    flex: 1,
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
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222B38',
    padding: 14,
    gap: 12,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  exerciseHeaderInfo: {
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
  paramsGrid: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  paramsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paramCol: {
    flex: 1,
  },
  paramLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 20,
    marginBottom: 6,
  },
  paramLabel: {
    color: '#8E9BAE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  paramInput: {
    backgroundColor: '#0E1115',
    borderColor: '#242C38',
    borderWidth: 1,
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    height: 42,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1115',
    borderColor: '#242C38',
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 2,
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 2,
    height: 42,
  },
  quickRestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickRestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
  },
  quickRestChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickRestChipText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
  },
  quickRestChipTextActive: {
    color: '#0B0D0F',
    fontWeight: '900',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A212B',
    backgroundColor: '#12161D',
    flexShrink: 0,
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
  emptyCard: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2E3847',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: '#8E9BAE',
    fontSize: 12,
    textAlign: 'center',
  },
});

