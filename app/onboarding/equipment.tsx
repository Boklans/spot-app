import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { saveOnboarding } from '@/store/workoutStore';

interface EquipmentOption {
  value: string;
  label: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  {
    value: 'full_gym',
    label: 'Full Gym',
    detail: 'Barbells, dumbbells, cables & machines',
    icon: 'weight-lifter',
  },
  {
    value: 'barbell',
    label: 'Barbell & Rack',
    detail: 'Olympic bar, squat rack & bench',
    icon: 'dumbbell',
  },
  {
    value: 'dumbbells',
    label: 'Dumbbells Only',
    detail: 'Adjustable or fixed weight pairs',
    icon: 'dumbbell',
  },
  {
    value: 'cables_machines',
    label: 'Machines & Cables',
    detail: 'Smith machine, cable crossovers, leg press',
    icon: 'cog-outline',
  },
  {
    value: 'bodyweight',
    label: 'Bodyweight & Calisthenics',
    detail: 'Pull-up bar, dip bars, resistance bands',
    icon: 'human-handsup',
  },
];

export default function Equipment() {
  const { t, language } = useI18n();
  const isUk = language === 'uk';
  const [selected, setSelected] = useState<string[]>(['full_gym']);

  const equipmentOptions: EquipmentOption[] = [
    {
      value: 'full_gym',
      label: isUk ? 'Повноцінний зал' : 'Full Gym',
      detail: isUk ? 'Штанги, гантелі, тренажери та блоки' : 'Barbells, dumbbells, cables & machines',
      icon: 'weight-lifter',
    },
    {
      value: 'barbell',
      label: isUk ? 'Штанга та стійка' : 'Barbell & Rack',
      detail: isUk ? 'Олімпійський гриф, силова рама та лава' : 'Olympic bar, squat rack & bench',
      icon: 'dumbbell',
    },
    {
      value: 'dumbbells',
      label: isUk ? 'Тільки гантелі' : 'Dumbbells Only',
      detail: isUk ? 'Набірні або фіксовані гантелі' : 'Adjustable or fixed weight pairs',
      icon: 'dumbbell',
    },
    {
      value: 'cables_machines',
      label: isUk ? 'Тренажери та блоки' : 'Machines & Cables',
      detail: isUk ? 'Машина Сміта, кросовер, жим ногами' : 'Smith machine, cable crossovers, leg press',
      icon: 'cog-outline',
    },
    {
      value: 'bodyweight',
      label: isUk ? 'Власна вага' : 'Bodyweight & Calisthenics',
      detail: isUk ? 'Турнік, бруси, гумові петлі' : 'Pull-up bar, dip bars, resistance bands',
      icon: 'human-handsup',
    },
  ];

  const toggleEquipment = (value: string) => {
    hapticImpact();
    setSelected((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleContinue = async () => {
    hapticMedium();
    await saveOnboarding({ equipment: selected });
    router.push('/onboarding/program-ready');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar */}
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
        <Text style={styles.stepText}>4/4</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t('equipmentTitle')}</Text>
          <Text style={styles.subtitle}>{t('equipmentSubtitle')}</Text>
        </View>

        {/* 3. Options List */}
        <View style={styles.optionsList}>
          {equipmentOptions.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={opt.label}
                onPress={() => toggleEquipment(opt.value)}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    isSelected && styles.iconWrapSelected,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={24}
                    color={isSelected ? colors.primary : '#8E9BAE'}
                  />
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.optionDetail}>{opt.detail}</Text>
                </View>

                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
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
      </ScrollView>

      {/* 4. Pinned CTA Button */}
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
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 6,
    lineHeight: 20,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1D2430',
    padding: 16,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
  },
  textWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
  },
  optionDetail: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 4,
    lineHeight: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#2D3748',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
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
