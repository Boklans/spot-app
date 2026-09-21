import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { loadOnboarding, saveOnboarding } from '@/store/workoutStore';

export default function ParamsSetup() {
  const { t, language } = useI18n();
  const { unitLabel, toKg, fromKg } = useWeightUnit();

  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const isUk = language === 'uk';

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
      if (data?.weightKg) setWeight(String(fromKg(data.weightKg)));
      if (data?.heightCm) setHeight(String(data.heightCm));
    });
  }, [fromKg]);

  const handleContinue = async () => {
    hapticMedium();

    const parsedWeight = parseFloat(weight.replace(',', '.'));
    const parsedHeight = parseFloat(height.replace(',', '.'));

    const weightKg = !isNaN(parsedWeight) && parsedWeight > 20 ? toKg(parsedWeight) : 75;
    const heightCm = !isNaN(parsedHeight) && parsedHeight > 100 ? parsedHeight : 178;

    await saveOnboarding({
      name: name.trim() || (isUk ? 'Атлет' : 'Athlete'),
      weightKg,
      heightCm,
    });

    router.push('/onboarding/experience');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 2/5 Progress */}
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
        <Text style={styles.stepText}>1/3</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Header */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {isUk ? 'Ваші параметри' : 'Your Details'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Ці дані потрібні для точного розрахунку навантаження та калорій.'
                : 'Helps SPOT calculate baseline working weights and progression.'}
            </Text>
          </View>

          {/* 3. Inputs Form */}
          <View style={styles.formContainer}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{isUk ? "Ваше ім'я" : 'Your Name'}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color="#717B8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={isUk ? 'Як до вас звертатися?' : 'Enter your name'}
                  placeholderTextColor="#4E5A6C"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Weight */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Вага' : 'Bodyweight'} ({unitLabel})
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="scale-outline" size={20} color="#717B8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="75"
                  placeholderTextColor="#4E5A6C"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text style={styles.unitSuffix}>{unitLabel}</Text>
              </View>
            </View>

            {/* Height */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Зріст' : 'Height'} (см / cm)
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="resize-outline" size={20} color="#717B8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="178"
                  placeholderTextColor="#4E5A6C"
                  keyboardType="number-pad"
                  value={height}
                  onChangeText={setHeight}
                />
                <Text style={styles.unitSuffix}>CM</Text>
              </View>
            </View>
          </View>

          {/* 4. Continue Button */}
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
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  stepText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  topBarPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  titleSection: {
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 20,
  },
  formContainer: {
    gap: 18,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E2530',
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    height: '100%',
  },
  unitSuffix: {
    color: '#717B8A',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  bottomBar: {
    width: '100%',
    marginTop: 'auto',
  },
  continueBtn: {
    width: '100%',
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
  continueBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
});

