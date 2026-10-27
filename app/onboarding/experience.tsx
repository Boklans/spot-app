import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { useUserProfileStore } from '@/store/userProfileStore';
import {
  loadOnboarding,
  type OnboardingExperience,
  saveOnboarding,
  type TrainingLimitation,
} from '@/store/workoutStore';

export default function Experience() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, language } = useI18n();
  const { unitLabel, toKg, fromKg } = useWeightUnit();

  const benchRef = useRef<TextInputInstance>(null);
  const squatRef = useRef<TextInputInstance>(null);
  const deadliftRef = useRef<TextInputInstance>(null);
  const ohpRef = useRef<TextInputInstance>(null);

  const initialProfile = useUserProfileStore.getState().profile;
  const [selected, setSelected] = useState<OnboardingExperience>(() => {
    if (initialProfile.experience === 'Beginner') return 'beginner';
    if (initialProfile.experience === 'Advanced') return 'advanced';
    return 'intermediate';
  });
  const [limitations, setLimitations] = useState<TrainingLimitation[]>([]);

  const [benchText, setBenchText] = useState(() => {
    const b = initialProfile.baselineLifts?.benchPressKg;
    return typeof b === 'number' && b > 0 ? String(fromKg(b)) : '';
  });
  const [squatText, setSquatText] = useState(() => {
    const s = initialProfile.baselineLifts?.squatKg;
    return typeof s === 'number' && s > 0 ? String(fromKg(s)) : '';
  });
  const [deadliftText, setDeadliftText] = useState(() => {
    const d = initialProfile.baselineLifts?.deadliftKg;
    return typeof d === 'number' && d > 0 ? String(fromKg(d)) : '';
  });
  const [ohpText, setOhpText] = useState(() => {
    const o = initialProfile.baselineLifts?.overheadPressKg;
    return typeof o === 'number' && o > 0 ? String(fromKg(o)) : '';
  });

  const isUk = language === 'uk';
  const hasHydratedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const p = useUserProfileStore.getState().profile;
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        if (p.experience) {
          setSelected(p.experience === 'Beginner' ? 'beginner' : p.experience === 'Advanced' ? 'advanced' : 'intermediate');
        }
        if (p.baselineLifts) {
          const { benchPressKg, squatKg, deadliftKg, overheadPressKg } = p.baselineLifts;
          if (typeof benchPressKg === 'number' && benchPressKg > 0 && !benchText) setBenchText(String(fromKg(benchPressKg)));
          if (typeof squatKg === 'number' && squatKg > 0 && !squatText) setSquatText(String(fromKg(squatKg)));
          if (typeof deadliftKg === 'number' && deadliftKg > 0 && !deadliftText) setDeadliftText(String(fromKg(deadliftKg)));
          if (typeof overheadPressKg === 'number' && overheadPressKg > 0 && !ohpText) setOhpText(String(fromKg(overheadPressKg)));
        }
        loadOnboarding().then((saved) => {
          if (!saved) return;
          if (saved.experience) setSelected(saved.experience);
          if (saved.limitations) setLimitations(saved.limitations);
        }).catch(() => undefined);
      }
    }, [fromKg, benchText, squatText, deadliftText, ohpText])
  );

  const experienceOptions: Array<{
    value: OnboardingExperience;
    label: string;
    detail: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    {
      value: 'beginner',
      label: isUk ? 'Новачок' : 'Beginner',
      detail: isUk ? 'Починаю з нуля або повертаюсь після перерви' : 'Starting fresh or returning after a break',
      icon: 'account-outline',
    },
    {
      value: 'intermediate',
      label: isUk ? 'Середній рівень' : 'Intermediate',
      detail: isUk ? 'Регулярно тренуюсь від 6 місяців, знаю техніку' : 'Train consistently for 6+ months, know my working weights',
      icon: 'weight-lifter',
    },
    {
      value: 'advanced',
      label: isUk ? 'Досвідчений атлет' : 'Advanced',
      detail: isUk ? 'Понад 2 роки системних силових тренувань' : '2+ years of structured strength training',
      icon: 'trophy-outline',
    },
  ];

  const limitationOptions: Array<{
    value: TrainingLimitation;
    label: string;
    detail: string;
  }> = [
    {
      value: 'knees',
      label: isUk ? 'Берегти коліна' : 'Protect Knees',
      detail: isUk ? 'Без глибоких випадів у русі' : 'Avoid high-shear lunges',
    },
    {
      value: 'lower_back',
      label: isUk ? 'Берегти поперек' : 'Protect Lower Back',
      detail: isUk ? 'Без станової та осьових тяг' : 'Avoid heavy axial spinal loading',
    },
    {
      value: 'shoulders',
      label: isUk ? 'Берегти плечі' : 'Protect Shoulders',
      detail: isUk ? 'Щадні кути жимів' : 'Joint-friendly pressing angles',
    },
  ];

  const toggleLimitation = (item: TrainingLimitation) => {
    hapticLight();
    setLimitations((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleContinue = async () => {
    hapticMedium();

    const parseVal = (str: string) => {
      const num = parseFloat(str.replace(',', '.'));
      return !isNaN(num) && num > 0 ? toKg(num) : undefined;
    };

    const bKg = parseVal(benchText);
    const sKg = parseVal(squatText);
    const dKg = parseVal(deadliftText);
    const oKg = parseVal(ohpText);

    const hasBaseline = bKg !== undefined || sKg !== undefined || dKg !== undefined || oKg !== undefined;

    const baselineLifts =
      selected !== 'beginner' && hasBaseline
        ? {
            benchPressKg: bKg,
            squatKg: sKg,
            deadliftKg: dKg,
            overheadPressKg: oKg,
          }
        : undefined;

    const expEnum =
      selected === 'beginner' ? 'Beginner' : selected === 'advanced' ? 'Advanced' : 'Intermediate';

    await useUserProfileStore.getState().updateProfile({
      experience: expEnum,
      baselineLifts,
    });

    await saveOnboarding({
      experience: selected,
      limitations,
      baselineLifts,
    });

    router.push('/onboarding/equipment');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Unified Top Bar with 3/5 Progress */}
      <OnboardingHeader step={3} totalSteps={5} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled={true}
        >
          {/* 2. Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {isUk ? 'Досвід та безпека' : 'Experience & Joint Safety'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Новачкам підбираємо безпечну базу та помірні ваги, досвідченим — робочі навантаження.'
                : 'Beginners get joint-friendly loads; experienced lifters get calibrated working weights.'}
            </Text>
          </View>

          {/* 3. Experience Options List */}
          <Text style={styles.sectionLabel}>
            {isUk ? 'РІВЕНЬ ПІДГОТОВКИ' : 'TRAINING EXPERIENCE'}
          </Text>
          <View style={styles.optionsList}>
            {experienceOptions.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  onPress={() => {
                    hapticLight();
                    setSelected(opt.value);
                  }}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  <View style={styles.iconWrap}>
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

          {/* 4. Optional Joint Limitations */}
          <Text style={styles.sectionLabel}>
            {isUk ? 'ЧУТЛИВІ СУГЛОБИ (НЕОБОВʼЯЗКОВО)' : 'JOINT SENSITIVITIES (OPTIONAL)'}
          </Text>
          <View style={styles.limitationsWrap}>
            {limitationOptions.map((lim) => {
              const isChecked = limitations.includes(lim.value);
              return (
                <Pressable
                  key={lim.value}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={lim.label}
                  onPress={() => toggleLimitation(lim.value)}
                  style={[styles.limitationChip, isChecked && styles.limitationChipActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.limitationTitle, isChecked && styles.limitationTitleActive]}>
                      {lim.label}
                    </Text>
                    <Text style={styles.limitationSub}>{lim.detail}</Text>
                  </View>
                  <View style={[styles.limitationCheck, isChecked && styles.limitationCheckActive]}>
                    {isChecked && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 5. Baseline Strength Calibration Card */}
          {selected !== 'beginner' && (
            <View style={styles.baselineCard}>
              <View style={styles.baselineHeaderRow}>
                <Ionicons name="barbell-outline" size={18} color={colors.primaryText} />
                <Text style={styles.baselineTitle}>
                  {isUk ? 'Ваші робочі ваги (необовʼязково)' : 'Baseline Working Weights (Optional)'}
                </Text>
              </View>
              <Text style={styles.baselineSubtitle}>
                {isUk
                  ? `Введіть робочу вагу в ${unitLabel} (на 6–10 повторень) для вправ, які знаєте.`
                  : `Enter your working weight in ${unitLabel} (for 6–10 reps) for lifts you know.`}
              </Text>

              <View style={styles.liftsGrid}>
                {/* Bench Press */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Жим лежачи' : 'Bench Press'}
                  </Text>
                  <Pressable
                    onPress={() => benchRef.current?.focus()}
                    style={styles.inputWrap}
                  >
                    <TextInput
                      ref={benchRef}
                      editable={true}
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '135' : '60'}
                      placeholderTextColor={colors.muted}
                      value={benchText}
                      onChangeText={setBenchText}
                      returnKeyType="next"
                      onSubmitEditing={() => squatRef.current?.focus()}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </Pressable>
                </View>

                {/* Squat */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Присідання' : 'Squat'}
                  </Text>
                  <Pressable
                    onPress={() => squatRef.current?.focus()}
                    style={styles.inputWrap}
                  >
                    <TextInput
                      ref={squatRef}
                      editable={true}
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '185' : '80'}
                      placeholderTextColor={colors.muted}
                      value={squatText}
                      onChangeText={setSquatText}
                      returnKeyType="next"
                      onSubmitEditing={() => deadliftRef.current?.focus()}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </Pressable>
                </View>

                {/* Deadlift */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Станова тяга' : 'Deadlift'}
                  </Text>
                  <Pressable
                    onPress={() => deadliftRef.current?.focus()}
                    style={styles.inputWrap}
                  >
                    <TextInput
                      ref={deadliftRef}
                      editable={true}
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '225' : '100'}
                      placeholderTextColor={colors.muted}
                      value={deadliftText}
                      onChangeText={setDeadliftText}
                      returnKeyType="next"
                      onSubmitEditing={() => ohpRef.current?.focus()}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </Pressable>
                </View>

                {/* Overhead Press */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Жим стоячи' : 'Overhead Press'}
                  </Text>
                  <Pressable
                    onPress={() => ohpRef.current?.focus()}
                    style={styles.inputWrap}
                  >
                    <TextInput
                      ref={ohpRef}
                      editable={true}
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '95' : '40'}
                      placeholderTextColor={colors.muted}
                      value={ohpText}
                      onChangeText={setOhpText}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 6. Pinned Bottom Continue Button */}
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
      </KeyboardAvoidingView>
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
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      paddingTop: 6,
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
      marginBottom: 22,
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
    limitationsWrap: {
      gap: 8,
      marginBottom: 22,
    },
    limitationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 15,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    limitationChipActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    limitationTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    limitationTitleActive: {
      color: colors.text,
    },
    limitationSub: {
      color: colors.secondary,
      fontSize: 12,
      marginTop: 2,
    },
    limitationCheck: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    limitationCheckActive: {
      backgroundColor: colors.primary,
      borderColor: colors.accentLine,
    },
    baselineCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 24,
    },
    baselineHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    baselineTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    baselineSubtitle: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 16,
    },
    liftsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    liftInputCol: {
      width: '47%',
    },
    liftLabel: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 46,
    },
    liftInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      height: '100%',
    },
    inputUnit: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      marginLeft: 4,
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
