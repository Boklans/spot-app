import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { getExerciseImage } from '@/lib/exerciseImages';
import type { WorkoutExercise } from '@/store/workoutSessionStore';

interface CollapsedExerciseRowProps {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  displayName: string;
  supersetBadge: string | null;
  prescribedWeightLabel: string;
  onSelect: () => void;
}

/**
 * Compact 56pt collapsed exercise row for completed or upcoming exercises
 * in the Vertical Multi-Exercise Active Workout Sheet.
 */
export function CollapsedExerciseRow({
  exercise,
  exerciseIndex,
  displayName,
  supersetBadge,
  prescribedWeightLabel,
  onSelect,
}: CollapsedExerciseRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const workingSets = exercise.sets.filter((s) => s.setType !== 'warmup');
  const targetSets = workingSets.length > 0 ? workingSets : exercise.sets;
  const doneCount = targetSets.filter((s) => s.completed).length;
  const totalCount = targetSets.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.rowCard,
        allDone && styles.rowCardCompleted,
        pressed && { opacity: 0.82 },
      ]}
    >
      <Text style={[styles.indexText, allDone && { color: colors.primaryText }]}>
        {String(exerciseIndex + 1).padStart(2, '0')}
      </Text>

      <View style={styles.thumbWrap}>
        <Image
          source={getExerciseImage(exercise.name, exercise.customImageUri)}
          style={styles.thumbImg}
          resizeMode="cover"
        />
      </View>

      <View style={styles.titleCol}>
        <View style={styles.titleLine}>
          {supersetBadge && (
            <View style={styles.supersetTag}>
              <Text style={styles.supersetTagText}>{supersetBadge}</Text>
            </View>
          )}
          <Text
            numberOfLines={1}
            style={[styles.titleText, allDone && styles.titleTextDone]}
          >
            {displayName}
          </Text>
        </View>
      </View>

      {allDone ? (
        <View style={styles.doneBadge}>
          <Ionicons name="checkmark" size={13} color={colors.primaryText} />
          <Text style={styles.doneBadgeText}>
            {doneCount}/{totalCount}
          </Text>
        </View>
      ) : (
        <View style={styles.upcomingMeta}>
          <Text style={styles.upcomingCountText}>
            {doneCount}/{totalCount} · {prescribedWeightLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      gap: 10,
      ...cardElevation(colors),
    },
    rowCardCompleted: {
      backgroundColor: colors.completedRowBg,
      borderColor: colors.completedRowBorder,
    },
    indexText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      width: 20,
      color: colors.muted,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    thumbWrap: {
      width: 34,
      height: 34,
      borderRadius: radii.xs,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    titleCol: {
      flex: 1,
    },
    titleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    supersetTag: {
      backgroundColor: colors.supersetMuted,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 5,
    },
    supersetTagText: {
      fontFamily: fonts.monoBold,
      fontSize: 10,
      color: colors.superset,
      includeFontPadding: false,
    },
    titleText: {
      fontFamily: fonts.semiBold,
      flex: 1,
      fontSize: 14,
      color: colors.text,
      includeFontPadding: false,
    },
    titleTextDone: {
      color: colors.secondary,
    },
    doneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
    },
    doneBadgeText: {
      fontFamily: fonts.monoBold,
      fontSize: 11.5,
      color: colors.primaryText,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    upcomingMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    upcomingCountText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
  });
