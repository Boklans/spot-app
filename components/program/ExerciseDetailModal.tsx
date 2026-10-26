import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { getExerciseDetails } from '@/lib/exerciseDetails';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { calculateEstimated1RM } from '@/lib/personalRecords';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

export interface ExerciseDetailModalProps {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  muscleGroup?: string;
  customImageUri?: string;
  equipment?: string;
  onConfigure?: () => void;
}

export function ExerciseDetailModal({
  visible,
  onClose,
  exerciseName,
  muscleGroup,
  customImageUri,
  equipment,
  onConfigure,
}: ExerciseDetailModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { te, tm, language } = useI18n();
  const { unitLabel, fromKg } = useWeightUnit();
  const isUk = language === 'uk';

  const workouts = useWorkoutHistoryStore((state) => state.workouts);

  const details = useMemo(
    () => getExerciseDetails(exerciseName, muscleGroup),
    [exerciseName, muscleGroup]
  );

  const mistakesList = useMemo(() => {
    const raw = isUk ? details.mistakesUk : details.mistakesEn;
    if (!raw) return [];
    const split = raw
      .split(/(?<=[.!?])\s+|\s+(?=Уникайте|Не |Avoid|Do not)/i)
      .map((s) => s.trim().replace(/^[-•–]\s*/, ''))
      .filter((s) => s.length > 5);
    return split.length > 0 ? split : [raw];
  }, [details, isUk]);

  const bestPerformance = useMemo(() => {
    if (!workouts || workouts.length === 0 || !exerciseName) return null;
    const normalizedTarget = exerciseName.trim().toLowerCase();

    let maxWeight = 0;
    let maxReps = 0;
    let best1RM = 0;
    let found = false;

    for (const w of workouts) {
      for (const ex of w.exercises) {
        if (ex.exerciseName.toLowerCase() === normalizedTarget) {
          for (const s of ex.sets) {
            if (s.weight > 0 && s.reps > 0) {
              found = true;
              const est1RM = calculateEstimated1RM(s.weight, s.reps);
              if (s.weight > maxWeight) {
                maxWeight = s.weight;
                maxReps = s.reps;
              }
              if (est1RM > best1RM) {
                best1RM = est1RM;
              }
            }
          }
        }
      }
    }

    if (!found) return null;
    return {
      weight: maxWeight,
      reps: maxReps,
      estimated1RM: best1RM,
    };
  }, [workouts, exerciseName]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKickerText}>
                {tm(muscleGroup || 'Full Body')}
                {equipment ? `  ·  ${equipment}` : ''}
              </Text>
              <Text numberOfLines={2} style={styles.headerTitle}>
                {te(exerciseName)}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={() => {
                hapticLight();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#A0A8B4" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Clean Illustration */}
            <View style={styles.heroImageCard}>
              <Image
                source={getExerciseImage(exerciseName, customImageUri)}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>

            {/* 2. Target Muscle Anatomy & Personal Best */}
            <View style={styles.sectionCard}>
              <View style={styles.anatomyGroup}>
                <View style={styles.anatomyBadgeRow}>
                  <Text style={styles.primaryBadgeLabel}>
                    {isUk ? 'Основні м’язи' : 'Primary'}
                  </Text>
                  <Text style={styles.anatomyText}>
                    {isUk ? details.primaryMusclesUk : details.primaryMusclesEn}
                  </Text>
                </View>

                {Boolean(details.secondaryMusclesUk || details.secondaryMusclesEn) && (
                  <View style={[styles.anatomyBadgeRow, styles.anatomyRowDivider]}>
                    <Text style={styles.secondaryBadgeLabel}>
                      {isUk ? 'Допоміжні' : 'Secondary'}
                    </Text>
                    <Text style={styles.anatomyTextSecondary}>
                      {isUk ? details.secondaryMusclesUk : details.secondaryMusclesEn}
                    </Text>
                  </View>
                )}
              </View>

              {bestPerformance && (
                <View style={styles.bestStatsRow}>
                  <View style={styles.bestStatCol}>
                    <Text style={styles.bestStatLabel}>
                      {isUk ? 'Кращий підхід' : 'Best set'}
                    </Text>
                    <Text style={styles.bestStatValue}>
                      {formatWeight(fromKg(bestPerformance.weight))} {unitLabel} × {bestPerformance.reps}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.bestStatCol}>
                    <Text style={styles.bestStatLabel}>
                      {isUk ? 'Розрахунковий 1RM' : 'Estimated 1RM'}
                    </Text>
                    <Text style={styles.bestStatValue}>
                      {formatWeight(fromKg(bestPerformance.estimated1RM))} {unitLabel}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 3. Technique: How to Perform */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeaderTitle}>
                {isUk ? 'Техніка виконання' : 'Technique'}
              </Text>

              {(details.movementSummaryUk || details.movementSummaryEn) ? (
                <Text style={styles.movementSummaryText}>
                  {isUk ? details.movementSummaryUk : details.movementSummaryEn}
                </Text>
              ) : null}

              <View style={styles.stepsList}>
                {/* Step 1 */}
                <View style={styles.stepItem}>
                  <Text style={styles.stepNumberText}>01</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Вихідне положення' : 'Setup & Grip'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? 'Кор напружений' : 'Brace core'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.setupUk : details.setupEn}
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={[styles.stepItem, styles.stepItemBorder]}>
                  <Text style={styles.stepNumberText}>02</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Робочий рух' : 'Execution'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? 'На вдиху' : 'Inhale'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.executionUk : details.executionEn}
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={[styles.stepItem, styles.stepItemBorder]}>
                  <Text style={styles.stepNumberText}>03</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Фіксація' : 'Lockout'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? 'На видиху' : 'Exhale'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.tipsUk : details.tipsEn}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 4. Common Mistakes & Safety combined cleanly */}
            {(mistakesList.length > 0 || Boolean(details.safetyUk || details.safetyEn)) && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'На що звернути увагу' : 'Key Form Cues'}
                </Text>

                {mistakesList.length > 0 && (
                  <View style={styles.mistakesList}>
                    {mistakesList.map((item, idx) => (
                      <View key={idx} style={styles.mistakeItem}>
                        <View style={styles.mistakeBullet} />
                        <Text style={styles.mistakeItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {Boolean(details.safetyUk || details.safetyEn) && (
                  <View style={[styles.safetyBlock, mistakesList.length > 0 && styles.safetyBlockBorder]}>
                    <Text style={styles.safetyLabel}>
                      {isUk ? 'Безпека суглобів' : 'Joint safety'}
                    </Text>
                    <Text style={styles.safetyText}>
                      {isUk ? details.safetyUk : details.safetyEn}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            {onConfigure ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Configure exercise"
                onPress={() => {
                  hapticLight();
                  onClose();
                  onConfigure();
                }}
                style={({ pressed }) => [
                  styles.configureBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="options-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.configureBtnText}>
                  {isUk ? 'Налаштувати' : 'Configure'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Got it, back to workout"
              onPress={() => {
                hapticMedium();
                onClose();
              }}
              style={({ pressed }) => [
                styles.gotItBtn,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={styles.gotItBtnText}>
                {isUk ? 'Зрозуміло' : 'Got It'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerKickerText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 14,
  },
  heroImageCard: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionHeaderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  anatomyGroup: {
    gap: 10,
  },
  anatomyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  anatomyRowDivider: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  primaryBadgeLabel: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
    width: 110,
  },
  secondaryBadgeLabel: {
    color: '#6C7685',
    fontSize: 13,
    fontWeight: '500',
    width: 110,
  },
  anatomyText: {
    flex: 1,
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  anatomyTextSecondary: {
    flex: 1,
    color: colors.secondary,
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'right',
  },
  movementSummaryText: {
    color: colors.secondary,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
  },
  stepsList: {
    marginTop: 2,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  stepItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  stepNumberText: {
    color: '#5C6574',
    fontSize: 13,
    fontWeight: '700',
    width: 22,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stepBreathingCue: {
    color: '#6C7685',
    fontSize: 12,
    fontWeight: '500',
  },
  stepDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  mistakesList: {
    gap: 8,
  },
  mistakeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mistakeBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6C7685',
    marginTop: 7,
  },
  mistakeItemText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  safetyBlock: {
    gap: 4,
  },
  safetyBlockBorder: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  safetyLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  safetyText: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  bestStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bestStatCol: {
    flex: 1,
    gap: 2,
  },
  bestStatLabel: {
    color: colors.secondary,
    fontSize: 11.5,
    fontWeight: '500',
  },
  bestStatValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  configureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  configureBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  gotItBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 16,
  },
  gotItBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
