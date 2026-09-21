import { useMemo, useState } from 'react';
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
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getExerciseImage } from '@/lib/exerciseImages';
import { EXERCISE_LIBRARY, type LibraryExercise } from '@/lib/exerciseLibrary';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupFilter>('All');

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return EXERCISE_LIBRARY.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.muscleGroup.toLowerCase().includes(query) ||
        item.equipment.toLowerCase().includes(query);

      const matchesMuscle =
        selectedMuscle === 'All' || item.muscleGroup === selectedMuscle;

      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedMuscle]);

  const handleSelect = (exercise: LibraryExercise) => {
    onSelect(exercise);
    setSearchQuery('');
    setSelectedMuscle('All');
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedMuscle('All');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>EXERCISE LIBRARY</Text>
              <Text style={styles.title}>Select Exercise</Text>
            </View>
            <Pressable
              accessibilityRole="button"
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
              placeholder="Search exercise by name or muscle..."
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
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedMuscle(item)}
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
                      {item}
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
                        source={getExerciseImage(item.name)}
                        style={styles.exerciseThumb}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {item.muscleGroup}  •  {item.equipment}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.addButtonBadge}>
                    <Text style={styles.addButtonText}>+ ADD</Text>
                  </View>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>NO EXERCISES FOUND</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search term or category.
                </Text>
              </View>
            }
          />
        </View>
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
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  filtersWrapper: {
    marginBottom: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  filterPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: colors.background,
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.sm,
  },
  itemPressable: {
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  exerciseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
  cardInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  exerciseMeta: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonBadge: {
    backgroundColor: colors.primaryMuted,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.72,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
  },
  emptyTitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});

