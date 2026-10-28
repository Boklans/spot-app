import { Ionicons } from '@expo/vector-icons';
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
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { loadOnboarding, type OnboardingSex, saveOnboarding } from '@/store/workoutStore';

export default function ParamsSetup() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, language } = useI18n();
  const { unit, unitLabel, toKg, fromKg } = useWeightUnit();

  const nameRef = useRef<TextInputInstance>(null);
  const ageRef = useRef<TextInputInstance>(null);
  const weightRef = useRef<TextInputInstance>(null);
  const heightRef = useRef<TextInputInstance>(null);

  const isDefaultDummy = (n?: string) =>
    !n || ['IHOR', 'ATHLETE', 'АТЛЕТ'].includes(n.trim().toUpperCase());

  const initialProfile = useUserProfileStore.getState().profile;
  const [name, setName] = useState(() => (!isDefaultDummy(initialProfile.name) ? initialProfile.name : ''));
  const [age, setAge] = useState(() => String(initialProfile.age || 28));
  const [sex, setSex] = useState<OnboardingSex>(() =>
    initialProfile.sex === 'female' ? 'female' : 'male'
  );
  const [weight, setWeight] = useState(() => String(fromKg(initialProfile.weightKg || 70)));
  const [height, setHeight] = useState(() => String(initialProfile.heightCm || 172));
  const [nameError, setNameError] = useState(false);

  const isUk = language === 'uk';
  const hasHydratedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const p = useUserProfileStore.getState().profile;
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        if (p.name && !isDefaultDummy(p.name) && !name) setName(p.name);
        if (p.age && p.age > 0) setAge(String(p.age));
        if (p.sex === 'female' || p.sex === 'male') setSex(p.sex);
        if (p.weightKg && p.weightKg > 0 && !weight) setWeight(String(fromKg(p.weightKg)));
        if (p.heightCm && p.heightCm > 0 && !height) setHeight(String(p.heightCm));
        loadOnboarding().then((saved) => {
          if (!saved) return;
          if (saved.age && saved.age > 0) setAge(String(saved.age));
          if (saved.sex === 'female' || saved.sex === 'male') setSex(saved.sex);
        }).catch(() => undefined);
      }
    }, [fromKg, name, weight, height])
  );

  const isNameValid = name.trim().length >= 2;

  const handleToggleUnit = (nextUnit: 'kg' | 'lbs') => {
    if (unit === nextUnit) return;
    hapticLight();
    const parsed = parseFloat(weight.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      const currentKg = unit === 'lbs' ? parsed / 2.20462262 : parsed;
      const converted = nextUnit === 'lbs'
        ? Math.round(currentKg * 2.20462262)
        : Math.round(currentKg * 10) / 10;
      setWeight(String(converted));
    }
    useUserProfileStore.getState().updateProfile({ weightUnit: nextUnit }).catch(() => undefined);
  };

  const sexOptions: Array<{
    value: OnboardingSex;
    label: string;
    icon: 'male-outline' | 'female-outline';
  }> = [
    { value: 'male', label: isUk ? 'Чоловіча' : 'Male', icon: 'male-outline' },
    { value: 'female', label: isUk ? 'Жіноча' : 'Female', icon: 'female-outline' },
  ];

  const handleContinue = () => {
    if (!isNameValid) {
      hapticLight();
      setNameError(true);
      nameRef.current?.focus();
      return;
    }

    hapticMedium();
    setNameError(false);

    const effectiveName = name.trim().slice(0, 20);

    const parsedAge = parseInt(age.trim(), 10);
    const effectiveAge = !isNaN(parsedAge) && parsedAge >= 14 && parsedAge <= 95
      ? parsedAge
      : (initialProfile.age || 28);

    const parsedWeight = parseFloat(weight.replace(',', '.'));
    const effectiveWeightKg = !isNaN(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 300
      ? Math.round(toKg(parsedWeight) * 10) / 10
      : (initialProfile.weightKg || 70);

    const parsedHeight = parseFloat(height.replace(',', '.'));
    const effectiveHeightCm = !isNaN(parsedHeight) && parsedHeight >= 80 && parsedHeight <= 250
      ? Math.round(parsedHeight)
      : (initialProfile.heightCm || 172);

    Promise.all([
      useUserProfileStore.getState().updateProfile({
        name: effectiveName,
        age: effectiveAge,
        sex,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
      useBodyWeightStore.getState().syncBaselineWeight(effectiveWeightKg),
      saveOnboarding({
        name: effectiveName,
        age: effectiveAge,
        sex,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
    ]).catch((err) => console.warn('Non-blocking onboarding save error:', err));

    router.push('/onboarding/goal');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Unified Header with 1/5 Progress Bar */}
      <OnboardingHeader step={1} totalSteps={5} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {/* 2. Header */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {isUk ? 'Ваші параметри' : 'Your Profile'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Дані потрібні для точного підбору безпечної стартової ваги у вправах.'
                : 'Used to calibrate safe starting weights for your exercises.'}
            </Text>
          </View>

          {/* 3. Inputs Form */}
          <View style={styles.formContainer}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>{isUk ? "Ваше ім'я" : 'Your Name'}</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <Pressable
                onPress={() => nameRef.current?.focus()}
                style={[styles.inputWrap, nameError && styles.inputWrapError]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={nameError ? colors.danger : colors.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={nameRef}
                  editable={true}
                  style={styles.textInput}
                  placeholder={isUk ? 'Як до вас звертатися?' : 'Enter your name'}
                  placeholderTextColor={colors.muted}
                  maxLength={20}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (nameError && val.trim().length >= 2) {
                      setNameError(false);
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => ageRef.current?.focus()}
                />
              </Pressable>
              {nameError && (
                <Text style={styles.errorText}>
                  {isUk
                    ? "Будь ласка, введіть ваше ім'я (мінімум 2 символи)"
                    : 'Please enter your name (at least 2 characters)'}
                </Text>
              )}
            </View>

            {/* Sex Selector (Male / Female) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Стать' : 'Sex'}
              </Text>
              <View style={styles.sexRow}>
                {sexOptions.map((opt) => {
                  const isActive = sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      onPress={() => {
                        hapticLight();
                        setSex(opt.value);
                      }}
                      style={[styles.sexChip, isActive && styles.sexChipActive]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={17}
                        color={isActive ? colors.primaryText : colors.secondary}
                      />
                      <Text style={[styles.sexChipText, isActive && styles.sexChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperHint}>
                {isUk
                  ? 'Потрібно для точного розрахунку безпечної стартової ваги та адаптації програми.'
                  : 'Used to calibrate safe starting weights and tailor your training split.'}
              </Text>
            </View>

            {/* Quick Unit Switcher + Age, Weight, Height Grid */}
            <View style={styles.unitHeaderRow}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Фізичні показники' : 'Body Metrics'}
              </Text>
              <View style={styles.unitPillGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kilograms"
                  onPress={() => handleToggleUnit('kg')}
                  style={[styles.unitPill, unit === 'kg' && styles.unitPillActive]}
                >
                  <Text style={[styles.unitPillText, unit === 'kg' && styles.unitPillTextActive]}>
                    {isUk ? 'КГ' : 'KG'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pounds"
                  onPress={() => handleToggleUnit('lbs')}
                  style={[styles.unitPill, unit === 'lbs' && styles.unitPillActive]}
                >
                  <Text style={[styles.unitPillText, unit === 'lbs' && styles.unitPillTextActive]}>
                    LBS
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.metricsRow}>
              {/* Age */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Вік' : 'Age'}
                </Text>
                <Pressable
                  onPress={() => ageRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={ageRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="28"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={age}
                    onChangeText={setAge}
                    returnKeyType="next"
                    onSubmitEditing={() => weightRef.current?.focus()}
                  />
                  <Text style={styles.unitSuffix}>{isUk ? 'РОКІВ' : 'YRS'}</Text>
                </Pressable>
              </View>

              {/* Weight */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Вага' : 'Weight'}
                </Text>
                <Pressable
                  onPress={() => weightRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={weightRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="70"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                    returnKeyType="next"
                    onSubmitEditing={() => heightRef.current?.focus()}
                  />
                  <Text style={styles.unitSuffix}>{unitLabel}</Text>
                </Pressable>
              </View>

              {/* Height */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Зріст' : 'Height'}
                </Text>
                <Pressable
                  onPress={() => heightRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={heightRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="172"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={height}
                    onChangeText={setHeight}
                  />
                  <Text style={styles.unitSuffix}>{isUk ? 'СМ' : 'CM'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 4. Pinned Continue Button */}
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              !isNameValid && styles.continueBtnDisabled,
              isNameValid && pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text
              style={[
                styles.continueBtnText,
                !isNameValid && styles.continueBtnTextDisabled,
              ]}
            >
              {t('continue')}
            </Text>
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
    unitHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: -8,
    },
    unitPillGroup: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
    },
    unitPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    unitPillActive: {
      backgroundColor: colors.primaryMuted,
    },
    unitPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.muted,
    },
    unitPillTextActive: {
      color: colors.primaryText,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 6,
      paddingBottom: 16,
    },
    titleSection: {
      marginBottom: 18,
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
    formContainer: {
      gap: 18,
      marginBottom: 24,
    },
    inputGroup: {
      gap: 8,
    },
    inputLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    requiredStar: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '900',
    },
    inputLabel: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 16,
      height: 54,
    },
    inputWrapError: {
      borderColor: colors.danger,
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      marginLeft: 4,
    },
    inputIcon: {
      marginRight: 12,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      height: '100%',
    },
    unitSuffix: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      marginLeft: 6,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sexChip: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    sexChipActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    sexChipText: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: '700',
    },
    sexChipTextActive: {
      color: colors.primaryText,
      fontWeight: '800',
    },
    helperHint: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    metricCol: {
      flex: 1,
      gap: 8,
    },
    metricInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 54,
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
    continueBtnDisabled: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.7,
      shadowOpacity: 0,
      elevation: 0,
    },
    continueBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    continueBtnTextDisabled: {
      color: colors.muted,
    },
  });
