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
  titleUk: string;
  titleEn: string;
  subtitleUk: string;
  subtitleEn: string;
  badgeUk?: string;
  badgeEn?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const DURATION_CHOICES: DurationChoice[] = [
  {
    minutes: 30,
    titleUk: '30 хв · Швидке',
    titleEn: '30 min · Express',
    subtitleUk: 'Коротке й інтенсивне тренування без зайвого відпочинку (~4 вправи)',
    subtitleEn: 'Short & intense session without long rest periods (~4 exercises)',
    badgeUk: 'EXPRESS',
    badgeEn: 'EXPRESS',
    icon: 'lightning-bolt',
  },
  {
    minutes: 45,
    titleUk: '45 хв · Оптимальне',
    titleEn: '45 min · Optimal',
    subtitleUk: 'Ідеальний баланс сили, обʼєму та відновлення (~5–6 вправ)',
    subtitleEn: 'Perfect balance of strength, volume and recovery (~5–6 exercises)',
    badgeUk: 'РЕКОМЕНДОВАНО',
    badgeEn: 'RECOMMENDED',
    icon: 'timer-sand',
  },
  {
    minutes: 60,
    titleUk: '60 хв · Повне',
    titleEn: '60 min · Power',
    subtitleUk: 'Глибоке опрацювання цільових мʼязів та повний відпочинок (~6–7 вправ)',
    subtitleEn: 'Deep muscle stimulation and full rest intervals (~6–7 exercises)',
    badgeUk: 'POWER',
    badgeEn: 'POWER',
    icon: 'weight-lifter',
  },
];

const WEEKDAYS = [
  { key: 'MON', labelUk: 'ПН', labelEn: 'Mon' },
  { key: 'TUE', labelUk: 'ВТ', labelEn: 'Tue' },
  { key: 'WED', labelUk: 'СР', labelEn: 'Wed' },
  { key: 'THU', labelUk: 'ЧТ', labelEn: 'Thu' },
  { key: 'FRI', labelUk: 'ПТ', labelEn: 'Fri' },
  { key: 'SAT', labelUk: 'СБ', labelEn: 'Sat' },
  { key: 'SUN', labelUk: 'НД', labelEn: 'Sun' },
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
  const { t, language } = useI18n();
  const isUk = language === 'uk';
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
          <Text style={styles.title}>{isUk ? 'Графік і час' : 'Schedule & Duration'}</Text>
          <Text style={styles.subtitle}>
            {isUk
              ? 'Скільки днів та скільки часу на тренування вам зручно приділяти?'
              : 'How many days and how much time would you like to dedicate to training?'}
          </Text>
        </View>

        {/* 3. Days Stepper */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{isUk ? 'ДНІ НА ТИЖДЕНЬ' : 'DAYS PER WEEK'}</Text>
          <Text style={styles.sectionSub}>
            {isUk
              ? days === 1 ? '1 ДЕНЬ' : days < 5 ? `${days} ДНІ` : `${days} ДНІВ`
              : days === 1 ? '1 DAY' : `${days} DAYS`}
          </Text>
        </View>

        <View style={styles.stepperWrap}>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUk ? 'Зменшити кількість днів' : 'Decrease days'}
              onPress={handleDecrease}
              disabled={days <= 1}
              style={[styles.stepBtn, days <= 1 && styles.stepBtnDisabled]}
            >
              <Text style={[styles.stepBtnText, days <= 1 && styles.stepBtnTextDisabled]}>−</Text>
            </Pressable>

            <View style={styles.numberWrap}>
              <Text style={styles.numberValue}>{days}</Text>
              <Text style={styles.numberUnit}>
                {isUk
                  ? days === 1 ? 'ДЕНЬ / ТИЖДЕНЬ' : days < 5 ? 'ДНІ / ТИЖДЕНЬ' : 'ДНІВ / ТИЖДЕНЬ'
                  : days === 1 ? 'DAY / WEEK' : 'DAYS / WEEK'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUk ? 'Збільшити кількість днів' : 'Increase days'}
              onPress={handleIncrease}
              disabled={days >= 7}
              style={[styles.stepBtn, days >= 7 && styles.stepBtnDisabled]}
            >
              <Text style={[styles.stepBtnText, days >= 7 && styles.stepBtnTextDisabled]}>+</Text>
            </Pressable>
          </View>

          {/* Interactive Weekday Chips */}
          <Text style={styles.daysHint}>
            {isUk ? 'Оберіть зручні для вас дні:' : 'Select your preferred workout days:'}
          </Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w) => {
              const isActive = selectedDays.includes(w.key);
              const label = isUk ? w.labelUk : w.labelEn;
              return (
                <Pressable
                  key={w.key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => toggleDay(w.key)}
                  style={({ pressed }) => [
                    styles.dayChip,
                    isActive && styles.dayChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.dayChipText, isActive && styles.dayChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. Session Duration */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{isUk ? 'ЧАС НА ТРЕНУВАННЯ' : 'SESSION DURATION'}</Text>
          <Text style={styles.sectionSub}>{isUk ? 'ТРИВАЛІСТЬ СЕСІЇ' : 'TIME PER WORKOUT'}</Text>
        </View>

        <View style={styles.durationList}>
          {DURATION_CHOICES.map((choice) => {
            const isSelected = selectedDuration === choice.minutes;
            const title = isUk ? choice.titleUk : choice.titleEn;
            const subtitle = isUk ? choice.subtitleUk : choice.subtitleEn;
            const badge = isUk ? choice.badgeUk : choice.badgeEn;
            return (
              <Pressable
                key={choice.minutes}
                accessibilityRole="button"
                accessibilityLabel={title}
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
                          {title}
                        </Text>
                        {badge && (
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
                              {badge}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.durationCardSubtitle}>{subtitle}</Text>
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
