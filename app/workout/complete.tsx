import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { getSessionSummary, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';

export default function Complete() {
  const { t, te, tw, language } = useI18n();
  const { formatVolume } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const clearSession = useWorkoutSessionStore((state) => state.clearSession);
  const [, setName] = useState(defaultOnboarding.name);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
    });
  }, []);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noCompletedWorkout')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={styles.doneBtn}
          >
            <Text style={styles.doneBtnText}>{t('backToHome')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const summary = getSessionSummary(session);
  const prs = session.personalRecords ?? [];

  const handleFinish = () => {
    hapticMedium();
    clearSession();
    router.replace('/(tabs)');
  };

  const prsHeaderTitle =
    language === 'uk'
      ? `${prs.length} ${prs.length === 1 ? 'ОСОБИСТИЙ РЕКОРД' : 'ОСОБИСТИХ РЕКОРДІВ'}`
      : `${prs.length} PERSONAL ${prs.length === 1 ? 'RECORD' : 'RECORDS'}`;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          hitSlop={12}
          onPress={handleFinish}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Celebration Hero */}
        <View style={styles.heroSection}>
          <View style={styles.confettiIconWrap}>
            <MaterialCommunityIcons name="party-popper" size={44} color="#FFD130" />
          </View>
          <Text style={styles.title}>{t('workoutComplete')}</Text>
          <Text style={styles.workoutSubtitle}>{tw(session.workoutName)}</Text>
        </View>

        {/* 3. Stats Tri-Card Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary.durationMinutes} {t('min')}</Text>
            <Text style={styles.statLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary.exerciseCount}</Text>
            <Text style={styles.statLabel}>{t('exercises')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary.completedSets}</Text>
            <Text style={styles.statLabel}>{t('sets')}</Text>
          </View>
        </View>

        {/* 4. Volume Card */}
        <View style={styles.volumeCard}>
          <Text style={styles.volumeValue}>
            {formatVolume(summary.volume)}
          </Text>
          <Text style={styles.volumeLabel}>{t('volume')}</Text>
        </View>

        {/* 5. Personal Records Card */}
        <View style={styles.prsCard}>
          <View style={styles.prHeader}>
            <MaterialCommunityIcons name="trophy" size={16} color={colors.primary} />
            <Text style={styles.prSectionTitle}>
              {prsHeaderTitle}
            </Text>
          </View>

          {prs.length === 0 ? (
            <View style={styles.noPrWrap}>
              <Text style={styles.noPrText}>
                {t('baselineSaved')}
              </Text>
            </View>
          ) : (
            prs.map((record, index) => (
              <View
                key={record.id}
                style={[styles.prRow, index < prs.length - 1 && styles.prRowBorder]}
              >
                <View style={styles.prIconWrap}>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={colors.primary} />
                </View>
                <Text numberOfLines={1} style={styles.prExerciseName}>
                  {te(record.exerciseName)}
                </Text>
                <Text style={styles.prValueText}>{record.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#6C7A8E" />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 6. Sticky Bottom Done Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={handleFinish}
          style={styles.doneBtn}
        >
          <Text style={styles.doneBtnText}>{t('done')}</Text>
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
    paddingHorizontal: 20,
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  confettiIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 209, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  workoutSubtitle: {
    color: '#8E9BAE',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  statsRow: {
    width: '100%',
    maxWidth: 350,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12161D',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  volumeCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#12161D',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  volumeValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  volumeLabel: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  prsCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 20,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  prSectionTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  noPrWrap: {
    paddingVertical: 8,
  },
  noPrText: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 19,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  prRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  prIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  prExerciseName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  prValueText: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneBtn: {
    width: '100%',
    maxWidth: 350,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
});
