import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnatomyPreview } from '@/components/progress/AnatomyPreview';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SlidingSegmentedControl } from '@/components/ui/SlidingSegmentedControl';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { isPerHandExercise } from '@/lib/adaptiveProgression';
import { getExerciseDetails } from '@/lib/exerciseDetails';
import { areExercisesEquivalent } from '@/lib/exercises';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { calculateEstimated1RM } from '@/lib/personalRecords';
import { evaluateLiftStandard } from '@/lib/strengthStandards';
import { calculateSetVolumeKg, formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useUserProfileStore } from '@/store/userProfileStore';
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

type DetailTab = 'guide' | 'history';

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
  const { te, tm, tw, tq, language } = useI18n();
  const { unitLabel, fromKg, formatVolume } = useWeightUnit();
  const isUk = language === 'uk';

  const [activeTab, setActiveTab] = useState<DetailTab>('guide');
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const profile = useUserProfileStore((state) => state.profile);

  useEffect(() => {
    if (visible) {
      setActiveTab('guide');
    }
  }, [visible, exerciseName]);

  const details = useMemo(
    () => getExerciseDetails(exerciseName, muscleGroup),
    [exerciseName, muscleGroup]
  );

  const isPerHand = useMemo(
    () => isPerHandExercise(exerciseName, equipment as any),
    [exerciseName, equipment]
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

  const exerciseSessions = useMemo(() => {
    if (!workouts?.length || !exerciseName) return [];
    const normalizedTarget = exerciseName.trim().toLowerCase();
    const list: {
      workoutId: string;
      workoutName: string;
      date: string;
      sets: { weight: number; reps: number; setType?: string; rir?: number }[];
      workingVolume: number;
      best1RM: number;
    }[] = [];

    for (const w of workouts) {
      const match = w.exercises.find((ex) =>
        areExercisesEquivalent(ex, { name: exerciseName })
      );
      if (!match || !match.sets?.length) continue;

      let workingVolume = 0;
      let best1RM = 0;
      for (const s of match.sets) {
        if (s.setType !== 'warmup') {
          workingVolume += calculateSetVolumeKg({
            weightKg: s.weight || 0,
            reps: s.reps || 0,
            exerciseName: match.exerciseName,
            setType: s.setType,
          });
          if (s.weight > 0 && s.reps > 0) {
            best1RM = Math.max(best1RM, calculateEstimated1RM(s.weight, s.reps));
          }
        }
      }

      list.push({
        workoutId: w.id,
        workoutName: w.workoutName,
        date: w.completedAt || w.startedAt,
        sets: match.sets,
        workingVolume,
        best1RM,
      });
    }

    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [workouts, exerciseName]);

  const bestPerformance = useMemo(() => {
    if (exerciseSessions.length === 0) return null;
    let maxWeight = 0;
    let maxReps = 0;
    let best1RM = 0;

    for (const sess of exerciseSessions) {
      for (const s of sess.sets) {
        if (s.setType === 'warmup') continue;
        if (s.weight > 0 && s.reps > 0) {
          const est = calculateEstimated1RM(s.weight, s.reps);
          if (s.weight > maxWeight || (s.weight === maxWeight && s.reps > maxReps)) {
            maxWeight = s.weight;
            maxReps = s.reps;
          }
          if (est > best1RM) best1RM = est;
        }
      }
    }

    if (maxWeight <= 0) return null;
    return { weight: maxWeight, reps: maxReps, estimated1RM: best1RM };
  }, [exerciseSessions]);

  const strengthRank = useMemo(() => {
    if (!bestPerformance) return null;
    return evaluateLiftStandard({
      exerciseName,
      estimated1RMKg: bestPerformance.estimated1RM,
      bodyweightKg: profile.weightKg,
      sex: profile.sex,
    });
  }, [bestPerformance, exerciseName, profile.weightKg, profile.sex]);

  const anatomyMuscles = useMemo(() => {
    const tokens = new Set<string>();
    const combined = `${muscleGroup || ''} ${details.primaryMusclesEn || ''}`.toLowerCase();
    if (muscleGroup) tokens.add(muscleGroup);
    if (combined.includes('chest') || combined.includes('pectoral') || combined.includes('pec')) tokens.add('Chest');
    if (combined.includes('back') || combined.includes('lat') || combined.includes('rhomboid') || combined.includes('trap')) tokens.add('Back');
    if (combined.includes('shoulder') || combined.includes('delt')) tokens.add('Shoulders');
    if (combined.includes('bicep') || combined.includes('tricep') || combined.includes('arm') || combined.includes('brachialis')) tokens.add('Arms');
    if (combined.includes('quad') || combined.includes('hamstring') || combined.includes('glute') || combined.includes('calv') || combined.includes('leg')) tokens.add('Legs');
    if (combined.includes('core') || combined.includes('abs') || combined.includes('oblique')) tokens.add('Core');
    return Array.from(tokens);
  }, [muscleGroup, details.primaryMusclesEn]);

  const physioAccent = colors.isDark ? '#34D399' : '#0F766E';
  const physioBg = colors.isDark ? 'rgba(52, 211, 153, 0.08)' : 'rgba(15, 118, 110, 0.06)';
  const physioBorder = colors.isDark ? 'rgba(52, 211, 153, 0.28)' : 'rgba(15, 118, 110, 0.22)';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={colors.background}
      maxHeight="92%"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.kickerRow}>
            <Text style={styles.headerKickerText}>
              {tm(muscleGroup || 'Full Body')}
              {equipment ? ` · ${tq(equipment)}` : ''}
            </Text>
            {isPerHand && (
              <View style={styles.perHandBadge}>
                <Text style={styles.perHandBadgeText}>
                  {isUk ? 'на 1 руку' : 'per hand'}
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
          <Ionicons name="close" size={20} color={colors.secondary} />
        </Pressable>
      </View>

      {/* Guide / History Segmented Switch */}
      <View style={styles.segmentWrap}>
        <SlidingSegmentedControl<DetailTab>
          variant="bar"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { key: 'guide', label: isUk ? 'Техніка' : 'Guide' },
            {
              key: 'history',
              label:
                exerciseSessions.length > 0
                  ? `${isUk ? 'Історія' : 'History'} (${exerciseSessions.length})`
                  : isUk
                    ? 'Історія'
                    : 'History',
            },
          ]}
        />
      </View>

      <ScrollView
        style={{ flexShrink: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'guide' ? (
          <>
            {/* 1. Split Hero Visual: 3D Exercise Render + Target Anatomy */}
            <View style={styles.heroRow}>
              <View style={styles.heroImageCard}>
                <Image
                  source={getExerciseImage(exerciseName, customImageUri)}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.heroAnatomyCard}>
                <Text style={styles.heroAnatomyLabel}>
                  {isUk ? 'АНАТОМІЯ' : 'TARGET'}
                </Text>
                <AnatomyPreview
                  muscles={anatomyMuscles}
                  sex={profile.sex}
                  height={132}
                  showBack
                />
              </View>
            </View>

            {/* 2. Target Muscles Breakdown */}
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
            </View>

            {/* 3. Dedicated Lyfta-Inspired PHYSIO TIP Callout */}
            {Boolean(details.safetyUk || details.safetyEn) && (
              <View
                style={[
                  styles.safetyCard,
                  { backgroundColor: physioBg, borderColor: physioBorder },
                ]}
              >
                <View style={[styles.physioAccentBar, { backgroundColor: physioAccent }]} />
                <View style={styles.physioHeaderRow}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={physioAccent} />
                  <Text style={[styles.physioEyebrow, { color: physioAccent }]}>
                    {isUk ? 'ПОРАДА ФІЗІОТЕРАПЕВТА · БЕЗПЕКА СУГЛОБІВ' : 'PHYSIO TIP · JOINT SAFETY'}
                  </Text>
                </View>
                <Text style={styles.physioBody}>
                  {isUk ? details.safetyUk : details.safetyEn}
                </Text>
                {Boolean(details.movementSummaryUk || details.movementSummaryEn) && (
                  <Text style={styles.movementSummaryText}>
                    {isUk ? details.movementSummaryUk : details.movementSummaryEn}
                  </Text>
                )}
              </View>
            )}

            {/* 4. Step-by-Step Technique */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeaderTitle}>
                {isUk ? 'Техніка виконання' : 'Execution Guide'}
              </Text>

              <View style={styles.stepsList}>
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

                <View style={[styles.stepItem, styles.stepItemBorder]}>
                  <Text style={styles.stepNumberText}>02</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Робочий рух' : 'Execution'}
                      </Text>
                      <Text style={styles.stepBreathingCue}>
                        {isUk ? 'Контроль' : 'Controlled'}
                      </Text>
                    </View>
                    <Text style={styles.stepDescription}>
                      {isUk ? details.executionUk : details.executionEn}
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepItem, styles.stepItemBorder]}>
                  <Text style={styles.stepNumberText}>03</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>
                        {isUk ? 'Пікове скорочення' : 'Lockout & Cue'}
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

            {/* 5. Common Mistakes */}
            {mistakesList.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeaderTitle}>
                  {isUk ? 'Типові помилки' : 'Common Mistakes'}
                </Text>
                <View style={styles.mistakesList}>
                  {mistakesList.map((item, idx) => (
                    <View key={idx} style={styles.mistakeItem}>
                      <View style={styles.mistakeBullet} />
                      <Text style={styles.mistakeItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          /* HISTORY TAB */
          <>
            {bestPerformance ? (
              <View style={styles.sectionCard}>
                <View style={styles.pbHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>
                    {isUk ? 'Особистий рекорд' : 'Personal Best'}
                  </Text>
                  {strengthRank && (
                    <View
                      style={[
                        styles.rankPill,
                        {
                          borderColor: colors.isDark
                            ? strengthRank.rank.colorDark
                            : strengthRank.rank.colorLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankPillText,
                          {
                            color: colors.isDark
                              ? strengthRank.rank.colorDark
                              : strengthRank.rank.colorLight,
                          },
                        ]}
                      >
                        {isUk ? strengthRank.rank.labelUk : strengthRank.rank.labelEn} · {strengthRank.bodyweightRatio}× BW
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.bestStatsRow}>
                  <View style={styles.bestStatCol}>
                    <Text style={styles.bestStatLabel}>
                      {isUk ? 'Найкращий підхід' : 'Best Set'}
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
                    <Text style={[styles.bestStatValue, { color: colors.primaryText }]}>
                      {formatWeight(fromKg(bestPerformance.estimated1RM))} {unitLabel}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {exerciseSessions.length > 0 ? (
              <View style={styles.historyList}>
                {exerciseSessions.map((sess) => {
                  const dateLabel = new Date(sess.date).toLocaleDateString(
                    isUk ? 'uk-UA' : 'en-US',
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  );
                  return (
                    <View key={`${sess.workoutId}-${sess.date}`} style={styles.historyCard}>
                      <View style={styles.historyCardHead}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyWorkoutName} numberOfLines={1}>
                            {tw(sess.workoutName)}
                          </Text>
                          <Text style={styles.historyDateText}>{dateLabel}</Text>
                        </View>
                        {sess.workingVolume > 0 && (
                          <Text style={styles.historyVolText}>
                            {formatVolume(sess.workingVolume)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.historySetsWrap}>
                        {sess.sets.map((s, sIdx) => {
                          const isWarmup = s.setType === 'warmup';
                          return (
                            <View
                              key={sIdx}
                              style={[
                                styles.historySetChip,
                                isWarmup && styles.historySetChipWarmup,
                              ]}
                            >
                              {isWarmup && <Text style={styles.historyWarmupTag}>W</Text>}
                              <Text style={styles.historySetText}>
                                {s.weight > 0
                                  ? `${formatWeight(fromKg(s.weight))} ${unitLabel} × ${s.reps}`
                                  : `${s.reps} ${isUk ? 'повт' : 'reps'}`}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="barbell-outline" size={30} color={colors.muted} />
                <Text style={styles.emptyHistoryTitle}>
                  {isUk ? 'Ще немає записів цієї вправи' : 'No history for this exercise yet'}
                </Text>
                <Text style={styles.emptyHistorySub}>
                  {isUk
                    ? 'Після першого виконаного підходу тут з’являться ваші сесії, рекорди та 1RM.'
                    : 'Once you log working sets, your sessions, volume, and estimated 1RM will appear here.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
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
            style={({ pressed }) => [styles.configureBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="options-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
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
          style={({ pressed }) => [styles.gotItBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.gotItBtnText}>{isUk ? 'Зрозуміло' : 'Got It'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 12,
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    headerKickerText: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12.5,
      fontWeight: '500',
    },
    perHandBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    perHandBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 10,
      fontWeight: '700',
      color: colors.primaryText,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: -0.35,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    segmentWrap: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 24,
      gap: 12,
    },
    heroRow: {
      flexDirection: 'row',
      gap: 10,
      height: 174,
    },
    heroImageCard: {
      flex: 1.2,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...cardElevation(colors),
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroAnatomyCard: {
      flex: 1,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      gap: 4,
      ...cardElevation(colors),
    },
    heroAnatomyLabel: {
      fontFamily: fonts.bold,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 1.1,
      color: colors.muted,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.md + 2,
      padding: 16,
      gap: 10,
      ...cardElevation(colors),
    },
    sectionHeaderTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    safetyCard: {
      borderRadius: radii.md + 2,
      borderWidth: 1,
      padding: 15,
      paddingLeft: 19,
      gap: 8,
      overflow: 'hidden',
    },
    physioAccentBar: {
      position: 'absolute',
      left: 0,
      top: 12,
      bottom: 12,
      width: 3.5,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    physioHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    physioEyebrow: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.9,
    },
    physioBody: {
      fontFamily: fonts.medium,
      color: colors.text,
      fontSize: 13.5,
      lineHeight: 20,
      fontWeight: '500',
    },
    movementSummaryText: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 12.5,
      lineHeight: 18,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
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
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12.5,
      fontWeight: '500',
      width: 105,
    },
    secondaryBadgeLabel: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: '500',
      width: 105,
    },
    anatomyText: {
      fontFamily: fonts.semiBold,
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'right',
    },
    anatomyTextSecondary: {
      fontFamily: fonts.medium,
      flex: 1,
      color: colors.secondary,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'right',
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
      fontFamily: fonts.bold,
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: '700',
      width: 22,
      marginTop: 1,
      fontVariant: ['tabular-nums'],
    },
    stepHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    stepTitle: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    stepBreathingCue: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 11.5,
      fontWeight: '500',
    },
    stepDescription: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 13,
      lineHeight: 19,
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
      backgroundColor: colors.warning,
      marginTop: 7,
    },
    mistakeItemText: {
      fontFamily: fonts.regular,
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    pbHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rankPill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: radii.pill,
      borderWidth: 1,
      backgroundColor: colors.elevated,
    },
    rankPillText: {
      fontFamily: fonts.bold,
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    bestStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    bestStatCol: {
      flex: 1,
      gap: 2,
    },
    bestStatLabel: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 11.5,
      fontWeight: '500',
    },
    bestStatValue: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.divider,
      marginHorizontal: 14,
    },
    historyList: {
      gap: 10,
    },
    historyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: 14,
      gap: 10,
      ...cardElevation(colors),
    },
    historyCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    historyWorkoutName: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    historyDateText: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 11.5,
      marginTop: 2,
    },
    historyVolText: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    historySetsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    historySetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.elevated,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radii.xs,
    },
    historySetChipWarmup: {
      opacity: 0.72,
    },
    historyWarmupTag: {
      fontFamily: fonts.bold,
      color: colors.warning,
      fontSize: 10,
      fontWeight: '700',
    },
    historySetText: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    emptyHistoryBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
      gap: 8,
    },
    emptyHistoryTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptyHistorySub: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    configureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.elevated,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: radii.md,
    },
    configureBtnText: {
      fontFamily: fonts.semiBold,
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
      paddingVertical: 14,
      borderRadius: radii.md,
    },
    gotItBtnText: {
      fontFamily: fonts.bold,
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
