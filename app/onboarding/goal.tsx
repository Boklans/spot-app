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
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useUserProfileStore } from '@/store/userProfileStore';
import {
  loadOnboarding,
  type OnboardingGoal,
  type PriorityMuscleFocus,
  saveOnboarding,
} from '@/store/workoutStore';

export default function Goal() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, language } = useI18n();
  const isUk = language === 'uk';
  const [selectedGoal, setSelectedGoal] = useState<OnboardingGoal>('build_muscle');
  const [selectedFocus, setSelectedFocus] = useState<PriorityMuscleFocus>('balanced');

  useEffect(() => {
    loadOnboarding().then((saved) => {
      if (!saved) return;
      if (saved.goal) setSelectedGoal(saved.goal);
      if (saved.priorityMuscles?.[0]) setSelectedFocus(saved.priorityMuscles[0]);
    }).catch(() => undefined);
  }, []);

  const goalOptions: Array<{
    value: OnboardingGoal;
    label: string;
    detail: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    {
      value: 'build_muscle',
      label: isUk ? 'Набір мʼязової маси' : 'Build Muscle',
      detail: isUk ? 'Гіпертрофія, 8–12 повторень, оптимальний обʼєм' : 'Hypertrophy focus, 8–12 reps, progressive volume',
      icon: 'dumbbell',
    },
    {
      value: 'lose_fat',
      label: isUk ? 'Зниження ваги та тонус' : 'Lose Fat & Tone',
      detail: isUk ? 'Вища щільність, 10–15 повторень, коротший відпочинок' : 'Higher density, 10–15 reps, shorter rest intervals',
      icon: 'fire',
    },
    {
      value: 'get_stronger',
      label: isUk ? 'Розвиток сили' : 'Get Stronger',
      detail: isUk ? 'Базові вправи, 5–8 повторень, вищі робочі ваги' : 'Compound lifts, 5–8 reps, heavier working loads',
      icon: 'arm-flex',
    },
    {
      value: 'recomposition',
      label: isUk ? 'Рекомпозиція тіла' : 'Body Recomposition',
      detail: isUk ? 'Зменшення жиру зі збереженням мʼязів, 8–12 повторень' : 'Build lean muscle while losing fat, 8–12 reps',
      icon: 'scale-balance',
    },
  ];

  const focusOptions: Array<{
    value: PriorityMuscleFocus;
    label: string;
    detail: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    {
      value: 'balanced',
      label: isUk ? 'Все тіло збалансовано' : 'Balanced Full Body',
      detail: isUk ? 'Рівномірний розвиток верху та низу тіла' : 'Even volume across upper and lower body',
      icon: 'human',
    },
    {
      value: 'lower_glutes',
      label: isUk ? 'Акцент: ноги та сідниці' : 'Focus: Legs & Glutes',
      detail: isUk ? 'Більше сідничних мостів, випадів, тяг і присідань' : 'Extra volume for glutes, hamstrings and quads',
      icon: 'run-fast',
    },
    {
      value: 'upper_push',
      label: isUk ? 'Акцент: груди, плечі та руки' : 'Focus: Chest, Shoulders & Arms',
      detail: isUk ? 'Додатковий обʼєм на жими, дельти, біцепс і трицепс' : 'Extra sets for chest, delts, biceps and triceps',
      icon: 'arm-flex-outline',
    },
    {
      value: 'back_core',
      label: isUk ? 'Акцент: спина, постава та кор' : 'Focus: Back, Posture & Core',
      detail: isUk ? 'Тяги, широкі мʼязи спини, задня дельта та прес' : 'Priority on rows, lats, rear delts and core',
      icon: 'shield-check-outline',
    },
  ];

  const handleContinue = async () => {
    hapticMedium();
    const profileGoal =
      selectedGoal === 'get_stronger'
        ? 'Get Stronger'
        : selectedGoal === 'lose_fat'
          ? 'Lose Fat'
          : 'Build Muscle';

    await Promise.all([
      useUserProfileStore.getState().updateProfile({ goal: profileGoal }),
      saveOnboarding({
        goal: selectedGoal,
        priorityMuscles: [selectedFocus],
      }),
    ]);

    router.push('/onboarding/experience');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Unified Top Bar with 2/5 Progress */}
      <OnboardingHeader step={2} totalSteps={5} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            {isUk ? 'Ціль та акцент' : 'Goal & Muscle Focus'}
          </Text>
          <Text style={styles.subtitle}>
            {isUk
              ? 'Оберіть головну мету та на які мʼязи зробити акцент у програмі.'
              : 'Choose your primary goal and which muscle groups to prioritize.'}
          </Text>
        </View>

        {/* 3. Primary Goal List */}
        <Text style={styles.sectionLabel}>
          {isUk ? 'ГОЛОВНА ЦІЛЬ' : 'PRIMARY GOAL'}
        </Text>
        <View style={styles.optionsList}>
          {goalOptions.map((opt) => {
            const isSelected = selectedGoal === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                onPress={() => {
                  hapticLight();
                  setSelectedGoal(opt.value);
                }}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
              >
                <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={22}
                    color={isSelected ? colors.primaryText : colors.secondary}
                  />
                </View>

                <View style={styles.textWrap}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionDetail}>{opt.detail}</Text>
                </View>

                <View
                  style={[
                    styles.checkCircle,
                    isSelected && styles.checkCircleSelected,
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 4. Priority Muscle Focus List */}
        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
          {isUk ? 'АКЦЕНТ НА ГРУПИ МʼЯЗІВ' : 'MUSCLE GROUP PRIORITY'}
        </Text>
        <View style={styles.optionsList}>
          {focusOptions.map((opt) => {
            const isSelected = selectedFocus === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                onPress={() => {
                  hapticLight();
                  setSelectedFocus(opt.value);
                }}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
              >
                <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={22}
                    color={isSelected ? colors.primaryText : colors.secondary}
                  />
                </View>

                <View style={styles.textWrap}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionDetail}>{opt.detail}</Text>
                </View>

                <View
                  style={[
                    styles.checkCircle,
                    isSelected && styles.checkCircleSelected,
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* 5. Bottom Continue Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={handleContinue}
          style={styles.continueBtn}
        >
          <Text style={styles.continueBtnText}>{t('continue')}</Text>
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
      justifyContent: 'center',
    },
    stepText: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: '700',
    },
    topBarPlaceholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 6,
      paddingBottom: 28,
    },
    titleSection: {
      marginBottom: 16,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 6,
      lineHeight: 20,
    },
    sectionLabel: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.1,
      marginBottom: 10,
    },
    optionsList: {
      gap: 10,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    optionCardSelected: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },
    iconWrapSelected: {
      backgroundColor: colors.primaryMuted,
    },
    textWrap: {
      flex: 1,
      paddingRight: 8,
    },
    optionLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    optionDetail: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
      lineHeight: 17,
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
      borderColor: colors.accentLine,
      backgroundColor: colors.primary,
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
      width: '100%',
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.isDark ? colors.primary : '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.35 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    continueBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
  });
