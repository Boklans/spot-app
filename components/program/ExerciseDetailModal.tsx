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
import { colors } from '@/constants/colors';
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
              <View style={styles.headerKickerRow}>
                <View style={styles.musclePill}>
                  <Text style={styles.musclePillText}>
                    {tm(muscleGroup || 'Full Body').toUpperCase()}
                  </Text>
                </View>
                {equipment && (
                  <View style={styles.equipmentPill}>
                    <Text style={styles.equipmentPillText}>
                      {equipment.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
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
              <Ionicons name="close" size={24} color="#CBD5E1" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Large Crisp 3D Illustration without clutter */}
            <View style={styles.heroImageCard}>
              <Image
                source={getExerciseImage(exerciseName, customImageUri)}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlayBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.heroOverlayBadgeText}>
                  {isUk ? '3D АНАТОМІЯ М’ЯЗІВ' : '3D MUSCLE ANATOMY'}
                </Text>
              </View>
            </View>

            {/* 2. Target Muscle Anatomy */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons name="arm-flex" size={16} color={colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'ЦІЛЬОВІ М’ЯЗИ' : 'TARGET MUSCLES'}
                </Text>
              </View>

              <View style={styles.anatomyGroup}>
                <View style={styles.anatomyBadgeRow}>
                  <Text style={styles.primaryBadgeLabel}>
                    {isUk ? 'ОСНОВНІ:' : 'PRIMARY:'}
                  </Text>
                  <Text style={styles.anatomyText}>
                    {isUk ? details.primaryMusclesUk : details.primaryMusclesEn}
                  </Text>
                </View>

                {Boolean(details.secondaryMusclesUk || details.secondaryMusclesEn) && (
                  <View style={styles.anatomyBadgeRow}>
                    <Text style={styles.secondaryBadgeLabel}>
                      {isUk ? 'ДОПОМІЖНІ:' : 'SECONDARY:'}
                    </Text>
                    <Text style={styles.anatomyTextSecondary}>
                      {isUk ? details.secondaryMusclesUk : details.secondaryMusclesEn}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 3. Technique: How to Perform */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="fitness-outline" size={16} color={colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'ТЕХНІКА ТА КРОКИ ВИКОНАННЯ' : 'HOW TO PERFORM'}
                </Text>
              </View>

              {(details.movementSummaryUk || details.movementSummaryEn) ? (
                <View style={styles.movementSummaryBanner}>
                  <Ionicons name="swap-vertical" size={14} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={styles.movementSummaryText}>
                    {isUk ? details.movementSummaryUk : details.movementSummaryEn}
                  </Text>
                </View>
              ) : null}

              <View style={styles.stepsList}>
                {/* Step 1 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Позиція та хват' : 'Setup & Grip'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? '🫁 Кор напружений' : '🫁 Brace core'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.setupUk : details.setupEn}
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Робочий рух' : 'Execution & Control'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? '🌬️ Вдих носом' : '🌬️ Inhale'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.executionUk : details.executionEn}
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Фіксація та видих' : 'Lockout & Breathing'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? '💨 Потужний видих' : '💨 Exhale'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.tipsUk : details.tipsEn}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 4. Common Mistakes */}
            {mistakesList.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                  <Text style={[styles.sectionHeaderTitle, { color: '#FF6B6B' }]}>
                    {isUk ? 'ТИПОВІ ПОМИЛКИ' : 'COMMON MISTAKES'}
                  </Text>
                </View>
                <View style={styles.mistakesList}>
                  {mistakesList.map((item, idx) => (
                    <View key={idx} style={styles.mistakeItem}>
                      <Ionicons name="close-circle" size={14} color="#FF6B6B" style={{ marginTop: 2 }} />
                      <Text style={styles.mistakeItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 4b. Joint Safety Cue */}
            {Boolean(details.safetyUk || details.safetyEn) && (
              <View style={styles.safetyCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#38BDF8" />
                  <Text style={[styles.sectionHeaderTitle, { color: '#38BDF8' }]}>
                    {isUk ? 'БЕЗПЕКА ТА ЗАХИСТ СУГЛОБІВ' : 'JOINT SAFETY'}
                  </Text>
                </View>
                <Text style={styles.safetyText}>
                  {isUk ? details.safetyUk : details.safetyEn}
                </Text>
              </View>
            )}

            {/* 5. Personal Best in SPOT */}
            {bestPerformance && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="trophy-outline" size={16} color={colors.primary} />
                  <Text style={styles.sectionHeaderTitle}>
                    {isUk ? 'ВАШ РЕКОРД У SPOT' : 'YOUR SPOT RECORD'}
                  </Text>
                </View>
                <View style={styles.bestStatsRow}>
                  <View style={styles.bestStatCol}>
                    <Text style={styles.bestStatLabel}>
                      {isUk ? 'КРАЩИЙ ПІДХІД' : 'BEST SET'}
                    </Text>
                    <Text style={styles.bestStatValue}>
                      {formatWeight(fromKg(bestPerformance.weight))} {unitLabel} × {bestPerformance.reps}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.bestStatCol}>
                    <Text style={styles.bestStatLabel}>
                      {isUk ? 'РОЗРАХУНКОВИЙ 1RM' : 'EST. 1RM'}
                    </Text>
                    <Text style={[styles.bestStatValue, { color: colors.primary }]}>
                      {formatWeight(fromKg(bestPerformance.estimated1RM))} {unitLabel}
                    </Text>
                  </View>
                </View>
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
                  {isUk ? 'НАЛАШТУВАТИ' : 'CONFIGURE'}
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
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#0B0D0F" style={{ marginRight: 6 }} />
              <Text style={styles.gotItBtnText}>
                {isUk ? 'Зрозуміло — до підходу' : 'Got It — Back to Workout'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0D11',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '92%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  musclePill: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  musclePillText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  equipmentPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  equipmentPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 14,
  },
  heroImageCard: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    backgroundColor: '#0E1115',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlayBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(11, 13, 15, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  heroOverlayBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    color: '#CBD5E1',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  anatomyGroup: {
    gap: 6,
  },
  anatomyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  primaryBadgeLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    width: 80,
  },
  secondaryBadgeLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
    width: 80,
  },
  anatomyText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  anatomyTextSecondary: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  movementSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.15)',
  },
  movementSummaryText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  stepBreathingCue: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
  },
  stepDescription: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  mistakesList: {
    gap: 8,
  },
  mistakeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mistakeItemText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  safetyCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    gap: 8,
  },
  safetyText: {
    color: '#BAE6FD',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  bestStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
  },
  bestStatCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  bestStatLabel: {
    color: '#8E9BAE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bestStatValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#0A0D11',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  configureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E242E',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  configureBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  gotItBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  gotItBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
  },
});
