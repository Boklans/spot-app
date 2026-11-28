import React, { useMemo, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  inferEquipmentFromName,
  isAssistedExercise,
  isPerHandExercise,
} from '@/lib/adaptiveProgression';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import type { WorkoutExercise } from '@/store/workoutSessionStore';

interface ActiveExerciseCardProps {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  totalExercises: number;
  isFocusedExercise: boolean;
  focusedSetIndex: number;
  supersetBadge: string | null;
  noteText: string;
  onFocusExercise: () => void;
  onOpenDetail: () => void;
  onOpenSwap: () => void;
  onOpenProgression: () => void;
  onOpenNote: () => void;
  onToggleSuperset: () => void;
  onAddWarmup: () => void;
  onCycleSetType: (setIndex: number) => void;
  onSelectSetRow: (setIndex: number) => void;
  onEditCell: (setIndex: number, field: 'weight' | 'reps') => void;
  onToggleSetComplete: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
}

/**
 * Obsidian Cockpit Expanded Exercise Card:
 * - Anodized #15181C plate with 1px specular border
 * - 3px #C8FF3D left laser rail on active uncompleted set
 * - Whisper-Emerald #0F1914 completed rows
 * - JetBrains Mono tabular weight & rep pills (opens docked WorkoutKeypadSheet)
 * - 44x44pt right-edge [✓] completion button
 */
export function ActiveExerciseCard({
  exercise,
  exerciseIndex,
  totalExercises,
  isFocusedExercise,
  focusedSetIndex,
  supersetBadge,
  noteText,
  onFocusExercise,
  onOpenDetail,
  onOpenSwap,
  onOpenProgression,
  onOpenNote,
  onToggleSuperset,
  onAddWarmup,
  onCycleSetType,
  onSelectSetRow,
  onEditCell,
  onToggleSetComplete,
  onAddSet,
  onRemoveSet,
}: ActiveExerciseCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const { t, tm, te, language } = useI18n();
  const { unitLabel, format, formatWithUnit, fromKg } = useWeightUnit();
  const isUk = language === 'uk';

  const checkScalesRef = useRef<Record<number, Animated.Value>>({});
  const getCheckScale = (idx: number) => {
    if (!checkScalesRef.current[idx]) {
      checkScalesRef.current[idx] = new Animated.Value(1);
    }
    return checkScalesRef.current[idx];
  };

  const triggerBounce = (idx: number) => {
    if (reducedMotion) return;
    const anim = getCheckScale(idx);
    anim.setValue(0.76);
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 1.24,
        useNativeDriver: true,
        speed: 45,
        bounciness: 12,
      }),
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 8,
      }),
    ]).start();
  };

  const activeSetIdx = isFocusedExercise
    ? focusedSetIndex
    : Math.max(0, exercise.sets.findIndex((s) => !s.completed));
  const activeSet = exercise.sets[activeSetIdx] ?? exercise.sets[0];
  const prevSetForActive = exercise.previousSets?.[activeSetIdx] || exercise.previousSets?.[0];
  const prevWeight = prevSetForActive?.weight ?? 0;
  const currentWeight = activeSet?.weight ?? 0;
  const prevReps = prevSetForActive?.reps ?? 0;
  const currentReps = activeSet?.reps ?? 0;

  const isAssisted = isAssistedExercise(exercise.name);
  const weightDeltaDisplay =
    Math.round((fromKg(currentWeight) - fromKg(prevWeight)) * 10) / 10;
  const repsDelta = currentReps - prevReps;
  const hasWeightIncrease =
    prevWeight > 0 && (isAssisted ? weightDeltaDisplay < 0 : weightDeltaDisplay > 0);
  const hasRepsIncrease =
    !hasWeightIncrease && prevReps > 0 && repsDelta > 0 && Math.abs(weightDeltaDisplay) < 0.01;

  const equipment = exercise.equipment || inferEquipmentFromName(exercise.name);
  const canToggleSuperset =
    exerciseIndex < totalExercises - 1 || Boolean(supersetBadge);

  let workingSetCounter = 0;

  return (
    <View
      style={[
        styles.card,
        isFocusedExercise && styles.cardFocused,
      ]}
    >
      {/* 1. Header: Thumbnail + Muscle/Superset + 2-Line Title + Quick Icons */}
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exercise technique guide"
          onPress={() => {
            hapticLight();
            onOpenDetail();
          }}
          style={styles.thumbWrap}
        >
          <Image
            source={getExerciseImage(exercise.name, exercise.customImageUri)}
            style={styles.thumbImg}
            resizeMode="cover"
          />
        </Pressable>

        <Pressable
          onPress={onFocusExercise}
          style={styles.infoCol}
        >
          <View style={styles.eyebrowRow}>
            <Text style={styles.indexTag}>
              {String(exerciseIndex + 1).padStart(2, '0')}
            </Text>
            <Text style={styles.muscleText}>{tm(exercise.muscleGroup)}</Text>
            {supersetBadge && (
              <View style={styles.supersetBadge}>
                <Ionicons name="link" size={10} color={colors.superset} />
                <Text style={styles.supersetBadgeText}>
                  {isUk ? `СУПЕРСЕТ ${supersetBadge}` : `SUPERSET ${supersetBadge}`}
                </Text>
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={styles.exerciseTitle}>
            {te(exercise.name)}
          </Text>
        </Pressable>

        <View style={styles.iconActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View technique guide"
            hitSlop={8}
            onPress={() => {
              hapticLight();
              onOpenDetail();
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap exercise"
            hitSlop={8}
            onPress={() => {
              hapticLight();
              onOpenSwap();
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.secondary} />
          </Pressable>
        </View>
      </View>

      {/* 2. Context Chips Row */}
      <View style={styles.chipsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View progression details"
          hitSlop={6}
          onPress={() => {
            hapticLight();
            onOpenProgression();
          }}
          style={styles.goalChip}
        >
          <Text style={styles.goalChipLabel}>
            {isUk ? 'Ціль: ' : 'Goal: '}
          </Text>
          <Text style={styles.goalChipMono}>
            {currentWeight ? formatWithUnit(currentWeight) : t('bodyweight')} × {currentReps}
          </Text>
          {(hasWeightIncrease || hasRepsIncrease) && (
            <Text style={styles.goalDeltaMono}>
              {hasWeightIncrease
                ? ` (${weightDeltaDisplay > 0 ? `+${weightDeltaDisplay}` : weightDeltaDisplay} ${unitLabel})`
                : ` (+${repsDelta})`}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={12} color={colors.muted} />
        </Pressable>

        {canToggleSuperset && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle superset"
            hitSlop={6}
            onPress={() => {
              hapticMedium();
              onToggleSuperset();
            }}
            style={[styles.metaChip, Boolean(supersetBadge) && styles.supersetChipActive]}
          >
            <Ionicons
              name="link-outline"
              size={13}
              color={supersetBadge ? colors.superset : colors.secondary}
            />
            <Text
              style={[
                styles.metaChipText,
                Boolean(supersetBadge) && { color: colors.superset, fontFamily: fonts.bold },
              ]}
            >
              {supersetBadge
                ? isUk
                  ? `Суперсет ${supersetBadge}`
                  : `Superset ${supersetBadge}`
                : isUk
                  ? 'Суперсет'
                  : 'Superset'}
            </Text>
          </Pressable>
        )}

        {!exercise.sets.some((s) => s.setType === 'warmup') && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? 'Додати розминку' : 'Add warm-up sets'}
            hitSlop={6}
            onPress={() => {
              hapticMedium();
              onAddWarmup();
            }}
            style={styles.metaChip}
          >
            <Ionicons name="flame-outline" size={13} color={colors.warmup} />
            <Text style={styles.metaChipText}>
              {isUk ? '+ Розминка' : '+ Warm-up'}
            </Text>
          </Pressable>
        )}

        {isPerHandExercise(exercise.name, equipment) && (
          <View style={styles.metaChip}>
            <Text style={[styles.metaChipText, { color: colors.primaryText }]}>
              {isUk ? 'Вага / 1 руку' : 'Per hand'}
            </Text>
          </View>
        )}

        {!noteText && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add exercise note"
            hitSlop={6}
            onPress={() => {
              hapticLight();
              onOpenNote();
            }}
            style={styles.metaChip}
          >
            <Ionicons name="create-outline" size={13} color={colors.secondary} />
            <Text style={styles.metaChipText}>
              {isUk ? 'Нотатка' : 'Note'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 3. Persistent Exercise Note Banner */}
      {noteText ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            onOpenNote();
          }}
          style={styles.noteBar}
        >
          <Ionicons name="bookmark" size={13} color={colors.primaryText} />
          <Text numberOfLines={2} style={styles.noteBarText}>
            {noteText}
          </Text>
          <Ionicons name="create-outline" size={14} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* 4. Sets Table Header */}
      <View style={styles.tableHead}>
        <Text numberOfLines={1} style={styles.headSet}>{t('set')}</Text>
        <Text numberOfLines={1} style={styles.headPrev}>{isUk ? 'Минуле' : 'Prev'}</Text>
        <Text numberOfLines={1} style={styles.headCell}>{unitLabel}</Text>
        <Text numberOfLines={1} style={styles.headCell}>{isUk ? 'Повт' : t('reps')}</Text>
        <Text numberOfLines={1} style={styles.headStatus}>✓</Text>
      </View>

      {/* 5. Sets Rows */}
      <View style={styles.setsList}>
        {exercise.sets.map((set, sIdx) => {
          const setType = set.setType ?? 'normal';
          if (setType !== 'warmup') {
            workingSetCounter += 1;
          }
          const badgeLabel =
            setType === 'warmup'
              ? 'W'
              : setType === 'dropset'
                ? 'D'
                : setType === 'failure'
                  ? 'F'
                  : String(workingSetCounter);

          const isCurrentRow = isFocusedExercise && sIdx === focusedSetIndex && !set.completed;
          const isDone = set.completed;
          const weightDisplay = set.weight ? format(set.weight) : (isUk ? 'ВТ' : 'BW');
          const workingOrdinal = workingSetCounter - 1;
          const prevForSet =
            setType === 'warmup'
              ? null
              : exercise.previousSets?.[workingOrdinal] ||
                (workingOrdinal === 0 ? exercise.previousSets?.[0] : null);
          const prevText = prevForSet
            ? `${prevForSet.weight ? format(prevForSet.weight) : (isUk ? 'ВТ' : 'BW')} × ${prevForSet.reps}`
            : '—';

          const setWeightProgressed =
            setType !== 'warmup' &&
            isDone &&
            prevForSet &&
            prevForSet.weight > 0 &&
            (isAssisted
              ? (set.weight ?? 0) < prevForSet.weight
              : (set.weight ?? 0) > prevForSet.weight);
          const setRepsProgressed =
            setType !== 'warmup' &&
            isDone &&
            prevForSet &&
            (isAssisted
              ? (set.weight ?? 0) <= prevForSet.weight
              : (set.weight ?? 0) >= prevForSet.weight) &&
            (set.reps ?? 0) > prevForSet.reps;

          const checkScale = getCheckScale(sIdx);

          return (
            <Pressable
              key={set.id || sIdx}
              onPress={() => onSelectSetRow(sIdx)}
              style={({ pressed }) => [
                styles.setRow,
                isCurrentRow && styles.setRowActive,
                isDone && styles.setRowDone,
                pressed && { opacity: 0.88 },
              ]}
            >
              {/* 3px Volt Left Laser Rail on Active Set */}
              {isCurrentRow && <View style={styles.activeLaserRail} />}

              {/* Set Type Cycle Badge */}
              <Pressable
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Set ${sIdx + 1} type ${setType}`}
                onPress={() => {
                  hapticLight();
                  onCycleSetType(sIdx);
                }}
                style={[
                  styles.setTypeBadge,
                  setType === 'warmup' && styles.badgeWarmup,
                  setType === 'dropset' && styles.badgeDropset,
                  setType === 'failure' && styles.badgeFailure,
                ]}
              >
                <Text
                  style={[
                    styles.setNumText,
                    isCurrentRow && setType === 'normal' && { color: colors.text },
                    isDone && setType === 'normal' && { color: colors.primaryText },
                    setType === 'warmup' && { color: colors.warmup },
                    setType === 'dropset' && { color: colors.superset },
                    setType === 'failure' && { color: colors.failure },
                  ]}
                >
                  {badgeLabel}
                </Text>
              </Pressable>

              {/* Previous Performance */}
              <View style={styles.prevCol}>
                <Text numberOfLines={1} style={styles.prevText}>
                  {prevText}
                </Text>
                {set.rir !== undefined && (
                  <Text style={styles.rirMiniText}>
                    {set.rir === 0 ? '0 RIR' : `${set.rir} RIR`}
                  </Text>
                )}
              </View>

              {/* Weight Cell (Opens Docked WorkoutKeypadSheet) */}
              <Pressable
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Edit weight for set ${sIdx + 1}`}
                onPress={() => {
                  hapticLight();
                  onEditCell(sIdx, 'weight');
                }}
                style={[
                  styles.valueCell,
                  isCurrentRow && styles.valueCellActive,
                  isDone && styles.valueCellDone,
                ]}
              >
                <Text
                  style={[
                    styles.valueCellText,
                    isCurrentRow && styles.valueCellTextActive,
                    isDone && styles.valueCellTextDone,
                    setWeightProgressed && { color: colors.primaryText },
                  ]}
                >
                  {weightDisplay}{setWeightProgressed ? ' ↑' : ''}
                </Text>
              </Pressable>

              {/* Reps Cell (Opens Docked WorkoutKeypadSheet) */}
              <Pressable
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Edit reps for set ${sIdx + 1}`}
                onPress={() => {
                  hapticLight();
                  onEditCell(sIdx, 'reps');
                }}
                style={[
                  styles.valueCell,
                  isCurrentRow && styles.valueCellActive,
                  isDone && styles.valueCellDone,
                ]}
              >
                <Text
                  style={[
                    styles.valueCellText,
                    isCurrentRow && styles.valueCellTextActive,
                    isDone && styles.valueCellTextDone,
                    setRepsProgressed && { color: colors.primaryText },
                  ]}
                >
                  {set.reps}{setRepsProgressed ? ' ↑' : ''}
                </Text>
              </Pressable>

              {/* 44x44pt 1-Tap Checkmark Complete Target */}
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isDone ? 'Undo set' : `Complete set ${sIdx + 1}`}
                onPress={() => {
                  if (!isDone) triggerBounce(sIdx);
                  onToggleSetComplete(sIdx);
                }}
                style={styles.checkTouchTarget}
              >
                <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                  {isDone ? (
                    <View style={styles.checkDoneBox}>
                      <Ionicons name="checkmark" size={17} color={colors.onPrimary} />
                    </View>
                  ) : isCurrentRow ? (
                    <View style={styles.checkActiveBox}>
                      <Ionicons name="checkmark" size={17} color={colors.primaryText} />
                    </View>
                  ) : (
                    <View style={styles.checkIdleBox}>
                      <Ionicons name="checkmark" size={15} color={colors.muted} />
                    </View>
                  )}
                </Animated.View>
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      {/* 6. Set Legend & Add/Remove Set Footer */}
      <View style={styles.footerRow}>
        <View style={styles.setActionsLeft}>
          {exercise.sets.length < 15 && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                hapticLight();
                onAddSet();
              }}
              style={({ pressed }) => [styles.addSetBtn, pressed && { opacity: 0.72 }]}
            >
              <Ionicons name="add" size={15} color={colors.text} />
              <Text style={styles.addSetText}>
                {isUk ? 'Підхід' : 'Add set'}
              </Text>
            </Pressable>
          )}

          {exercise.sets.length > 1 && !exercise.sets[exercise.sets.length - 1]?.completed && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                hapticLight();
                onRemoveSet();
              }}
              style={({ pressed }) => [styles.removeSetBtn, pressed && { opacity: 0.72 }]}
            >
              <Text style={styles.removeSetText}>
                {isUk ? 'Видалити' : 'Remove'}
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.legendText}>
          <Text style={{ color: colors.warmup, fontFamily: fonts.monoBold }}>W</Text>
          {' · '}
          <Text style={{ color: colors.superset, fontFamily: fonts.monoBold }}>D</Text>
          {' · '}
          <Text style={{ color: colors.failure, fontFamily: fonts.monoBold }}>F</Text>
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 15,
      ...cardElevation(colors),
    },
    cardFocused: {
      borderColor: colors.isDark ? 'rgba(200, 255, 61, 0.24)' : 'rgba(21, 128, 61, 0.28)',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      marginBottom: 11,
    },
    thumbWrap: {
      width: 46,
      height: 46,
      borderRadius: radii.sm,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    infoCol: {
      flex: 1,
      gap: 2,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    indexTag: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      color: colors.muted,
      includeFontPadding: false,
    },
    muscleText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    supersetBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.supersetMuted,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 5,
    },
    supersetBadgeText: {
      fontFamily: fonts.monoBold,
      fontSize: 10,
      color: colors.superset,
      includeFontPadding: false,
    },
    exerciseTitle: {
      fontFamily: fonts.bold,
      fontSize: 17,
      lineHeight: 22,
      color: colors.text,
      letterSpacing: -0.3,
      includeFontPadding: false,
    },
    iconActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    goalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.elevated,
      paddingHorizontal: 9,
      paddingVertical: 5.5,
      borderRadius: radii.xs,
    },
    goalChipLabel: {
      fontFamily: fonts.medium,
      fontSize: 11.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    goalChipMono: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11.5,
      color: colors.text,
      includeFontPadding: false,
    },
    goalDeltaMono: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.elevated,
      paddingHorizontal: 9,
      paddingVertical: 5.5,
      borderRadius: radii.xs,
    },
    supersetChipActive: {
      backgroundColor: colors.supersetMuted,
    },
    metaChipText: {
      fontFamily: fonts.medium,
      fontSize: 11.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    noteBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.elevated,
      borderRadius: radii.xs + 2,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginBottom: 11,
    },
    noteBarText: {
      fontFamily: fonts.medium,
      flex: 1,
      fontSize: 12.5,
      lineHeight: 17,
      color: colors.text,
      includeFontPadding: false,
    },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      marginBottom: 5,
    },
    headSet: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.6,
      color: colors.muted,
      width: 34,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    headPrev: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.6,
      color: colors.muted,
      flex: 1.05,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    headCell: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.6,
      color: colors.muted,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 3,
      textTransform: 'uppercase',
    },
    headStatus: {
      fontFamily: fonts.bold,
      fontSize: 11.5,
      color: colors.muted,
      width: 44,
      textAlign: 'center',
    },
    setsList: {
      gap: 5,
    },
    setRow: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 46,
      paddingVertical: 4,
      paddingLeft: 6,
      paddingRight: 2,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    setRowActive: {
      backgroundColor: colors.activeRowBg,
      borderWidth: 1,
      borderColor: colors.isDark ? 'rgba(200, 255, 61, 0.22)' : 'rgba(21, 128, 61, 0.22)',
    },
    setRowDone: {
      backgroundColor: colors.completedRowBg,
      borderWidth: 1,
      borderColor: colors.completedRowBorder,
    },
    activeLaserRail: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.accentLine,
    },
    setTypeBadge: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 3,
    },
    badgeWarmup: {
      backgroundColor: 'rgba(245, 158, 11, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.38)',
    },
    badgeDropset: {
      backgroundColor: colors.supersetMuted,
      borderWidth: 1,
      borderColor: 'rgba(168, 85, 247, 0.38)',
    },
    badgeFailure: {
      backgroundColor: 'rgba(239, 68, 68, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.38)',
    },
    setNumText: {
      fontFamily: fonts.monoBold,
      fontSize: 13,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    prevCol: {
      flex: 1.05,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    prevText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    rirMiniText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 10,
      color: colors.muted,
      marginTop: 1,
      includeFontPadding: false,
    },
    valueCell: {
      flex: 1,
      height: 38,
      marginHorizontal: 3,
      borderRadius: 9,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueCellActive: {
      backgroundColor: colors.isDark ? '#1E232A' : colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    valueCellDone: {
      backgroundColor: 'transparent',
    },
    valueCellText: {
      fontFamily: fonts.monoBold,
      fontSize: Platform.OS === 'ios' ? 15.5 : 15,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    valueCellTextActive: {
      color: colors.text,
    },
    valueCellTextDone: {
      color: colors.text,
    },
    checkTouchTarget: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkDoneBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkActiveBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkIdleBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    setActionsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    addSetText: {
      fontFamily: fonts.semiBold,
      fontSize: 12.5,
      color: colors.text,
      includeFontPadding: false,
    },
    removeSetBtn: {
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    removeSetText: {
      fontFamily: fonts.medium,
      fontSize: 12.5,
      color: colors.muted,
      includeFontPadding: false,
    },
    legendText: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: colors.muted,
      includeFontPadding: false,
    },
  });
