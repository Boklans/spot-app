import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  loadOnboarding,
  saveOnboarding,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';

interface DurationChoice {
  minutes: number;
  title: string;
  subtitle: string;
  badge?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const DURATION_CHOICES: DurationChoice[] = [
  {
    minutes: 30,
    title: '30 хв · Швидке',
    subtitle: 'Коротке й інтенсивне тренування без зайвого відпочинку (~4 вправи)',
    badge: 'EXPRESS',
    icon: 'lightning-bolt',
  },
  {
    minutes: 45,
    title: '45 хв · Оптимальне',
    subtitle: 'Ідеальний баланс сили, обʼєму та відновлення (~5–6 вправ)',
    badge: 'РЕКОМЕНДОВАНО',
    icon: 'timer-sand',
  },
  {
    minutes: 60,
    title: '60 хв · Повне',
    subtitle: 'Глибоке опрацювання цільових мʼязів та повний відпочинок (~6–7 вправ)',
    badge: 'POWER',
    icon: 'weight-lifter',
  },
];

const WEEKDAYS = [
  { key: 'MON', label: 'ПН' },
  { key: 'TUE', label: 'ВТ' },
  { key: 'WED', label: 'СР' },
  { key: 'THU', label: 'ЧТ' },
  { key: 'FRI', label: 'ПТ' },
  { key: 'SAT', label: 'СБ' },
  { key: 'SUN', label: 'НД' },
];

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
  const { t } = useI18n();
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'WED', 'FRI']);
  const [selectedDuration, setSelectedDuration] = useState<number>(45);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.sessionDurationMinutes) {
        setSelectedDuration(data.sessionDurationMinutes);
      }
      if (data?.trainingFrequency && SCHEDULE_PATTERNS[data.trainingFrequency]) {
        setSelectedDays(data.trainingDays || SCHEDULE_PATTERNS[data.trainingFrequency]);
      }
    });
  }, []);

  const days = selectedDays.length;

  const toggleDay = (dayKey: string) => {
    hapticImpact();
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length <= 1) return; // Keep minimum 1 day
      setSelectedDays(selectedDays.filter((d) => d !== dayKey));
    } else {
      if (selectedDays.length >= 7) return; // Maximum 7 days
      setSelectedDays(WEEKDAYS.map((w) => w.key).filter((d) => selectedDays.includes(d) || d === dayKey));
    }
  };

  const handleDecrease = () => {
    if (selectedDays.length > 1) {
      hapticImpact();
      setSelectedDays(selectedDays.slice(0, selectedDays.length - 1));
    }
  };

  const handleIncrease = () => {
    if (selectedDays.length < 7) {
      hapticImpact();
      const allKeys = WEEKDAYS.map((w) => w.key);
      const nextDay = allKeys.find((d) => !selectedDays.includes(d));
      if (nextDay) {
        setSelectedDays(allKeys.filter((d) => selectedDays.includes(d) || d === nextDay));
      }
    }
  };

  const handleContinue = async () => {
    hapticMedium();
    // Automatically calibrate split according to frequency
    const autoSplit: WorkoutSplitPreference =
      days <= 2 ? 'full_body' : days <= 4 ? 'upper_lower' : 'push_pull_legs';

    await saveOnboarding({
      trainingFrequency: days,
      trainingDays: selectedDays,
      sessionDurationMinutes: selectedDuration,
      splitPreference: autoSplit,
      equipment: ['full_gym'],
    });
    router.push('/onboarding/program-ready');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 3/3 Progress */}
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
        <Text style={styles.stepText}>3/3</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Графік і час</Text>
          <Text style={styles.subtitle}>
            Скільки днів та скільки часу на тренування вам зручно приділяти?
          </Text>
        </View>

        {/* 3. Days Stepper */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ДНІ НА ТИЖДЕНЬ</Text>
          <Text style={styles.sectionSub}>{days} ДНІВ</Text>
        </View>

        <View style={styles.stepperWrap}>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Зменшити кількість днів"
              onPress={handleDecrease}
              disabled={days <= 1}
              style={[styles.stepBtn, days <= 1 && styles.stepBtnDisabled]}
            >
              <Text style={[styles.stepBtnText, days <= 1 && styles.stepBtnTextDisabled]}>−</Text>
            </Pressable>

            <View style={styles.numberWrap}>
              <Text style={styles.numberValue}>{days}</Text>
              <Text style={styles.numberUnit}>
                {days === 1 ? 'ДЕНЬ / ТИЖДЕНЬ' : days < 5 ? 'ДНІ / ТИЖДЕНЬ' : 'ДНІВ / ТИЖДЕНЬ'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Збільшити кількість днів"
              onPress={handleIncrease}
              disabled={days >= 7}
              style={[styles.stepBtn, days >= 7 && styles.stepBtnDisabled]}
            >
              <Text style={[styles.stepBtnText, days >= 7 && styles.stepBtnTextDisabled]}>+</Text>
            </Pressable>
          </View>

          {/* Interactive Weekday Chips */}
          <Text style={styles.daysHint}>Оберіть зручні для вас дні:</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w) => {
              const isActive = selectedDays.includes(w.key);
              return (
                <Pressable
                  key={w.key}
                  accessibilityRole="button"
                  accessibilityLabel={`День ${w.label}`}
                  onPress={() => toggleDay(w.key)}
                  style={({ pressed }) => [
                    styles.dayChip,
                    isActive && styles.dayChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.dayChipText, isActive && styles.dayChipTextActive]}>
                    {w.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. Session Duration */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ЧАС НА ТРЕНУВАННЯ</Text>
          <Text style={styles.sectionSub}>ТРИВАЛІСТЬ СЕСІЇ</Text>
        </View>

        <View style={styles.durationList}>
          {DURATION_CHOICES.map((choice) => {
            const isSelected = selectedDuration === choice.minutes;
            return (
              <Pressable
                key={choice.minutes}
                accessibilityRole="button"
                accessibilityLabel={choice.title}
                onPress={() => {
                  hapticImpact();
                  setSelectedDuration(choice.minutes);
                }}
                style={[
                  styles.durationCard,
                  isSelected && styles.durationCardSelected,
                ]}
              >
                <View style={styles.durationCardHeader}>
                  <View style={styles.durationCardLeft}>
                    <View
                      style={[
                        styles.durationIconWrap,
                        isSelected && styles.durationIconWrapSelected,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={choice.icon}
                        size={22}
                        color={isSelected ? colors.primary : '#8E9BAE'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={[
                            styles.durationCardTitle,
                            isSelected && styles.durationCardTitleSelected,
                          ]}
                        >
                          {choice.title}
                        </Text>
                        {choice.badge && (
                          <View
                            style={[
                              styles.durationBadge,
                              isSelected && styles.durationBadgeActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durationBadgeText,
                                isSelected && styles.durationBadgeTextActive,
                              ]}
                            >
                              {choice.badge}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.durationCardSubtitle}>{choice.subtitle}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleSelected,
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={15} color="#0B0D0F" />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* 5. CTA Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('continue')}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && styles.continueBtnPressed,
          ]}
        >
          <Text style={styles.continueText}>{t('continue')}</Text>
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
    height: 44,
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
    fontSize: 13,
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
    paddingTop: 6,
    paddingBottom: 24,
  },
  titleSection: {
    marginTop: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionSub: {
    color: '#4B5565',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperWrap: {
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D2430',
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  stepBtnTextDisabled: {
    color: '#4B5565',
  },
  numberWrap: {
    alignItems: 'center',
    minWidth: 120,
  },
  numberValue: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -2,
    lineHeight: 70,
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
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#161B22',
    borderWidth: 1.5,
    borderColor: '#242C38',
    minWidth: 38,
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
  durationList: {
    gap: 12,
    marginBottom: 16,
  },
  durationCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1D2430',
    padding: 16,
  },
  durationCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
  },
  durationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  durationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationIconWrapSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  durationCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  durationCardTitleSelected: {
    color: '#FFFFFF',
  },
  durationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#1C2330',
  },
  durationBadgeActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.2)',
  },
  durationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 0.5,
  },
  durationBadgeTextActive: {
    color: colors.primary,
  },
  durationCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9BAE',
    lineHeight: 18,
    marginTop: 4,
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
  bottomBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
