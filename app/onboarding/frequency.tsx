import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticImpact, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useUserProfileStore } from '@/store/userProfileStore';
import {
  loadOnboarding,
  saveOnboarding,
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      if (selectedDays.length <= 1) return;
      setSelectedDays(selectedDays.filter((d) => d !== dayKey));
    } else {
      if (selectedDays.length >= 7) return;
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
    await Promise.all([
      useUserProfileStore.getState().updateProfile({
        workoutsPerWeek: days,
      }),
      saveOnboarding({
        trainingFrequency: days,
        trainingDays: selectedDays,
        sessionDurationMinutes: selectedDuration,
        splitPreference: undefined,
      }),
    ]);
    router.push('/onboarding/program-ready');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Unified Top Bar with 5/5 Progress */}
      <OnboardingHeader step={5} totalSteps={5} />

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
                        color={isSelected ? colors.primaryText : colors.secondary}
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
                    {isSelected && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: colors.surface,
      borderWidth: colors.isDark ? 0 : 1,
      borderColor: colors.border,
    },
    stepText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.secondary,
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
      color: colors.text,
      letterSpacing: -0.5,
      lineHeight: 34,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.secondary,
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
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    sectionSub: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    stepperWrap: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.elevated,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnDisabled: {
      opacity: 0.3,
    },
    stepBtnText: {
      fontSize: 28,
      fontWeight: '300',
      color: colors.text,
      lineHeight: 32,
    },
    stepBtnTextDisabled: {
      color: colors.muted,
    },
    numberWrap: {
      alignItems: 'center',
      minWidth: 120,
    },
    numberValue: {
      fontSize: 64,
      fontWeight: '900',
      color: colors.primaryText,
      letterSpacing: -2,
      lineHeight: 70,
    },
    numberUnit: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.secondary,
      letterSpacing: 1.5,
      marginTop: 2,
    },
    daysHint: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.secondary,
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
      backgroundColor: colors.elevated,
      borderWidth: 1.5,
      borderColor: colors.border,
      minWidth: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.accentLine,
    },
    dayChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    dayChipTextActive: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    durationList: {
      gap: 12,
      marginBottom: 16,
    },
    durationCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 16,
    },
    durationCardSelected: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
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
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durationIconWrapSelected: {
      backgroundColor: colors.primaryMuted,
    },
    durationCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    durationCardTitleSelected: {
      color: colors.text,
    },
    durationBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.elevated,
    },
    durationBadgeActive: {
      backgroundColor: colors.primaryMuted,
    },
    durationBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.secondary,
      letterSpacing: 0.5,
    },
    durationBadgeTextActive: {
      color: colors.primaryText,
    },
    durationCardSubtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.secondary,
      lineHeight: 18,
      marginTop: 4,
    },
    checkCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.accentLine,
    },
    bottomBar: {
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 20 : 24,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    continueBtn: {
      backgroundColor: colors.primary,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.isDark ? colors.primary : '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.35 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    continueBtnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    continueText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
  });
