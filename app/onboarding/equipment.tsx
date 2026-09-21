import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact, hapticMedium } from '@/lib/haptics';
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
  const [selected, setSelected] = useState<string[]>(['full_gym']);

  const toggleEquipment = (value: string) => {
    hapticImpact();
    setSelected((prev) => {
      if (prev.includes(value)) {
        // Keep at least one selected
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
      {/* 1. Top Bar with 5/5 Progress */}
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
        <Text style={styles.stepText}>5/5</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* 2. Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Доступне спорядження</Text>
          <Text style={styles.subtitle}>Оберіть усе, що є у вашому розпорядженні.</Text>
        </View>

        {/* 3. Options List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {EQUIPMENT_OPTIONS.map((opt) => {
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
        </ScrollView>

        {/* 4. Pinned CTA Button */}
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Build my plan"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              pressed && styles.continueBtnPressed,
            ]}
          >
            <Text style={styles.continueText}>Build My Plan</Text>
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
    paddingTop: 12,
    paddingBottom: 8,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#8E9BAE',
    letterSpacing: 0.5,
  },
  topBarPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  titleSection: {
    marginTop: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 8,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 16,
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
    fontSize: 17,
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
    paddingBottom: 24,
    paddingTop: 12,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  continueBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  continueText: {
    color: '#0B0D0F',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
