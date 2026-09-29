import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { getSessionSummary, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';

// Temporary feature flag: hide Instagram Stories sharing
const SHOW_INSTAGRAM_STORIES = false;

export default function Complete() {
  const { t, te, tw, language } = useI18n();
  const { formatVolume } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const clearSession = useWorkoutSessionStore((state) => state.clearSession);
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const [, setName] = useState(defaultOnboarding.name);
  const [isStoriesModalVisible, setIsStoriesModalVisible] = useState(false);

  useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.name) setName(data.name);
    });
    loadHistory();
  }, [loadHistory]);

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

  // Find previous session of the same workout (excluding current session)
  const previousWorkout = workouts.find(
    (w) =>
      w.id !== session.id &&
      (w.programWorkoutId === session.programWorkoutId ||
        w.workoutName.trim().toLowerCase() === session.workoutName.trim().toLowerCase())
  );

  const prevVolume = previousWorkout?.totalVolume ?? 0;
  const currentVolume = summary.volume;
  const hasPreviousSession = Boolean(previousWorkout);
  const volumeDelta = hasPreviousSession ? currentVolume - prevVolume : 0;
  const volumePercent =
    hasPreviousSession && prevVolume > 0
      ? Math.round(((volumeDelta / prevVolume) * 100) * 10) / 10
      : 0;

  const handleFinish = () => {
    hapticMedium();
    clearSession();
    router.replace('/(tabs)');
  };

  const workoutDateFormatted = new Date(
    session?.completedAt || session?.startedAt || Date.now()
  ).toLocaleDateString(
    language === 'uk' ? 'uk-UA' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  ).toUpperCase();

  const handleNativeShare = async () => {
    hapticMedium();
    try {
      const prsText = prs.length > 0
        ? `\n🏆 ${language === 'uk' ? 'Нові рекорди' : 'New PRs'}:\n` + prs.map((p) => `• ${te(p.exerciseName)}: ${p.label}`).join('\n')
        : '';

      const surgeShareText = hasPreviousSession && volumeDelta > 0
        ? `\n📈 ${language === 'uk' ? 'Прогрес об\'єму' : 'Volume surge'}: +${formatVolume(volumeDelta)} (+${volumePercent}%)`
        : '';

      const message = language === 'uk'
        ? `🔥 Щойно завершив тренування "${tw(session.workoutName)}" у SPOT!\n\n` +
          `⏱️ Тривалість: ${summary.durationMinutes} хв\n` +
          `🏋️ Тоннаж: ${formatVolume(summary.volume)}${surgeShareText}\n` +
          `📊 Підходів: ${summary.completedSets}${prsText}\n\n` +
          `Тренуйся розумніше зі SPOT 💪`
        : `🔥 Just crushed "${tw(session.workoutName)}" on SPOT!\n\n` +
          `⏱️ Duration: ${summary.durationMinutes} min\n` +
          `🏋️ Volume: ${formatVolume(summary.volume)}${surgeShareText}\n` +
          `📊 Sets: ${summary.completedSets}${prsText}\n\n` +
          `Train smarter with SPOT 💪`;

      await Share.share({
        title: 'SPOT Workout Summary',
        message,
      });
    } catch {
      // Fail gracefully
    }
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share workout story"
          hitSlop={12}
          onPress={() => {
            hapticLight();
            setIsStoriesModalVisible(true);
          }}
          style={styles.topShareBtn}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.primary} />
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

        {/* 4. Volume Card with Progression Delta */}
        <View style={styles.volumeCard}>
          <View style={styles.volumeValueRow}>
            <Text style={styles.volumeValue}>
              {formatVolume(summary.volume)}
            </Text>
            {hasPreviousSession && volumeDelta > 0 ? (
              <View style={styles.volumeSurgeBadge}>
                <Ionicons name="trending-up" size={13} color="#0B0D0F" />
                <Text style={styles.volumeSurgeBadgeText}>
                  +{formatVolume(volumeDelta)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.volumeLabel}>{t('volume')}</Text>

          {/* Volume Comparison Sub-Banner */}
          {hasPreviousSession ? (
            <View style={styles.volumeComparisonRow}>
              <Ionicons
                name={volumeDelta > 0 ? 'flame' : volumeDelta < 0 ? 'shield-checkmark-outline' : 'checkmark-circle-outline'}
                size={14}
                color={volumeDelta > 0 ? colors.primary : volumeDelta < 0 ? '#8E99A8' : colors.primary}
              />
              <Text style={styles.volumeComparisonText}>
                {volumeDelta > 0
                  ? (language === 'uk'
                    ? `+${volumePercent}% навантаження порівняно з минулим "${tw(previousWorkout?.workoutName || '')}"`
                    : `+${volumePercent}% volume vs previous "${tw(previousWorkout?.workoutName || '')}"`)
                  : volumeDelta === 0
                  ? (language === 'uk'
                    ? `Тоннаж відповідає минулому тренуванню`
                    : `Volume matched previous workout`)
                  : (language === 'uk'
                    ? `${volumePercent}% тоннажу (відновлювальне навантаження)`
                    : `${volumePercent}% volume (recovery session)`)}
              </Text>
            </View>
          ) : (
            <View style={styles.volumeComparisonRow}>
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.volumeComparisonText}>
                {language === 'uk'
                  ? 'Базовий тоннаж зафіксовано для відстеження прогресу'
                  : 'Baseline volume recorded for progressive overload tracking'}
              </Text>
            </View>
          )}
        </View>

        {/* 5. Personal Records / Baseline Card */}
        <View style={styles.prsCard}>
          <View style={styles.prHeader}>
            <MaterialCommunityIcons
              name={prs.length === 0 ? 'flag-variant' : 'trophy'}
              size={16}
              color={prs.length === 0 ? colors.primary : '#FFD130'}
            />
            <Text style={[styles.prSectionTitle, prs.length === 0 && { color: colors.primary }]}>
              {prs.length === 0
                ? (language === 'uk' ? 'БАЗУ ЗАФІКСОВАНО' : 'BASELINE ESTABLISHED')
                : prsHeaderTitle}
            </Text>
          </View>

          {prs.length === 0 ? (
            <View style={styles.noPrWrap}>
              <Text style={styles.noPrText}>
                {language === 'uk'
                  ? 'Показники тренування зафіксовано як вашу базу. Прогрес та нові рекорди почнуть відстежуватися вже з наступних сесій!'
                  : 'Workout metrics saved as your baseline. Progressive overload and new PRs will be tracked from your next workouts!'}
              </Text>
            </View>
          ) : (
            prs.map((record, index) => (
              <View
                key={record.id}
                style={[styles.prRow, index < prs.length - 1 && styles.prRowBorder]}
              >
                <View style={styles.prThumbWrap}>
                  <Image
                    source={getExerciseImage(record.exerciseName)}
                    style={styles.prThumb}
                    resizeMode="cover"
                  />
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

        {/* 6. Share to Instagram Stories Banner */}
        {SHOW_INSTAGRAM_STORIES && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share to Instagram Stories"
            onPress={() => {
              hapticMedium();
              setIsStoriesModalVisible(true);
            }}
            style={({ pressed }) => [styles.storyBanner, pressed && styles.storyBannerPressed]}
          >
            <View style={styles.storyBannerLeft}>
              <View style={styles.storyIconWrap}>
                <Ionicons name="sparkles" size={20} color="#0B0D0F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storyBannerTitle}>
                  {language === 'uk' ? 'Поділитися в Stories' : 'Share to Instagram Stories'}
                </Text>
                <Text style={styles.storyBannerSubtitle}>
                  {language === 'uk'
                    ? 'Стильна картка з вашим тоннажем і рекордами'
                    : 'Aesthetic story card with volume & PRs'}
                </Text>
              </View>
            </View>
            <View style={styles.storyBannerBadge}>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}
      </ScrollView>

      {/* 7. Sticky Bottom Done Button */}
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

      {/* 8. Instagram Stories 9:16 Preview Modal */}
      <Modal
        visible={SHOW_INSTAGRAM_STORIES && isStoriesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsStoriesModalVisible(false)}
      >
        <SafeAreaView style={styles.storiesModalOverlay}>
          {/* Modal Header */}
          <View style={styles.storiesModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="logo-instagram" size={18} color="#E1306C" />
              <Text style={styles.storiesModalHeaderTitle}>
                {language === 'uk' ? 'INSTAGRAM STORY' : 'INSTAGRAM STORY'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={() => setIsStoriesModalVisible(false)}
              style={styles.storiesCloseBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* 9:16 Story Card View */}
          <ScrollView
            contentContainerStyle={styles.storyCardScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.storyCard}>
              {/* Brand Header */}
              <View style={styles.storyBrandRow}>
                <View style={styles.storyBrandLeft}>
                  <Text style={styles.storyBrandName}>SPOT</Text>
                  <View style={styles.storyBrandDot} />
                  <Text style={styles.storyBrandSub}>ATHLETICS</Text>
                </View>
                <Text style={styles.storyDateText}>{workoutDateFormatted}</Text>
              </View>

              {/* Workout Name Banner */}
              <View style={styles.storyWorkoutTag}>
                <Ionicons name="flash" size={13} color="#0B0D0F" style={{ marginRight: 5 }} />
                <Text numberOfLines={1} style={styles.storyWorkoutTagText}>
                  {tw(session.workoutName).toUpperCase()}
                </Text>
              </View>

              {/* Main Volume Stat */}
              <View style={styles.storyHeroStat}>
                <Text style={styles.storyHeroVolumeNum}>
                  {formatVolume(summary.volume)}
                </Text>
                <Text style={styles.storyHeroVolumeLabel}>
                  {language === 'uk' ? 'ЗАГАЛЬНИЙ ТОННАЖ' : 'TOTAL VOLUME'}
                </Text>
                {hasPreviousSession && volumeDelta > 0 ? (
                  <View style={styles.storySurgePill}>
                    <Ionicons name="trending-up" size={12} color="#0B0D0F" style={{ marginRight: 3 }} />
                    <Text style={styles.storySurgePillText}>
                      +{formatVolume(volumeDelta)} (+{volumePercent}%)
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Tri-Metric Row */}
              <View style={styles.storyTriRow}>
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{summary.durationMinutes}</Text>
                  <Text style={styles.storyTriLabel}>{language === 'uk' ? 'ХВИЛИН' : 'MINUTES'}</Text>
                </View>
                <View style={styles.storyTriDivider} />
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{summary.completedSets}</Text>
                  <Text style={styles.storyTriLabel}>{language === 'uk' ? 'ПІДХОДІВ' : 'SETS'}</Text>
                </View>
                <View style={styles.storyTriDivider} />
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{summary.exerciseCount}</Text>
                  <Text style={styles.storyTriLabel}>{language === 'uk' ? 'ВПРАВ' : 'EXERCISES'}</Text>
                </View>
              </View>

              {/* Personal Records Highlight */}
              {prs.length > 0 && (
                <View style={styles.storyPrBox}>
                  <View style={styles.storyPrTitleRow}>
                    <MaterialCommunityIcons name="trophy" size={15} color="#FFD130" />
                    <Text style={styles.storyPrTitleText}>
                      {language === 'uk' ? 'НОВІ ОСОБИСТІ РЕКОРДИ' : 'NEW PERSONAL RECORDS'}
                    </Text>
                  </View>
                  {prs.slice(0, 3).map((p) => (
                    <View key={p.id} style={styles.storyPrItem}>
                      <Text numberOfLines={1} style={styles.storyPrExerciseName}>
                        {te(p.exerciseName)}
                      </Text>
                      <Text style={styles.storyPrValue}>{p.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Exercises Summary List */}
              <View style={styles.storyExercisesList}>
                <Text style={styles.storyExercisesHeader}>
                  {language === 'uk' ? 'ВИКОНАНІ ВПРАВИ' : 'EXERCISES COMPLETED'}
                </Text>
                {session.exercises.slice(0, 4).map((ex, i) => (
                  <View key={ex.id || i} style={styles.storyExRow}>
                    <Text numberOfLines={1} style={styles.storyExName}>
                      {te(ex.name)}
                    </Text>
                    <Text style={styles.storyExSets}>
                      {ex.sets.filter((s) => s.completed).length} {language === 'uk' ? 'підх.' : 'sets'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Footer Watermark */}
              <View style={styles.storyFooter}>
                <Ionicons name="barbell-outline" size={14} color="rgba(200, 255, 61, 0.7)" />
                <Text style={styles.storyFooterText}>
                  TRAIN SMARTER • SPOT FITNESS
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Modal Action Buttons */}
          <View style={styles.storiesBottomActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share Story"
              onPress={handleNativeShare}
              style={styles.storyShareBtn}
            >
              <Ionicons name="share-outline" size={20} color="#0B0D0F" style={{ marginRight: 8 }} />
              <Text style={styles.storyShareBtnText}>
                {language === 'uk' ? 'ПОДІЛИТИСЯ ТРЕНУВАННЯМ' : 'SHARE WORKOUT'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
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
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  workoutSubtitle: {
    color: '#8E9BAE',
    fontSize: 15,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '500',
  },
  volumeCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#12161D',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  volumeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  volumeSurgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  volumeSurgeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.2,
  },
  volumeValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  volumeLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '500',
  },
  volumeComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 12,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  volumeComparisonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#B0BAC7',
    lineHeight: 16,
  },
  storySurgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  storySurgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B0D0F',
    letterSpacing: 0.2,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
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
  prThumbWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  prThumb: {
    width: '100%',
    height: '100%',
  },
  prExerciseName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  prValueText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
    fontVariant: ['tabular-nums'],
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
    fontSize: 15,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  topShareBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  storyBanner: {
    width: '100%',
    maxWidth: 350,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12161D',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.35)',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  storyBannerPressed: {
    opacity: 0.85,
    borderColor: colors.primary,
  },
  storyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  storyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  storyBannerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  storyBannerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesModalOverlay: {
    flex: 1,
    backgroundColor: '#07090C',
  },
  storiesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161C26',
  },
  storiesModalHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  storiesCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCardScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  storyCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F131A',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.4)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  storyBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  storyBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storyBrandName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  storyBrandDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  storyBrandSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  storyDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6C7A8E',
    letterSpacing: 0.5,
  },
  storyWorkoutTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 16,
  },
  storyWorkoutTagText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  storyHeroStat: {
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.18)',
    marginBottom: 16,
  },
  storyHeroVolumeNum: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  storyHeroVolumeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  storyTriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161C26',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  storyTriItem: {
    flex: 1,
    alignItems: 'center',
  },
  storyTriNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  storyTriLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6C7A8E',
    letterSpacing: 1,
    marginTop: 2,
  },
  storyTriDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  storyPrBox: {
    backgroundColor: 'rgba(255, 209, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 48, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  storyPrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  storyPrTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD130',
    letterSpacing: 1,
  },
  storyPrItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  storyPrExerciseName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  storyPrValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: 8,
  },
  storyExercisesList: {
    borderTopWidth: 1,
    borderTopColor: '#1A212D',
    paddingTop: 12,
    marginBottom: 14,
  },
  storyExercisesHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6C7A8E',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  storyExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  storyExName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E9BAE',
    flex: 1,
  },
  storyExSets: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  storyFooterText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(200, 255, 61, 0.7)',
    letterSpacing: 1.5,
  },
  storiesBottomActions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#161C26',
    backgroundColor: '#07090C',
  },
  storyShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 26,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  storyShareBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
