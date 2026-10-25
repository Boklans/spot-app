import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { inferEquipmentFromName, isAssistedExercise, recommendWeight } from '@/lib/adaptiveProgression';
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
  const { formatVolume, formatWithUnit } = useWeightUnit();
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
  const isPartial = summary.isPartial;
  const prs = session.personalRecords ?? [];

  const nextSessionPlan = session.exercises
    .map((ex) => {
      const completedSets = ex.sets
        .filter((s) => s.completed && s.reps > 0)
        .map((s) => ({ weight: s.weight, reps: s.reps }));
      if (completedSets.length === 0) return null;
      const targetRange = ex.sets[0]?.targetReps || '8-12';
      const equipment = ex.equipment || inferEquipmentFromName(ex.name);
      const isAssisted = isAssistedExercise(ex.name);
      const nextRec = recommendWeight(
        {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment,
          sets: ex.sets.length,
          targetRepRange: targetRange,
          recommendedWeight: completedSets[0]?.weight ?? 0,
          weightIncrement: ex.weightIncrement || 2.5,
          restSeconds: ex.restSeconds || 90,
        },
        completedSets
      );

      const prevSets = ex.previousSets || [];
      const hasPrev = prevSets.length > 0;
      const prevWorkingWeight = hasPrev
        ? (isAssisted ? Math.min(...prevSets.map((s) => s.weight)) : Math.max(...prevSets.map((s) => s.weight)))
        : 0;
      const todayWorkingWeight = isAssisted
        ? Math.min(...completedSets.map((s) => s.weight))
        : Math.max(...completedSets.map((s) => s.weight));
      const prevRepsStr = hasPrev ? prevSets.map((s) => s.reps).join('/') : null;
      const todayRepsStr = completedSets.map((s) => s.reps).join('/');

      const prevTotalReps = prevSets.reduce((acc, s) => acc + s.reps, 0);
      const todayTotalReps = completedSets.reduce((acc, s) => acc + s.reps, 0);
      const weightDiff = Math.round((todayWorkingWeight - prevWorkingWeight) * 10) / 10;
      const repsDiff = todayTotalReps - prevTotalReps;
      const minOverlapSets = Math.min(completedSets.length, prevSets.length);
      const pairedRepsDiff =
        minOverlapSets > 0
          ? completedSets.slice(0, minOverlapSets).reduce((acc, s) => acc + s.reps, 0) -
            prevSets.slice(0, minOverlapSets).reduce((acc, s) => acc + s.reps, 0)
          : 0;
      const setsDiff = completedSets.length - prevSets.length;
      const minTodayReps = Math.min(...completedSets.map((s) => s.reps));
      const minPrevReps = hasPrev ? Math.min(...prevSets.map((s) => s.reps)) : 0;

      const progressedWeight = hasPrev && (isAssisted ? weightDiff < 0 : weightDiff > 0);
      const progressedReps = hasPrev && !progressedWeight && Math.abs(weightDiff) < 0.01 && pairedRepsDiff > 0;
      const progressedSets =
        hasPrev &&
        !progressedWeight &&
        !progressedReps &&
        Math.abs(weightDiff) < 0.01 &&
        setsDiff > 0 &&
        minTodayReps >= minPrevReps;
      const isProgressedToday = progressedWeight || progressedReps || progressedSets;

      return {
        id: ex.id,
        name: ex.name,
        customImageUri: ex.customImageUri,
        completedSets,
        prevSets,
        hasPrev,
        prevWorkingWeight,
        todayWorkingWeight,
        prevRepsStr,
        todayRepsStr,
        weightDiff,
        repsDiff,
        pairedRepsDiff,
        setsDiff,
        progressedWeight,
        progressedReps,
        progressedSets,
        isProgressedToday,
        nextRec,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const progressedExercisesCount = nextSessionPlan.filter((i) => i.isProgressedToday).length;

  // Find previous non-partial session of the same workout (excluding current session)
  const previousWorkout = workouts.find(
    (w) =>
      w.id !== session.id &&
      !w.isPartial &&
      (w.programWorkoutId === session.programWorkoutId ||
        w.workoutName.trim().toLowerCase() === session.workoutName.trim().toLowerCase())
  );

  const prevVolume = previousWorkout?.totalVolume ?? 0;
  const currentVolume = summary.volume;
  const hasPreviousSession = Boolean(previousWorkout) && !isPartial;
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
        ? `Завершив тренування "${tw(session.workoutName)}" у SPOT\n\n` +
          `⏱️ Тривалість: ${summary.durationMinutes} хв\n` +
          `🏋️ Тоннаж: ${formatVolume(summary.volume)}${surgeShareText}\n` +
          `📊 Підходів: ${summary.completedSets}${prsText}`
        : `Completed "${tw(session.workoutName)}" on SPOT\n\n` +
          `⏱️ Duration: ${summary.durationMinutes} min\n` +
          `🏋️ Volume: ${formatVolume(summary.volume)}${surgeShareText}\n` +
          `📊 Sets: ${summary.completedSets}${prsText}`;

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
          accessibilityLabel="Share workout"
          hitSlop={12}
          onPress={handleNativeShare}
          style={styles.topShareBtn}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Status Header (Calm for Partial, Clean for Full) */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.statusIconWrap,
              isPartial ? styles.statusIconWrapPartial : styles.statusIconWrapComplete,
            ]}
          >
            <Ionicons
              name={isPartial ? 'bookmark-outline' : 'checkmark-done'}
              size={26}
              color={isPartial ? '#F59E0B' : colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {isPartial
              ? (language === 'uk' ? 'Тренування збережено частково' : 'Partial Workout Saved')
              : (language === 'uk' ? 'Тренування виконано' : 'Workout Completed')}
          </Text>
          <Text style={styles.workoutSubtitle}>
            {isPartial
              ? (language === 'uk'
                  ? `Виконано ${summary.completedSets} із ${summary.plannedSets} підходів · ${tw(session.workoutName)}`
                  : `Completed ${summary.completedSets} of ${summary.plannedSets} sets · ${tw(session.workoutName)}`)
              : tw(session.workoutName)}
          </Text>
        </View>

        {/* 3. Stats Tri-Card Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary.durationMinutes} {t('min')}</Text>
            <Text style={styles.statLabel}>{t('duration')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {isPartial ? `${summary.exerciseCount}/${summary.plannedExerciseCount}` : summary.exerciseCount}
            </Text>
            <Text style={styles.statLabel}>{t('exercises')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {isPartial ? `${summary.completedSets}/${summary.plannedSets}` : summary.completedSets}
            </Text>
            <Text style={styles.statLabel}>{t('sets')}</Text>
          </View>
        </View>

        {/* 4. Volume Card */}
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
          <Text style={styles.volumeLabel}>
            {isPartial
              ? (language === 'uk' ? 'Фактичний тоннаж виконаних підходів' : 'Completed sets volume')
              : t('volume')}
          </Text>

          {/* Volume Sub-Banner */}
          {isPartial ? (
            <View style={styles.volumeComparisonRow}>
              <Ionicons name="information-circle-outline" size={15} color="#F59E0B" />
              <Text style={styles.volumeComparisonText}>
                {language === 'uk'
                  ? 'Збережено лише фактично виконані підходи. Це тренування залишається наступним за розкладом.'
                  : 'Only completed sets were logged. This workout remains next in your schedule.'}
              </Text>
            </View>
          ) : hasPreviousSession ? (
            <View style={styles.volumeComparisonRow}>
              <Ionicons
                name={volumeDelta > 0 ? 'trending-up-outline' : volumeDelta < 0 ? 'remove-circle-outline' : 'checkmark-circle-outline'}
                size={15}
                color={volumeDelta > 0 ? colors.primary : volumeDelta < 0 ? '#8E99A8' : colors.primary}
              />
              <Text style={styles.volumeComparisonText}>
                {volumeDelta > 0
                  ? (language === 'uk'
                    ? `+${volumePercent}% до минулого «${tw(previousWorkout?.workoutName || '')}»`
                    : `+${volumePercent}% vs previous "${tw(previousWorkout?.workoutName || '')}"`)
                  : volumeDelta === 0
                  ? (language === 'uk'
                    ? 'Тоннаж відповідає минулому тренуванню'
                    : 'Volume matched previous workout')
                  : (language === 'uk'
                    ? `${volumePercent}% порівняно з минулим тренуванням`
                    : `${volumePercent}% vs previous workout`)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 5. Personal Records Card (Only shown when real PRs exist) */}
        {prs.length > 0 && (
          <View style={styles.prsCard}>
            <View style={styles.prHeader}>
              <MaterialCommunityIcons
                name="trophy"
                size={16}
                color="#FFD130"
              />
              <Text style={styles.prSectionTitle}>
                {prsHeaderTitle}
              </Text>
            </View>

            {prs.map((record, index) => (
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
            ))}
          </View>
        )}

        {/* 5B. Exercise Progress Breakdown & Next Session Targets */}
        {nextSessionPlan.length > 0 && (
          <View style={styles.prsCard}>
            <View style={[styles.prHeader, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                <Ionicons name="trending-up" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.prSectionTitle, { color: colors.primary, flex: 1 }]}>
                  {language === 'uk' ? 'ПРОГРЕС ПО ВПРАВАХ' : 'EXERCISE PROGRESS'}
                </Text>
              </View>
              {progressedExercisesCount > 0 && (
                <View
                  style={{
                    backgroundColor: 'rgba(182, 240, 0, 0.16)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>
                    {language === 'uk'
                      ? `+${progressedExercisesCount} з прогресом`
                      : `+${progressedExercisesCount} progressed`}
                  </Text>
                </View>
              )}
            </View>
            {nextSessionPlan.map((item, idx) => {
              const isIncrease = item.nextRec.recommendationReason === 'increase';
              const isReduce = item.nextRec.recommendationReason === 'reduce';
              const targetWeightStr = item.nextRec.recommendedWeight > 0
                ? formatWithUnit(item.nextRec.recommendedWeight)
                : (language === 'uk' ? 'Власна вага' : 'Bodyweight');
              const targetRepsStr = item.nextRec.recommendedReps ?? 8;

              const prevWeightStr = item.prevWorkingWeight > 0
                ? formatWithUnit(item.prevWorkingWeight)
                : (language === 'uk' ? 'ВТ' : 'BW');
              const todayWeightStr = item.todayWorkingWeight > 0
                ? formatWithUnit(item.todayWorkingWeight)
                : (language === 'uk' ? 'ВТ' : 'BW');

              return (
                <View
                  key={item.id + idx}
                  style={[
                    styles.prRow,
                    { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
                    idx < nextSessionPlan.length - 1 && styles.prRowBorder,
                  ]}
                >
                  {/* Top Row: Exercise Name + Next Session Target Badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.prThumbWrap}>
                      <Image
                        source={getExerciseImage(item.name, item.customImageUri)}
                        style={styles.prThumb}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.prExerciseName}>
                        {te(item.name)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {item.hasPrev
                          ? `${language === 'uk' ? 'Минуле' : 'Last'}: ${prevWeightStr} × ${item.prevRepsStr}  ➔  ${language === 'uk' ? 'Сьогодні' : 'Today'}: ${todayWeightStr} × ${item.todayRepsStr}`
                          : `${language === 'uk' ? 'Виконано сьогодні' : 'Logged today'}: ${todayWeightStr} × ${item.todayRepsStr}`}
                      </Text>
                    </View>
                    {item.isProgressedToday ? (
                      <View
                        style={{
                          backgroundColor: 'rgba(182, 240, 0, 0.16)',
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 7,
                          borderWidth: 1,
                          borderColor: 'rgba(182, 240, 0, 0.35)',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                          {item.progressedWeight
                            ? `${item.weightDiff > 0 ? '+' : ''}${formatWithUnit(item.weightDiff)}`
                            : item.progressedReps
                            ? `+${item.pairedRepsDiff} ${language === 'uk' ? 'повт' : 'reps'}`
                            : `+${item.setsDiff} ${language === 'uk' ? 'підх.' : 'sets'}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Next Session Goal Box */}
                  <View
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: isIncrease
                        ? 'rgba(200, 255, 61, 0.28)'
                        : isReduce
                        ? 'rgba(255, 159, 28, 0.25)'
                        : 'rgba(255, 255, 255, 0.07)',
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#CBD5E1' }}>
                        {language === 'uk' ? 'Наступна ціль:' : 'Next session target:'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isIncrease ? colors.primary : isReduce ? '#FF9F1C' : '#FFFFFF',
                        }}
                      >
                        {targetWeightStr} × {targetRepsStr} {language === 'uk' ? 'повт' : 'reps'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#94A3B8', lineHeight: 16 }}>
                      {language === 'uk'
                        ? (item.nextRec.explanationUk || item.nextRec.explanation)
                        : item.nextRec.explanation}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
                <Ionicons name="share-social" size={20} color="#0B0D0F" />
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

          <ScrollView
            contentContainerStyle={styles.storyCardScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.storyCard}>
              <View style={styles.storyBrandRow}>
                <View style={styles.storyBrandLeft}>
                  <Text style={styles.storyBrandName}>SPOT</Text>
                  <View style={styles.storyBrandDot} />
                  <Text style={styles.storyBrandSub}>ATHLETICS</Text>
                </View>
                <Text style={styles.storyDateText}>{workoutDateFormatted}</Text>
              </View>

              <View style={styles.storyWorkoutTag}>
                <Ionicons name="flash" size={13} color="#0B0D0F" style={{ marginRight: 5 }} />
                <Text numberOfLines={1} style={styles.storyWorkoutTagText}>
                  {tw(session.workoutName).toUpperCase()}
                </Text>
              </View>

              <View style={styles.storyHeroStat}>
                <Text style={styles.storyHeroVolumeNum}>
                  {formatVolume(summary.volume)}
                </Text>
                <Text style={styles.storyHeroVolumeLabel}>
                  {language === 'uk' ? 'ЗАГАЛЬНИЙ ТОННАЖ' : 'TOTAL VOLUME'}
                </Text>
              </View>

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
            </View>
          </ScrollView>

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
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  statusIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  statusIconWrapComplete: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  statusIconWrapPartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  workoutSubtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    width: '100%',
    maxWidth: 350,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12161D',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 14,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 14,
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
  prsCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prSectionTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    marginTop: 8,
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
    fontWeight: '700',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  storyDateText: {
    fontSize: 10,
    fontWeight: '600',
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
    fontWeight: '800',
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
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  storyHeroVolumeLabel: {
    fontSize: 11,
    fontWeight: '700',
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
  },
  storyTriItem: {
    flex: 1,
    alignItems: 'center',
  },
  storyTriNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  storyTriLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6C7A8E',
    letterSpacing: 1,
    marginTop: 2,
  },
  storyTriDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  },
  storyShareBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
