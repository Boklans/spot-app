import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Input() {
  const { t } = useI18n();
  const { unit, unitLabel, toKg, fromKg } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>{t('backToHome')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const exercise = session.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session.currentSetIndex];
  const increment =
    typeof exercise?.weightIncrement === 'number' && exercise.weightIncrement > 0
      ? exercise.weightIncrement
      : 2.5;

  const currentWeightKg = activeSet?.weight ?? 70;
  const currentReps = activeSet?.reps ?? 8;

  const currentDisplayWeight = fromKg(currentWeightKg);
  const displayStep = unit === 'lbs' ? 5 : (increment ?? 2.5);

  const displayWeightAbove = Math.round((currentDisplayWeight + displayStep) * 10) / 10;
  const displayWeightBelow = Math.max(0, Math.round((currentDisplayWeight - displayStep) * 10) / 10);

  const repsList = [5, 6, 7, 8, 9, 10, 11, 12];

  const handleSelectWeight = (displayVal: number) => {
    hapticLight();
    const kg = toKg(displayVal);
    updateCurrentSet({ weight: kg });
  };

  const handleSelectReps = (r: number) => {
    hapticLight();
    updateCurrentSet({ reps: r });
  };

  const handleDone = () => {
    hapticMedium();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {t('setOf')} {session.currentSetIndex + 1} {t('of')} {exercise?.sets.length ?? 3}
        </Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* 2. Hero Weight Header */}
        <View style={styles.heroRow}>
          <View style={styles.weightIconWrap}>
            <MaterialCommunityIcons
              name={unit === 'lbs' ? 'weight-pound' : 'weight-kilogram'}
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={styles.heroWeightText}>
            {formatWeight(currentDisplayWeight)} {unitLabel}
          </Text>
        </View>

        {/* 3. Vertical Weight Selector Dial */}
        <View style={styles.weightDialContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease to ${formatWeight(displayWeightBelow)} ${unitLabel}`}
            onPress={() => handleSelectWeight(displayWeightBelow)}
            style={styles.weightTier}
          >
            <Text style={styles.weightTierMuted}>{formatWeight(displayWeightBelow)}</Text>
          </Pressable>

          <View style={styles.weightActiveRing}>
            <Text style={styles.weightActiveText}>{formatWeight(currentDisplayWeight)}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase to ${formatWeight(displayWeightAbove)} ${unitLabel}`}
            onPress={() => handleSelectWeight(displayWeightAbove)}
            style={styles.weightTier}
          >
            <Text style={styles.weightTierMuted}>{formatWeight(displayWeightAbove)}</Text>
          </Pressable>
        </View>

        {/* 4. Horizontal Reps Selector Dial */}
        <View style={styles.repsSection}>
          <Text style={styles.sectionLabel}>{t('reps')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.repsScroll}
          >
            {repsList.map((rep) => {
              const isSelected = rep === currentReps;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${rep} reps`}
                  key={rep}
                  onPress={() => handleSelectReps(rep)}
                  style={[styles.repCircle, isSelected && styles.repCircleSelected]}
                >
                  <Text style={[styles.repText, isSelected && styles.repTextSelected]}>
                    {rep}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 5. Bottom Pinned Next/Save Button */}
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save and return"
            onPress={handleDone}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>{t('done')}</Text>
          </Pressable>
        </View>
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
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topBarPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  weightIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWeightText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  weightDialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginVertical: 16,
  },
  weightTier: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  weightTierMuted: {
    color: '#4B5565',
    fontSize: 22,
    fontWeight: '700',
  },
  weightActiveRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#14181F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  weightActiveText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  repsSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  sectionLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  repsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  repCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#14181F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repCircleSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  repText: {
    color: '#6C7A8E',
    fontSize: 16,
    fontWeight: '700',
  },
  repTextSelected: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  bottomBar: {
    width: '100%',
    maxWidth: 340,
  },
  nextBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  nextBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  emptyBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '800',
  },
});
