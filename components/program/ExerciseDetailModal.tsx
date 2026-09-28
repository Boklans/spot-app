import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Platform,
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
            {/* 1. Large Hero Exercise 3D Illustration */}
            <View style={styles.heroImageCard}>
              <Image
                source={getExerciseImage(exerciseName, customImageUri)}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>

            {/* 2. Target Muscle Anatomy */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons name="arm-flex" size={18} color={colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'М’ЯЗОВИЙ ПРОФІЛЬ' : 'TARGET ANATOMY'}
                </Text>
              </View>

              <View style={styles.anatomyGroup}>
                <View style={styles.anatomyBadgeRow}>
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeLabel}>
                      {isUk ? 'ОСНОВНІ' : 'PRIMARY'}
                    </Text>
                  </View>
                  <Text style={styles.anatomyText}>
                    {isUk ? details.primaryMusclesUk : details.primaryMusclesEn}
                  </Text>
                </View>

                <View style={styles.anatomyBadgeRow}>
                  <View style={styles.secondaryBadge}>
                    <Text style={styles.secondaryBadgeLabel}>
                      {isUk ? 'ДОПОМІЖНІ' : 'SECONDARY'}
                    </Text>
                  </View>
                  <Text style={styles.anatomyTextSecondary}>
                    {isUk ? details.secondaryMusclesUk : details.secondaryMusclesEn}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Technique: How to Perform */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="fitness-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'ТЕХНІКА ВИКОНАННЯ' : 'HOW TO PERFORM'}
                </Text>
              </View>

              <View style={styles.stepsList}>
                {/* Step 1 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>
                      {isUk ? 'Початкове положення' : 'Setup & Grip'}
                    </Text>
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
                    <Text style={styles.stepTitle}>
                      {isUk ? 'Рух та дихання' : 'Movement & Control'}
                    </Text>
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
                    <Text style={styles.stepTitle}>
                      {isUk ? 'Фіксація та поради' : 'Lockout & Pro Tip'}
                    </Text>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.tipsUk : details.tipsEn}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 4. Common Mistakes */}
            <View style={styles.mistakesCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF9F1C" />
                <Text style={[styles.sectionHeaderTitle, { color: '#FF9F1C' }]}>
                  {isUk ? 'ТИПОВІ ПОМИЛКИ' : 'COMMON MISTAKES'}
                </Text>
              </View>
              <Text style={styles.mistakesText}>
                {isUk ? details.mistakesUk : details.mistakesEn}
              </Text>
            </View>

            {/* 5. Personal Best History */}
            <View style={styles.historyCard}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'ВАША ІСТОРІЯ У SPOT' : 'YOUR SPOT PERFORMANCE'}
                </Text>
              </View>

              {bestPerformance ? (
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
              ) : (
                <View style={styles.noHistoryWrap}>
                  <Ionicons name="fitness" size={24} color="#717B8A" style={{ marginBottom: 6 }} />
                  <Text style={styles.noHistoryText}>
                    {isUk
                      ? 'Ще не виконувалось. Виконайте цю вправу на тренуванні, щоб встановити свій перший орієнтир!'
                      : 'Not performed yet. Complete this exercise in a workout to establish your baseline!'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Button */}
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
              accessibilityLabel="Got it"
              onPress={() => {
                hapticMedium();
                onClose();
              }}
              style={({ pressed }) => [
                styles.gotItBtn,
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.gotItBtnText}>
                {isUk ? 'ЗРОЗУМІЛО' : 'GOT IT'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  musclePillText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  equipmentPill: {
    backgroundColor: '#1E2530',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  equipmentPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#171D26',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  heroImageCard: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  sectionCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  anatomyGroup: {
    gap: 10,
  },
  anatomyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 76,
    alignItems: 'center',
  },
  primaryBadgeLabel: {
    color: '#0B0D0F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryBadge: {
    backgroundColor: '#1E2530',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 76,
    alignItems: 'center',
  },
  secondaryBadgeLabel: {
    color: '#8E9BAE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  anatomyText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  anatomyTextSecondary: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  stepDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  mistakesCard: {
    backgroundColor: 'rgba(255, 159, 28, 0.06)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  mistakesText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  bestStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171D26',
    borderRadius: 14,
    padding: 12,
  },
  bestStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bestStatLabel: {
    color: '#717B8A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bestStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  noHistoryWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  noHistoryText: {
    color: '#717B8A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    paddingHorizontal: 12,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configureBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E2530',
    borderWidth: 1,
    borderColor: '#2F3846',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configureBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gotItBtn: {
    flex: 1.2,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  gotItBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
