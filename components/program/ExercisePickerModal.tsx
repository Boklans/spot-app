import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getExerciseImage } from '@/lib/exerciseImages';
import { EXERCISE_LIBRARY, type LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticImpact, hapticLight } from '@/lib/haptics';
import { translateExercise, useI18n } from '@/lib/i18n';
import { useCustomExercisesStore } from '@/store/customExercisesStore';
import { CreateExerciseModal } from './CreateExerciseModal';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as const;
type MuscleGroupFilter = (typeof MUSCLE_GROUPS)[number];

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: LibraryExercise) => void;
};

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { tm, te, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupFilter>('All');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const customExercises = useCustomExercisesStore((state) => state.customExercises);

  const combinedLibrary = useMemo(() => {
    const customAsLibrary: LibraryExercise[] = customExercises.map((c) => ({
      id: c.id,
      name: c.name,
      muscleGroup: c.muscleGroup,
      equipment: c.equipment,
      weightIncrement: c.weightIncrement,
      defaultSets: c.defaultSets,
      defaultRepRange: c.defaultRepRange,
      defaultWeight: c.defaultWeight,
      customImageUri: c.customImageUri,
      isCustom: true,
    }));
    return [...customAsLibrary, ...EXERCISE_LIBRARY];
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return combinedLibrary.filter((item) => {
      const translatedName = translateExercise(item.name, language).toLowerCase();
      const translatedMuscle = tm(item.muscleGroup).toLowerCase();

      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        translatedName.includes(query) ||
        item.muscleGroup.toLowerCase().includes(query) ||
        translatedMuscle.includes(query) ||
        item.equipment.toLowerCase().includes(query);

      const matchesMuscle =
        selectedMuscle === 'All' || item.muscleGroup === selectedMuscle;

      return matchesSearch && matchesMuscle;
    });
  }, [combinedLibrary, searchQuery, selectedMuscle, language, tm]);

  const handleSelect = (exercise: LibraryExercise) => {
    hapticImpact();
    onSelect(exercise);
    setSearchQuery('');
    setSelectedMuscle('All');
    onClose();
  };

  const handleClose = () => {
    hapticLight();
    setSearchQuery('');
    setSelectedMuscle('All');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>
                {language === 'uk' ? 'КАТАЛОГ ВПРАВ' : 'EXERCISE LIBRARY'}
              </Text>
              <Text style={styles.title}>
                {language === 'uk' ? 'Оберіть вправу' : 'Select Exercise'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              hitSlop={12}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                language === 'uk'
                  ? 'Пошук вправи або цільового м’яза...'
                  : 'Search exercise by name or muscle...'
              }
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>

          {/* Muscle Group Filter Pills */}
          <View style={styles.filtersWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={MUSCLE_GROUPS}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => {
                const isSelected = selectedMuscle === item;
                const label = item === 'All' ? (language === 'uk' ? 'Всі' : 'All') : tm(item);
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      hapticLight();
                      setSelectedMuscle(item);
                    }}
                    style={({ pressed }) => [
                      styles.filterPill,
                      isSelected && styles.filterPillSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        isSelected && styles.filterTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* Exercise List */}
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create custom exercise"
                onPress={() => {
                  hapticLight();
                  setIsCreateModalVisible(true);
                }}
                style={({ pressed }) => [styles.createExBtn, pressed && styles.pressed]}
              >
                <View style={styles.createExIconWrap}>
                  <Ionicons name="add" size={20} color="#0B0D0F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createExTitle}>
                    {language === 'uk' ? '+ Створити власну вправу' : '+ Create Custom Exercise'}
                  </Text>
                  <Text style={styles.createExSubtitle}>
                    {language === 'uk'
                      ? 'Тренажер або рух з власним фото'
                      : 'Gym machine or movement with custom photo'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [styles.itemPressable, pressed && styles.pressed]}
              >
                <Card style={styles.exerciseCard}>
                  <View style={styles.exerciseCardLeft}>
                    <View style={styles.exerciseThumbWrap}>
                      <Image
                        source={getExerciseImage(item.name, item.customImageUri)}
                        style={styles.exerciseThumb}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={styles.exerciseName}>{te(item.name)}</Text>
                        {item.isCustom && (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>
                              {language === 'uk' ? 'ВЛАСНА' : 'CUSTOM'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.exerciseMeta}>
                        {tm(item.muscleGroup)} • {item.equipment}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.addButtonBadge}>
                    <Text style={styles.addButtonText}>
                      {language === 'uk' ? '+ ДОДАТИ' : '+ ADD'}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  {language === 'uk' ? 'ВПРАВ НЕ ЗНАЙДЕНО' : 'NO EXERCISES FOUND'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {language === 'uk'
                    ? 'Спробуйте інший пошуковий запит або категорію м’язів.'
                    : 'Try a different search term or category.'}
                </Text>
              </View>
            }
          />
        </View>

        {/* Create Custom Exercise Modal */}
        <CreateExerciseModal
          visible={isCreateModalVisible}
          onClose={() => setIsCreateModalVisible(false)}
          onCreated={(newExercise) => {
            setIsCreateModalVisible(false);
            handleSelect(newExercise);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  filtersWrapper: {
    marginBottom: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  itemPressable: {
    borderRadius: 16,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  exerciseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  exerciseThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.elevated,
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  addButtonBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  createExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161B24',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  createExIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createExTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  createExSubtitle: {
    fontSize: 12,
    color: '#8E959F',
    marginTop: 2,
    fontWeight: '500',
  },
  customBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
