import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact, hapticMedium } from '@/lib/haptics';
import {
  loadOnboarding,
  saveOnboarding,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';

interface SplitChoice {
  id: WorkoutSplitPreference;
  title: string;
  subtitle: string;
  badge: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  daysRecommended: number[];
}

const SPLIT_CHOICES: SplitChoice[] = [
  {
    id: 'full_body',
    title: 'Full Body',
    subtitle: 'Train your entire body every session. Optimal frequency & recovery.',
    badge: '1–3 DAYS',
    icon: 'human',
    daysRecommended: [1, 2, 3],
  },
  {
    id: 'upper_lower',
    title: 'Upper / Lower',
    subtitle: 'Alternate between upper body compound movements and lower body power.',
    badge: '3–4 DAYS',
    icon: 'weight-lifter',
    daysRecommended: [3, 4],
  },
  {
    id: 'push_pull_legs',
    title: 'Push / Pull / Legs (PPL)',
    subtitle: 'Classic athletic split: Chest/Delts/Triceps, Back/Biceps, Quads/Hams.',
    badge: '3–7 DAYS',
    icon: 'arm-flex',
    daysRecommended: [3, 4, 5, 6, 7],
  },
  {
    id: 'custom',
    title: 'Custom Routine',
    subtitle: 'Train by your own program with full freedom to swap any exercises.',
    badge: 'ANY SCHEDULE',
    icon: 'tune',
    daysRecommended: [1, 2, 3, 4, 5, 6, 7],
  },
];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const SCHEDULE_PATTERNS: Record<number, string[]> = {
  1: ['SUN'],
  2: ['TUE', 'SAT'],
  3: ['MON', 'WED', 'FRI'],
  4: ['MON', 'TUE', 'THU', 'FRI'],
  5: ['MON', 'TUE', 'WED', 'FRI', 'SAT'],
  6: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  7: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
};

export default function Frequency() {
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'WED', 'FRI']);
  const [selectedSplit, setSelectedSplit] =
    useState<WorkoutSplitPreference>('full_body');
  const [hasPresetSplit, setHasPresetSplit] = useState(false);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.splitPreference) {
        setSelectedSplit(data.splitPreference);
        setHasPresetSplit(true);
      }
      if (data?.trainingFrequency && SCHEDULE_PATTERNS[data.trainingFrequency]) {
        setSelectedDays(data.trainingDays || SCHEDULE_PATTERNS[data.trainingFrequency]);
      }
    });
  }, []);

  const days = selectedDays.length;

  const toggleDay = (day: string) => {
    hapticImpact();
    if (selectedDays.includes(day)) {
      if (selectedDays.length <= 1) return; // Keep minimum 1 day
      const next = selectedDays.filter((d) => d !== day);
      setSelectedDays(next);
      if (next.length <= 2 && selectedSplit === 'push_pull_legs') {
        setSelectedSplit('full_body');
      }
    } else {
      if (selectedDays.length >= 7) return; // Maximum 7 days
      const next = WEEKDAYS.filter((d) => selectedDays.includes(d) || d === day);
      setSelectedDays(next);
      if (next.length >= 5 && selectedSplit === 'full_body') {
        setSelectedSplit('push_pull_legs');
      }
    }
  };

  const handleDecrease = () => {
    if (selectedDays.length > 1) {
      hapticImpact();
      const next = selectedDays.slice(0, selectedDays.length - 1);
      setSelectedDays(next);
      if (next.length <= 2 && selectedSplit === 'push_pull_legs') {
        setSelectedSplit('full_body');
      }
    }
  };

  const handleIncrease = () => {
    if (selectedDays.length < 7) {
      hapticImpact();
      const nextDay = WEEKDAYS.find((d) => !selectedDays.includes(d));
      if (nextDay) {
        const next = WEEKDAYS.filter((d) => selectedDays.includes(d) || d === nextDay);
        setSelectedDays(next);
        if (next.length >= 5 && selectedSplit === 'full_body') {
          setSelectedSplit('push_pull_legs');
        }
      }
    }
  };

  const handleSelectSplit = (splitId: WorkoutSplitPreference) => {
    hapticImpact();
    setSelectedSplit(splitId);
  };

  const handleContinue = async () => {
    hapticMedium();
    await saveOnboarding({
      trainingFrequency: days,
      trainingDays: selectedDays,
      splitPreference: selectedSplit,
    });
    router.push('/onboarding/equipment');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 3/5 Progress */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.stepText}>4/6</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>How often can you train?</Text>
          <Text style={styles.subtitle}>Choose your schedule and preferred split.</Text>
        </View>

        {/* 3. Stepper Selector */}
        <View style={styles.stepperWrap}>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease frequency"
              onPress={handleDecrease}
              disabled={days <= 1}
              style={[
                styles.stepBtn,
                days <= 1 && styles.stepBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.stepBtnText,
                  days <= 1 && styles.stepBtnTextDisabled,
                ]}
              >
                −
              </Text>
            </Pressable>

            <View style={styles.numberWrap}>
              <Text style={styles.numberValue}>{days}</Text>
              <Text style={styles.numberUnit}>DAYS / WEEK</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase frequency"
              onPress={handleIncrease}
              disabled={days >= 7}
              style={[
                styles.stepBtn,
                days >= 7 && styles.stepBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.stepBtnText,
                  days >= 7 && styles.stepBtnTextDisabled,
                ]}
              >
                +
              </Text>
            </Pressable>
          </View>

          {/* 4. Weekly Interactive Day Chips */}
          <Text style={styles.daysHint}>Tap days to customize your schedule:</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w) => {
              const isActive = selectedDays.includes(w);
              return (
                <Pressable
                  key={w}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${w}`}
                  onPress={() => toggleDay(w)}
                  style={({ pressed }) => [
                    styles.dayChip,
                    isActive && styles.dayChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      isActive && styles.dayChipTextActive,
                    ]}
                  >
                    {w}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 5. Split Selection Header & Choices */}
        {hasPresetSplit ? (
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <View style={styles.splitHeaderRow}>
              <Text style={styles.splitSectionTitle}>TRAINING SPLIT</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change training split"
                onPress={() => {
                  hapticImpact();
                  setHasPresetSplit(false);
                }}
                hitSlop={10}
              >
                <Text style={styles.changeSplitText}>CHANGE</Text>
              </Pressable>
            </View>

            <View style={styles.presetSplitCard}>
              <View style={styles.presetSplitLeft}>
                <View style={styles.presetSplitIconWrap}>
                  <MaterialCommunityIcons
                    name={
                      selectedSplit === 'full_body'
                        ? 'human'
                        : selectedSplit === 'upper_lower'
                        ? 'weight-lifter'
                        : selectedSplit === 'push_pull_legs'
                        ? 'arm-flex'
                        : 'tune'
                    }
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.presetSplitTextWrap}>
                  <Text style={styles.presetSplitTitle}>
                    {selectedSplit === 'full_body'
                      ? 'Full Body'
                      : selectedSplit === 'upper_lower'
                      ? 'Upper / Lower'
                      : selectedSplit === 'push_pull_legs'
                      ? 'Push / Pull / Legs (PPL)'
                      : 'Custom Routine'}
                  </Text>
                  <Text style={styles.presetSplitSubtitle}>
                    Selected in previous step · Calibrated for {days} days
                  </Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.splitHeaderRow}>
              <Text style={styles.splitSectionTitle}>TRAINING SPLIT</Text>
              <Text style={styles.splitSectionSub}>CHOOSE ONE</Text>
            </View>

            <View style={styles.splitList}>
              {SPLIT_CHOICES.map((choice) => {
                const isSelected = selectedSplit === choice.id;
                const isRecommended = choice.daysRecommended.includes(days);

                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityLabel={choice.title}
                    onPress={() => handleSelectSplit(choice.id)}
                    style={[
                      styles.splitCard,
                      isSelected && styles.splitCardSelected,
                    ]}
                  >
                    <View style={styles.splitCardHeader}>
                      <View style={styles.splitCardLeft}>
                        <View
                          style={[
                            styles.splitIconWrap,
                            isSelected && styles.splitIconWrapSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={choice.icon}
                            size={22}
                            color={isSelected ? colors.primary : '#8E9BAE'}
                          />
                        </View>
                        <View>
                          <Text
                            style={[
                              styles.splitCardTitle,
                              isSelected && styles.splitCardTitleSelected,
                            ]}
                          >
                            {choice.title}
                          </Text>
                          {isRecommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedBadgeText}>
                                RECOMMENDED FOR {days} DAYS
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View
                        style={[
                          styles.checkCircle,
                          isSelected && styles.checkCircleSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={15} color="#0B0D0F" />
                        )}
                      </View>
                    </View>

                    <Text style={styles.splitCardSubtitle}>{choice.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* 7. Pinned CTA Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && styles.continueBtnPressed,
          ]}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#161B22',
  },
  stepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E9BAE',
    letterSpacing: 0.5,
  },
  topBarPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 6,
    lineHeight: 20,
  },
  stepperWrap: {
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D2430',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242C38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
    borderColor: '#1D2430',
  },
  stepBtnText: {
    fontSize: 30,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 34,
  },
  stepBtnTextDisabled: {
    color: '#4B5565',
  },
  numberWrap: {
    alignItems: 'center',
    minWidth: 120,
  },
  numberValue: {
    fontSize: 72,
    fontWeight: '900',
    color: colors.primary, // #C8FF3D
    letterSpacing: -2,
    lineHeight: 80,
  },
  numberUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  daysHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242C38',
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderColor: colors.primary,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dayChipTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  splitSectionTitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  splitSectionSub: {
    color: '#4B5565',
    fontSize: 11,
    fontWeight: '700',
  },
  splitList: {
    gap: 12,
    marginBottom: 16,
  },
  splitCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1D2430',
    padding: 16,
  },
  splitCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
  },
  splitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  splitCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  splitIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitIconWrapSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  splitCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  splitCardTitleSelected: {
    color: '#FFFFFF',
  },
  recommendedBadge: {
    marginTop: 3,
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  splitCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9BAE',
    lineHeight: 18,
    marginTop: 4,
    paddingLeft: 54,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#2D3748',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  changeSplitText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presetSplitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.4)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  presetSplitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  presetSplitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  presetSplitTextWrap: {
    flex: 1,
  },
  presetSplitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  presetSplitSubtitle: {
    fontSize: 12,
    color: '#8E9BAE',
    marginTop: 2,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: '#161B22',
  },
  continueBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  continueText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
