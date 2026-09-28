import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatVolume } from '@/lib/progressCalculator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

export default function HistoryDetail() {
  const { t, tm, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const [isStoriesModalVisible, setIsStoriesModalVisible] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const workout = workouts.find((item) => item.id === id);

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/history'))}
            style={styles.topBackBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle}>{t('workoutHistory')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('workoutNotFound')}</Text>
          <Button onPress={() => (router.canGoBack() ? router.back() : router.replace('/history'))}>
            {t('backToHistory')}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const durationMin = Math.max(1, Math.round(workout.durationSeconds / 60));
  const prs = workout.personalRecords || [];
  const workoutDate = new Date(workout.completedAt);
  const dateFormatted = workoutDate.toLocaleDateString(
    language === 'uk' ? 'uk-UA' : 'en-US',
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }
  );

  const handleNativeShare = async () => {
    hapticMedium();
    setIsSharing(true);
    try {
      const prText = prs.length > 0
        ? `\n🏆 Personal Records:\n${prs.map((p) => `• ${p.exerciseName}: ${p.label}`).join('\n')}`
        : '';

      const shareMessage =
        `🔥 SPOT WORKOUT COMPLETE!\n\n` +
        `🏋️ Workout: ${workout.workoutName}\n` +
        `⏱ Duration: ${durationMin} min\n` +
        `📊 Volume: ${formatVolume(workout.totalVolume)}\n` +
        `🔢 Sets: ${workout.totalSets} completed${prText}\n\n` +
        `Tracked with SPOT — AI Strength Coach.`;

      await Share.share({
        title: `${workout.workoutName} Summary • SPOT`,
        message: shareMessage,
      });
    } catch {
      Alert.alert(
        language === 'uk' ? 'Помилка' : 'Error',
        language === 'uk' ? 'Не вдалося поділитися тренуванням.' : 'Could not share workout.'
      );
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/history'))}
          style={styles.topBackBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          {language === 'uk' ? 'САМЕРІ ТРЕНУВАННЯ' : 'WORKOUT SUMMARY'}
        </Text>

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
        {/* 2. Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.completedBadgeText}>
              {language === 'uk' ? 'ЗАВЕРШЕНА СЕСІЯ' : 'COMPLETED SESSION'}
            </Text>
          </View>

          <Text style={styles.title}>{tw(workout.workoutName)}</Text>
          <Text style={styles.workoutSubtitle}>{dateFormatted}</Text>
        </View>

        {/* 3. Stats Tri-Card Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{durationMin} {t('min')}</Text>
            <Text style={styles.statLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workout.exercises.length}</Text>
            <Text style={styles.statLabel}>{t('exercises')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workout.totalSets}</Text>
            <Text style={styles.statLabel}>{t('sets')}</Text>
          </View>
        </View>

        {/* 4. Volume Card */}
        <View style={styles.volumeCard}>
          <Text style={styles.volumeValue}>
            {formatVolume(workout.totalVolume)}
          </Text>
          <Text style={styles.volumeLabel}>{t('volume')}</Text>
        </View>

        {/* 5. Personal Records Card */}
        <View style={styles.prsCard}>
          <View style={styles.prHeader}>
            <MaterialCommunityIcons name="trophy" size={16} color={colors.primary} />
            <Text style={styles.prSectionTitle}>{t('personalRecords')}</Text>
          </View>

          {prs.length === 0 ? (
            <View style={styles.noPrWrap}>
              <Text style={styles.noPrText}>{t('baselineSaved')}</Text>
            </View>
          ) : (
            prs.map((record, index) => (
              <View
                key={record.id || index}
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

        {/* 7. Exercises Breakdown */}
        <Text style={styles.sectionTitle}>{t('exercises').toUpperCase()}</Text>
        {workout.exercises.map((exercise) => (
          <View key={exercise.exerciseId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeaderRow}>
              <View style={styles.exerciseThumbWrap}>
                <Image
                  source={getExerciseImage(exercise.exerciseName)}
                  style={styles.exerciseThumb}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.exerciseHeaderInfo}>
                <Text style={styles.exerciseName}>{te(exercise.exerciseName)}</Text>
                <Text style={styles.muscle}>{tm(exercise.muscleGroup)}</Text>
              </View>
            </View>
            {exercise.sets.map((set, index) => (
              <View
                key={`${exercise.exerciseId}-${set.completedAt || index}-${index}`}
                style={styles.setRow}
              >
                <Text style={styles.setLabel}>
                  {t('set')} {index + 1}
                </Text>
                <Text style={styles.setValue}>
                  {set.weight ? formatWithUnit(set.weight) : t('bodyweight')} × {set.reps}
                </Text>
                <Text style={styles.setVolume}>{formatVolume(set.volume)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* 8. Instagram Stories 9:16 Preview Modal */}
      <Modal
        visible={isStoriesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsStoriesModalVisible(false)}
      >
        <SafeAreaView style={styles.storiesModalOverlay}>
          {/* Modal Header */}
          <View style={styles.storiesModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="logo-instagram" size={18} color="#E1306C" />
              <Text style={styles.storiesModalHeaderTitle}>INSTAGRAM STORY</Text>
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
                <Text style={styles.storyDateText}>{dateFormatted}</Text>
              </View>

              {/* Workout Name Banner */}
              <View style={styles.storyWorkoutTag}>
                <Ionicons name="flash" size={13} color="#0B0D0F" style={{ marginRight: 5 }} />
                <Text numberOfLines={1} style={styles.storyWorkoutTagText}>
                  {tw(workout.workoutName).toUpperCase()}
                </Text>
              </View>

              {/* Main Volume Stat */}
              <View style={styles.storyHeroStat}>
                <Text style={styles.storyHeroVolumeNum}>
                  {formatVolume(workout.totalVolume)}
                </Text>
                <Text style={styles.storyHeroVolumeLabel}>
                  {language === 'uk' ? 'ЗАГАЛЬНИЙ ТОННАЖ' : 'TOTAL VOLUME'}
                </Text>
              </View>

              {/* Tri-Metric Row */}
              <View style={styles.storyTriRow}>
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{durationMin}</Text>
                  <Text style={styles.storyTriLabel}>{language === 'uk' ? 'ХВИЛИН' : 'MINUTES'}</Text>
                </View>
                <View style={styles.storyTriDivider} />
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{workout.totalSets}</Text>
                  <Text style={styles.storyTriLabel}>{language === 'uk' ? 'ПІДХОДІВ' : 'SETS'}</Text>
                </View>
                <View style={styles.storyTriDivider} />
                <View style={styles.storyTriItem}>
                  <Text style={styles.storyTriNum}>{workout.exercises.length}</Text>
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
                {workout.exercises.slice(0, 4).map((ex) => (
                  <View key={ex.exerciseId} style={styles.storyExRow}>
                    <Text numberOfLines={1} style={styles.storyExName}>
                      {te(ex.exerciseName)}
                    </Text>
                    <Text style={styles.storyExSets}>
                      {ex.sets.length} {language === 'uk' ? 'сетів' : 'sets'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Story Watermark */}
              <View style={styles.storyWatermarkRow}>
                <Text style={styles.storyWatermarkText}>TRAIN SMARTER • SPOT FITNESS</Text>
              </View>
            </View>

            {/* Share CTA Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share to Stories"
              onPress={handleNativeShare}
              disabled={isSharing}
              style={({ pressed }) => [styles.shareActionBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="share" size={18} color="#0B0D0F" style={{ marginRight: 8 }} />
              <Text style={styles.shareActionBtnText}>
                {isSharing
                  ? (language === 'uk' ? 'Створення...' : 'Preparing...')
                  : (language === 'uk' ? 'ПОДІЛИТИСЯ З ДРУЗЯМИ' : 'SHARE WITH FRIENDS')}
              </Text>
            </Pressable>
          </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212D',
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#15181C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#292E35',
  },
  topBarTitle: {
    color: '#8E959F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  topShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  completedBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  workoutSubtitle: {
    color: '#8E959F',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#15181C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242C38',
    paddingVertical: 16,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#242C38',
    alignSelf: 'center',
  },
  volumeCard: {
    backgroundColor: '#15181C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242C38',
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  volumeValue: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  volumeLabel: {
    color: '#8E959F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  prsCard: {
    backgroundColor: '#15181C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242C38',
    padding: 16,
    marginBottom: 16,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prSectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  noPrWrap: {
    paddingVertical: 4,
  },
  noPrText: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 19,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    fontWeight: '700',
    flex: 1,
  },
  prValueText: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  storyBannerPressed: {
    opacity: 0.8,
  },
  storyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  storyBannerSubtitle: {
    color: '#8E959F',
    fontSize: 12,
    marginTop: 2,
  },
  storyBannerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E252F',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#15181C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242C38',
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  exerciseThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseHeaderInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  muscle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#242C38',
    paddingTop: 10,
    marginTop: 8,
  },
  setLabel: {
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '800',
    width: 52,
  },
  setValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  setVolume: {
    color: '#8E959F',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#15181C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#292E35',
    padding: 24,
    alignItems: 'center',
    margin: 20,
    gap: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  storiesModalOverlay: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  storiesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212D',
  },
  storiesModalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  storiesCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A212D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCardScroll: {
    padding: 20,
    alignItems: 'center',
  },
  storyCard: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 9 / 16,
    backgroundColor: '#12161D',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#242C38',
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  storyBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storyBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storyBrandName: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
  },
  storyBrandDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B5565',
  },
  storyBrandSub: {
    color: '#8E959F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  storyDateText: {
    color: '#6C7A8E',
    fontSize: 11,
    fontWeight: '600',
  },
  storyWorkoutTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 10,
  },
  storyWorkoutTagText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  storyHeroStat: {
    marginVertical: 12,
  },
  storyHeroVolumeNum: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  storyHeroVolumeLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  storyTriRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  storyTriItem: {
    flex: 1,
    alignItems: 'center',
  },
  storyTriNum: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  storyTriLabel: {
    color: '#8E959F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  storyTriDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'center',
  },
  storyPrBox: {
    backgroundColor: 'rgba(255, 209, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 48, 0.25)',
    borderRadius: 14,
    padding: 10,
    marginVertical: 6,
  },
  storyPrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  storyPrTitleText: {
    color: '#FFD130',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  storyPrItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  storyPrExerciseName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  storyPrValue: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  storyExercisesList: {
    marginVertical: 4,
  },
  storyExercisesHeader: {
    color: '#6C7A8E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  storyExRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  storyExName: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  storyExSets: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  storyWatermarkRow: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  storyWatermarkText: {
    color: '#5A687A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 20,
    width: '100%',
    maxWidth: 340,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  shareActionBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
