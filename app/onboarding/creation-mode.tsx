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
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import {
  saveOnboarding,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';

export default function CreationMode() {
  const { t, tm, language } = useI18n();
  const [mode, setMode] = useState<'ai' | 'custom'>('ai');
  const [selectedSplit, setSelectedSplit] = useState<WorkoutSplitPreference>('upper_lower');

  const splitOptions: Array<{ key: WorkoutSplitPreference; label: string; sub: string }> = [
    {
      key: 'full_body',
      label: 'Full Body',
      sub: language === 'uk' ? 'Тренування всього тіла (1–3 дні)' : 'High recovery full-body training',
    },
    {
      key: 'upper_lower',
      label: 'Upper / Lower',
      sub: language === 'uk' ? 'Класичний збалансований спліт (3–4 дні)' : 'Balanced upper & lower split',
    },
    {
      key: 'push_pull_legs',
      label: 'Push / Pull / Legs (Спліт)',
      sub: language === 'uk' ? 'Спеціалізований спліт (3–6 днів)' : 'Synergistic muscle group focus',
    },
    {
      key: 'custom',
      label: language === 'uk' ? 'Кастом (Свій план)' : 'Custom Routine',
      sub: language === 'uk' ? 'Складіть власний розклад та оберіть свої вправи' : 'Build your own schedule and pick exercises',
    },
  ];

  const handleContinue = async () => {
    hapticMedium();
    if (mode === 'ai') {
      await saveOnboarding({ splitPreference: undefined });
    } else {
      await saveOnboarding({ splitPreference: selectedSplit });
    }
    router.push('/onboarding/experience');
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
        <Text style={styles.stepCounter}>2 / 6</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('planCreationMode')}</Text>
          <Text style={styles.subtitle}>{t('creationModeSubtitle')}</Text>
        </View>

        {/* 3. Cards */}
        <View style={styles.cardsWrap}>
          {/* Option A: AI Smart Plan */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('aiSmartPlan')}
            onPress={() => {
              hapticLight();
              setMode('ai');
            }}
            style={[
              styles.card,
              mode === 'ai' && styles.cardActive,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgeWrap}>
                <MaterialCommunityIcons name="brain" size={20} color={mode === 'ai' ? colors.primary : '#8E9BAE'} />
                <View style={[styles.badge, mode === 'ai' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, mode === 'ai' && styles.badgeTextActive]}>
                    {t('aiSmartPlanBadge')}
                  </Text>
                </View>
              </View>
              <View style={[styles.radio, mode === 'ai' && styles.radioActive]}>
                {mode === 'ai' && <View style={styles.radioInner} />}
              </View>
            </View>

            <Text style={styles.cardTitle}>{t('aiSmartPlan')}</Text>
            <Text style={styles.cardDesc}>{t('aiSmartPlanDesc')}</Text>

            <View style={styles.featuresList}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.featureText}>
                  {language === 'uk' ? 'Розрахунок робочої ваги під ваші цілі' : 'Target weights calibrated to your goal'}
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.featureText}>
                  {language === 'uk' ? 'Автоматичне прогресивне перевантаження' : 'Automatic progressive overload tracking'}
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.featureText}>
                  {language === 'uk' ? 'Адаптація під ваше тренажерне спорядження' : 'Filtered to your available gym gear'}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Option B: Custom Routine */}
          <View
            style={[
              styles.card,
              mode === 'custom' && styles.cardActive,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('customRoutineMode')}
              onPress={() => {
                hapticLight();
                setMode('custom');
              }}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeWrap}>
                  <MaterialCommunityIcons name="dumbbell" size={20} color={mode === 'custom' ? colors.primary : '#8E9BAE'} />
                  <View style={[styles.badge, mode === 'custom' && styles.badgeAthlete]}>
                    <Text style={[styles.badgeText, mode === 'custom' && styles.badgeAthleteText]}>
                      {t('customRoutineBadge')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.radio, mode === 'custom' && styles.radioActive]}>
                  {mode === 'custom' && <View style={styles.radioInner} />}
                </View>
              </View>

              <Text style={styles.cardTitle}>{t('customRoutineMode')}</Text>
              <Text style={styles.cardDesc}>{t('customRoutineDesc')}</Text>

              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>
                    {language === 'uk' ? 'Вибір структури спліту під свій графік' : 'Choose your preferred split structure'}
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>
                    {language === 'uk' ? 'Повний контроль послідовності та вправ' : 'Full freedom to customize sequence & exercises'}
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>
                    {language === 'uk' ? 'Збереження звичних схем для досвідчених атлетів' : 'Keep your existing proven routines'}
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Split Selector Sub-Panel when Custom is chosen */}
            {mode === 'custom' && (
              <View style={styles.splitSubPanel}>
                <Text style={styles.splitSubTitle}>{t('selectYourSplit')}</Text>
                <View style={styles.splitList}>
                  {splitOptions.map((opt) => {
                    const isPicked = selectedSplit === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        onPress={() => {
                          hapticLight();
                          setSelectedSplit(opt.key);
                        }}
                        style={[styles.splitItem, isPicked && styles.splitItemActive]}
                      >
                        <View style={styles.splitItemTextCol}>
                          <Text style={[styles.splitItemLabel, isPicked && styles.splitItemLabelActive]}>
                            {opt.label}
                          </Text>
                          <Text style={styles.splitItemSub}>{opt.sub}</Text>
                        </View>
                        <View style={[styles.splitRadio, isPicked && styles.splitRadioActive]}>
                          {isPicked && <View style={styles.splitRadioDot} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 4. Bottom Sticky Continue Button */}
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
    alignItems: 'flex-start',
  },
  stepCounter: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 24,
  },
  header: {
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 8,
  },
  subtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  cardsWrap: {
    gap: 16,
  },
  card: {
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: '#141A22',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
  },
  badgeText: {
    color: '#8E9BAE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  badgeTextActive: {
    color: colors.primary,
  },
  badgeAthlete: {
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
  },
  badgeAthleteText: {
    color: '#A78BFA',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#384455',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardDesc: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  featuresList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  splitSubPanel: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitSubTitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  splitList: {
    gap: 8,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0D1016',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  splitItemActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
  },
  splitItemTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  splitItemLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  splitItemLabelActive: {
    color: colors.primary,
  },
  splitItemSub: {
    color: '#8E9BAE',
    fontSize: 11,
    marginTop: 2,
  },
  splitRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#384455',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitRadioActive: {
    borderColor: colors.primary,
  },
  splitRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    letterSpacing: 0.5,
  },
});

