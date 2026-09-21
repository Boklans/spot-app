import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { type OnboardingGoal, saveOnboarding } from '@/store/workoutStore';

export default function Goal() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<OnboardingGoal>('build_muscle');

  const goalOptions: Array<{
    value: OnboardingGoal;
    label: string;
    detail: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    {
      value: 'build_muscle',
      label: t('buildMuscle'),
      detail: t('buildMuscleDetail'),
      icon: 'dumbbell',
    },
    {
      value: 'get_stronger',
      label: t('getStronger'),
      detail: t('getStrongerDetail'),
      icon: 'arm-flex',
    },
    {
      value: 'lose_fat',
      label: t('loseFat'),
      detail: t('loseFatDetail'),
      icon: 'fire',
    },
  ];

  const handleContinue = async () => {
    hapticMedium();
    await saveOnboarding({ goal: selected });
    router.push('/onboarding/creation-mode');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with Progress */}
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
        <Text style={styles.stepText}>1/6</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t('whatsYourGoal')}</Text>
          <Text style={styles.subtitle}>
            {t('goalSubtitle')}
          </Text>
        </View>

        {/* 3. Options List */}
        <View style={styles.optionsList}>
          {goalOptions.map((opt) => {
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
                    size={24}
                    color={isSelected ? colors.primary : '#8E9BAE'}
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
                    <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4. Bottom Continue Button */}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 24,
  },
  titleSection: {
    marginBottom: 16,
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
  optionsList: {
    gap: 12,
    flex: 1,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.04)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#181E27',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  optionDetail: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
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
