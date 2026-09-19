import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { TrackedExerciseItem } from '@/lib/progressCalculator';

type ExerciseSelectorProps = {
  exercises: TrackedExerciseItem[];
  selectedExercise: TrackedExerciseItem | null;
  onSelect: (exercise: TrackedExerciseItem) => void;
};

export function ExerciseSelector({
  exercises,
  selectedExercise,
  onSelect,
}: ExerciseSelectorProps) {
  if (exercises.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {exercises.map((exercise) => {
          const isSelected =
            selectedExercise?.id === exercise.id ||
            selectedExercise?.name.toLowerCase() === exercise.name.toLowerCase();
          const isHistoryOnly = exercise.source === 'history';

          return (
            <Pressable
              key={`${exercise.source}-${exercise.id}`}
              accessibilityRole="button"
              onPress={() => onSelect(exercise)}
              style={({ pressed }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                isHistoryOnly && !isSelected && styles.pillHistory,
                pressed && styles.pillPressed,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.pillText,
                  isSelected && styles.pillTextSelected,
                  isHistoryOnly && !isSelected && styles.pillTextHistory,
                ]}
              >
                {exercise.name}
              </Text>
              {isHistoryOnly && (
                <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                    Past
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 40,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillHistory: {
    opacity: 0.78,
    borderStyle: 'dashed',
  },
  pillPressed: {
    opacity: 0.65,
  },
  pillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pillTextSelected: {
    color: colors.background,
    fontWeight: '900',
  },
  pillTextHistory: {
    color: colors.secondary,
  },
  badge: {
    backgroundColor: colors.elevated,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeSelected: {
    backgroundColor: 'rgba(11, 13, 15, 0.2)',
  },
  badgeText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextSelected: {
    color: colors.background,
    fontWeight: '900',
  },
});

