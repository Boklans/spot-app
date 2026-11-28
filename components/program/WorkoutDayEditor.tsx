import React, { useMemo, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExerciseDetailModal } from '@/components/program/ExerciseDetailModal';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticImpact, hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { ALL_WEEKDAYS } from '@/lib/programGenerator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { getSupersetBadgeLabel } from '@/store/workoutSessionStore';
import type { UserExercise } from '@/types/userProgram';

export interface WorkoutDayEditorProps {
  workoutName: string;
  dayLabel: string;
  exercises: UserExercise[];
  onChangeWorkoutName: (name: string) => void;
  onChangeDayLabel: (day: string) => void;
  onUpdateExercise: (index: number, patch: Partial<UserExercise>) => void;
  onMoveExerciseUp: (index: number) => void;
  onMoveExerciseDown: (index: number) => void;
  onToggleSuperset: (index: number) => void;
  onRemoveExercise: (index: number) => void;
  onOpenAddExercises: () => void;
}

/**
 * Compact 64pt Accordion Routine Editor shared between WorkoutEditorModal and ProgramEdit.
 * - Collapsed rows display full 2-line Ukrainian/English exercise names (zero '...' truncation)
 *   plus JetBrains Mono prescription summaries ("3 × 60 кг × 8-12 · 90с").
 * - Tapping expands 1 exercise at a time to configure sets, rep range, weight, step & rest.
 */
export function WorkoutDayEditor({
  workoutName,
  dayLabel,
  exercises,
  onChangeWorkoutName,
  onChangeDayLabel,
  onUpdateExercise,
  onMoveExerciseUp,
  onMoveExerciseDown,
  onToggleSuperset,
  onRemoveExercise,
  onOpenAddExercises,
}: WorkoutDayEditorProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const { t, tm, td, te, tq, language } = useI18n();
  const isUk = language === 'uk';
  const { unitLabel, step: weightStep, formatWithUnit, fromKg, toKg } = useWeightUnit();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rawWeights, setRawWeights] = useState<Record<string, string>>({});
  const [detailExercise, setDetailExercise] = useState<UserExercise | null>(null);

  const toggleExpand = (exId: string) => {
    hapticLight();
    if (!reducedMotion && Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedId((prev) => (prev === exId ? null : exId));
  };

  return (
    <View style={styles.container}>
      {/* 1. Workout Name */}
      <View style={styles.fieldBlock}>
        <Text style={styles.sectionLabel}>{t('workoutName')}</Text>
        <TextInput
          value={workoutName}
          onChangeText={onChangeWorkoutName}
          placeholder={isUk ? 'Наприклад: Верх тіла A' : 'e.g., Upper Body A'}
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
        />
      </View>

      {/* 2. Weekday Chips */}
      <View style={styles.fieldBlock}>
        <Text style={styles.sectionLabel}>
          {isUk ? 'ДЕНЬ ТИЖНЯ' : 'DAY OF THE WEEK'}
        </Text>
        <View style={styles.weekdayRow}>
          {ALL_WEEKDAYS.map((d) => {
            const active = dayLabel?.toUpperCase() === d;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={td(d)}
                onPress={() => {
                  hapticLight();
                  onChangeDayLabel(d);
                }}
                style={[styles.weekdayChip, active && styles.weekdayChipActive]}
              >
                <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                  {td(d)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 3. Accordion Exercise List */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionLabel}>
          {t('exercises').toUpperCase()} ({exercises.length})
        </Text>
        <Text style={styles.hintText}>
          {isUk ? 'Натисніть рядок для налаштування' : 'Tap row to configure'}
        </Text>
      </View>

      {exercises.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="barbell-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyTitle}>
            {isUk ? 'У тренуванні ще немає вправ' : 'No exercises yet'}
          </Text>
        </View>
      ) : (
        <View style={styles.accordionStack}>
          {exercises.map((ex, idx) => {
            const exKey = ex.id || `${ex.name}-${idx}`;
            const isExpanded = expandedId === exKey;
            const isFirst = idx === 0;
            const isLast = idx === exercises.length - 1;
            const supersetLabel = getSupersetBadgeLabel(exercises, idx);
            const restVal = ex.restSeconds ?? 90;
            const weightStr =
              ex.recommendedWeight && ex.recommendedWeight > 0
                ? formatWithUnit(ex.recommendedWeight)
                : isUk
                  ? 'ВТ'
                  : 'BW';
            const inputWeightValue =
              rawWeights[exKey] !== undefined
                ? rawWeights[exKey]
                : formatWeight(fromKg(ex.recommendedWeight ?? 0));

            return (
              <View
                key={exKey}
                style={[
                  styles.itemCard,
                  Boolean(supersetLabel) && styles.itemCardSuperset,
                  isExpanded && styles.itemCardExpanded,
                ]}
              >
                {/* Collapsed 64pt Header Row (sibling Pressables prevent nested <button> on web) */}
                <View style={styles.collapsedRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={te(ex.name)}
                    hitSlop={4}
                    onPress={() => {
                      hapticLight();
                      setDetailExercise(ex);
                    }}
                    style={styles.thumbWrap}
                  >
                    <Image
                      source={getExerciseImage(ex.name, ex.customImageUri)}
                      style={styles.thumbImg}
                      resizeMode="cover"
                    />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggleExpand(exKey)}
                    style={styles.titleCol}
                  >
                    <View style={styles.titleTopLine}>
                      {supersetLabel && (
                        <View style={styles.supersetPill}>
                          <Ionicons name="link" size={9} color={colors.superset} />
                          <Text style={styles.supersetPillText}>{supersetLabel}</Text>
                        </View>
                      )}
                      <Text numberOfLines={2} style={styles.exerciseTitle}>
                        {te(ex.name)}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.summaryMono}>
                      {ex.sets} × {weightStr} × {ex.targetRepRange || '8-12'} · {restVal}
                      {isUk ? 'с' : 's'}
                    </Text>
                  </Pressable>

                  <View style={styles.quickReorderCol}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isFirst}
                      hitSlop={6}
                      onPress={() => onMoveExerciseUp(idx)}
                      style={[styles.reorderBtn, isFirst && { opacity: 0.25 }]}
                    >
                      <Ionicons name="chevron-up" size={14} color={colors.secondary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isLast}
                      hitSlop={6}
                      onPress={() => onMoveExerciseDown(idx)}
                      style={[styles.reorderBtn, isLast && { opacity: 0.25 }]}
                    >
                      <Ionicons name="chevron-down" size={14} color={colors.secondary} />
                    </Pressable>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => toggleExpand(exKey)}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-up-circle' : 'options-outline'}
                      size={19}
                      color={isExpanded ? colors.primaryText : colors.muted}
                    />
                  </Pressable>
                </View>

                {/* Expanded Inline Controls */}
                {isExpanded && (
                  <View style={styles.expandedPanel}>
                    <Text style={styles.muscleMetaText}>
                      {tm(ex.muscleGroup)} · {tq(ex.equipment)}
                    </Text>

                    <View style={styles.controlsGrid}>
                      {/* Sets Stepper */}
                      <View style={styles.controlCol}>
                        <Text style={styles.controlLabel}>{t('sets').toUpperCase()}</Text>
                        <View style={styles.stepperBox}>
                          <Pressable
                            onPress={() => {
                              hapticLight();
                              onUpdateExercise(idx, { sets: Math.max(1, ex.sets - 1) });
                            }}
                            style={styles.stepBtn}
                          >
                            <Ionicons name="remove" size={16} color={colors.text} />
                          </Pressable>
                          <Text style={styles.stepValueMono}>{ex.sets}</Text>
                          <Pressable
                            onPress={() => {
                              hapticLight();
                              onUpdateExercise(idx, { sets: Math.min(15, ex.sets + 1) });
                            }}
                            style={styles.stepBtn}
                          >
                            <Ionicons name="add" size={16} color={colors.text} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Rep Range */}
                      <View style={styles.controlCol}>
                        <Text style={styles.controlLabel}>{t('reps').toUpperCase()}</Text>
                        <TextInput
                          value={ex.targetRepRange}
                          onChangeText={(txt) => onUpdateExercise(idx, { targetRepRange: txt })}
                          maxLength={10}
                          placeholder="8-12"
                          placeholderTextColor={colors.muted}
                          style={styles.monoInput}
                        />
                      </View>
                    </View>

                    <View style={styles.controlsGrid}>
                      {/* Target Weight */}
                      <View style={styles.controlCol}>
                        <Text style={styles.controlLabel}>
                          {isUk
                            ? `ВАГА (${unitLabel.toUpperCase()})`
                            : `WEIGHT (${unitLabel.toUpperCase()})`}
                        </Text>
                        <View style={styles.stepperBox}>
                          <Pressable
                            onPress={() => {
                              hapticLight();
                              const curr = fromKg(ex.recommendedWeight || 0);
                              const next = Math.max(
                                0,
                                Math.round((curr - weightStep) * 10) / 10
                              );
                              setRawWeights((p) => ({ ...p, [exKey]: formatWeight(next) }));
                              onUpdateExercise(idx, { recommendedWeight: toKg(next) });
                            }}
                            style={styles.stepBtn}
                          >
                            <Ionicons name="remove" size={16} color={colors.text} />
                          </Pressable>
                          <TextInput
                            value={inputWeightValue}
                            onChangeText={(txt) => {
                              setRawWeights((p) => ({ ...p, [exKey]: txt }));
                              const parsed = parseFloat(txt.replace(',', '.'));
                              if (!isNaN(parsed) && parsed >= 0) {
                                onUpdateExercise(idx, {
                                  recommendedWeight: toKg(Math.min(999, parsed)),
                                });
                              } else if (txt.trim() === '') {
                                onUpdateExercise(idx, { recommendedWeight: 0 });
                              }
                            }}
                            keyboardType="decimal-pad"
                            maxLength={5}
                            style={styles.stepInputMono}
                          />
                          <Pressable
                            onPress={() => {
                              hapticLight();
                              const curr = fromKg(ex.recommendedWeight || 0);
                              const next = Math.min(
                                999,
                                Math.round((curr + weightStep) * 10) / 10
                              );
                              setRawWeights((p) => ({ ...p, [exKey]: formatWeight(next) }));
                              onUpdateExercise(idx, { recommendedWeight: toKg(next) });
                            }}
                            style={styles.stepBtn}
                          >
                            <Ionicons name="add" size={16} color={colors.text} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Rest Presets */}
                      <View style={styles.controlCol}>
                        <Text style={styles.controlLabel}>
                          {isUk ? 'ВІДПОЧИНОК' : 'REST TIMER'}
                        </Text>
                        <View style={styles.restPillsRow}>
                          {[0, 60, 90, 120, 150].map((sec) => {
                            const active = restVal === sec;
                            return (
                              <Pressable
                                key={sec}
                                onPress={() => {
                                  hapticLight();
                                  onUpdateExercise(idx, { restSeconds: sec, isCustomRest: true });
                                }}
                                style={[styles.restPill, active && styles.restPillActive]}
                              >
                                <Text
                                  style={[
                                    styles.restPillText,
                                    active && styles.restPillTextActive,
                                  ]}
                                >
                                  {sec}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {/* Bottom Action Strip inside Accordion: Superset Link + Remove */}
                    <View style={styles.itemActionsRow}>
                      {!isLast ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            hapticMedium();
                            onToggleSuperset(idx);
                          }}
                          style={[
                            styles.supersetToggleBtn,
                            Boolean(ex.supersetWithNext) && styles.supersetToggleBtnActive,
                          ]}
                        >
                          <Ionicons
                            name="link"
                            size={14}
                            color={ex.supersetWithNext ? colors.superset : colors.secondary}
                          />
                          <Text
                            style={[
                              styles.supersetToggleText,
                              Boolean(ex.supersetWithNext) && { color: colors.superset },
                            ]}
                          >
                            {ex.supersetWithNext
                              ? isUk
                                ? 'У суперсеті з наступною'
                                : 'Linked with next'
                              : isUk
                                ? 'Звʼязати в суперсет'
                                : 'Link superset'}
                          </Text>
                        </Pressable>
                      ) : (
                        <View />
                      )}

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          hapticImpact();
                          onRemoveExercise(idx);
                        }}
                        style={styles.removeExBtn}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        <Text style={styles.removeExText}>
                          {isUk ? 'Прибрати' : 'Remove'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 4. Add Exercise(s) Button */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          hapticLight();
          onOpenAddExercises();
        }}
        style={({ pressed }) => [styles.addExercisesBtn, pressed && { opacity: 0.8 }]}
      >
        <Ionicons name="add-circle-outline" size={19} color={colors.primaryText} />
        <Text style={styles.addExercisesText}>
          {isUk ? 'Додати вправи з каталогу' : 'Add Exercises from Catalog'}
        </Text>
      </Pressable>

      {detailExercise && (
        <ExerciseDetailModal
          visible={detailExercise !== null}
          onClose={() => setDetailExercise(null)}
          exerciseName={detailExercise.name}
          muscleGroup={detailExercise.muscleGroup}
          equipment={detailExercise.equipment}
          customImageUri={detailExercise.customImageUri}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 14,
    },
    fieldBlock: {
      gap: 7,
    },
    sectionLabel: {
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.muted,
      textTransform: 'uppercase',
      includeFontPadding: false,
    },
    nameInput: {
      fontFamily: fonts.semiBold,
      height: 46,
      borderRadius: radii.sm + 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: 6,
    },
    weekdayChip: {
      flex: 1,
      height: 36,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekdayChipActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    weekdayText: {
      fontFamily: fonts.semiBold,
      fontSize: 11.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    weekdayTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    hintText: {
      fontFamily: fonts.regular,
      fontSize: 11.5,
      color: colors.muted,
      includeFontPadding: false,
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    emptyTitle: {
      fontFamily: fonts.medium,
      fontSize: 13.5,
      color: colors.secondary,
    },
    accordionStack: {
      gap: 8,
    },
    itemCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      ...cardElevation(colors),
      overflow: 'hidden',
    },
    itemCardSuperset: {
      borderLeftWidth: 3,
      borderLeftColor: colors.superset,
    },
    itemCardExpanded: {
      borderColor: colors.isDark ? 'rgba(200, 255, 61, 0.25)' : 'rgba(21, 128, 61, 0.28)',
    },
    collapsedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 10,
    },
    thumbWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    titleCol: {
      flex: 1,
      gap: 3,
    },
    titleTopLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    supersetPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.supersetMuted,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 5,
      marginTop: 1,
    },
    supersetPillText: {
      fontFamily: fonts.monoBold,
      fontSize: 10,
      color: colors.superset,
      includeFontPadding: false,
    },
    exerciseTitle: {
      fontFamily: fonts.semiBold,
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
      includeFontPadding: false,
    },
    summaryMono: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11.5,
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    quickReorderCol: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    reorderBtn: {
      width: 26,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 5,
      backgroundColor: colors.elevated,
    },
    expandedPanel: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: 10,
    },
    muscleMetaText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    controlsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    controlCol: {
      flex: 1,
      gap: 5,
    },
    controlLabel: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.6,
      color: colors.muted,
      includeFontPadding: false,
    },
    stepperBox: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 38,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 4,
    },
    stepBtn: {
      width: 30,
      height: 30,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    stepValueMono: {
      fontFamily: fonts.monoBold,
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
      fontSize: 14,
      color: colors.text,
      includeFontPadding: false,
    },
    stepInputMono: {
      fontFamily: fonts.monoBold,
      flex: 1,
      minWidth: 0,
      width: '100%',
      textAlign: 'center',
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },
    monoInput: {
      fontFamily: fonts.monoBold,
      minWidth: 0,
      width: '100%',
      height: 38,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },
    restPillsRow: {
      flexDirection: 'row',
      height: 38,
      gap: 4,
    },
    restPill: {
      flex: 1,
      borderRadius: radii.xs,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restPillActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    restPillText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      color: colors.secondary,
      includeFontPadding: false,
    },
    restPillTextActive: {
      fontFamily: fonts.monoBold,
      color: colors.activeChipText,
    },
    itemActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
    },
    supersetToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
    },
    supersetToggleBtnActive: {
      backgroundColor: colors.supersetMuted,
    },
    supersetToggleText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    removeExBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    removeExText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.danger,
      includeFontPadding: false,
    },
    addExercisesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    addExercisesText: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.primaryText,
      includeFontPadding: false,
    },
  });
