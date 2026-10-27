import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatVolume } from '@/lib/progressCalculator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { ExerciseDetailModal } from '@/components/program/ExerciseDetailModal';
import type { CompletedExercise, SetType } from '@/types/workout';

// Temporary feature flag: hide Instagram Stories sharing
const SHOW_INSTAGRAM_STORIES = false;

export default function HistoryDetail() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, tm, te, tw, language } = useI18n();
  const { formatWithUnit, fromKg, toKg, unitLabel } = useWeightUnit();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workouts = useWorkoutHistoryStore((state) => state.workouts);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const updateWorkout = useWorkoutHistoryStore((state) => state.updateWorkout);
  const notes = useExerciseNotesStore((state) => state.notes);
  const loadNotes = useExerciseNotesStore((state) => state.loadNotes);
  const [isStoriesModalVisible, setIsStoriesModalVisible] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftExercises, setDraftExercises] = useState<CompletedExercise[]>([]);
  const [selectedGuideExercise, setSelectedGuideExercise] = useState<{
    name: string;
    muscleGroup?: string;
  } | null>(null);

  useEffect(() => {
    loadHistory();
    loadNotes();
  }, [loadHistory, loadNotes]);

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
            <Ionicons name="chevron-back" size={24} color={colors.text} />
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

  const handleStartEditing = () => {
    hapticMedium();
    setDraftExercises(JSON.parse(JSON.stringify(workout.exercises)));
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    hapticLight();
    setIsEditing(false);
    setDraftExercises([]);
  };

  const handleSaveEditing = async () => {
    hapticSuccess();
    await updateWorkout({
      ...workout,
      exercises: draftExercises,
    });
    setIsEditing(false);
  };

  const handleCycleDraftSetType = (exIdx: number, setIdx: number) => {
    hapticLight();
    const order: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) => {
            if (j !== setIdx) return s;
            const curr: SetType = s.setType ?? 'normal';
            const next = order[(order.indexOf(curr) + 1) % order.length];
            return { ...s, setType: next };
          }),
        };
      })
    );
  };

  const handleUpdateDraftSet = (
    exIdx: number,
    setIdx: number,
    patch: { weightKg?: number; reps?: number }
  ) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) => {
            if (j !== setIdx) return s;
            const nextWeight =
              patch.weightKg !== undefined
                ? Math.max(0, Math.round(patch.weightKg * 100) / 100)
                : s.weight;
            const nextReps =
              patch.reps !== undefined ? Math.max(1, Math.round(patch.reps)) : s.reps;
            return {
              ...s,
              weight: nextWeight,
              reps: nextReps,
              volume: s.setType === 'warmup' ? 0 : Math.round(nextWeight * nextReps * 100) / 100,
            };
          }),
        };
      })
    );
  };

  const handleAddDraftSet = (exIdx: number) => {
    hapticLight();
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const weight = last?.weight ?? 20;
        const reps = last?.reps ?? 10;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              weight,
              reps,
              volume: Math.round(weight * reps * 100) / 100,
              completedAt: new Date().toISOString(),
              setType: 'normal',
            },
          ],
        };
      })
    );
  };

  const handleRemoveDraftSet = (exIdx: number, setIdx: number) => {
    hapticMedium();
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return {
          ...ex,
          sets: ex.sets.filter((_, j) => j !== setIdx),
        };
      })
    );
  };

  const displayedExercises = isEditing ? draftExercises : workout.exercises;

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
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          {isEditing
            ? language === 'uk'
              ? 'РЕДАГУВАННЯ ЗАПИСУ'
              : 'EDITING WORKOUT'
            : language === 'uk'
              ? 'САМЕРІ ТРЕНУВАННЯ'
              : 'WORKOUT SUMMARY'}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Save workout edits' : 'Edit workout'}
            hitSlop={10}
            onPress={isEditing ? handleSaveEditing : handleStartEditing}
            style={[
              styles.topShareBtn,
              isEditing && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name={isEditing ? 'checkmark' : 'create-outline'}
              size={20}
              color={isEditing ? colors.onPrimary : colors.primaryText}
            />
          </Pressable>
          {!isEditing && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share workout summary"
              hitSlop={10}
              onPress={handleNativeShare}
              style={styles.topShareBtn}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primaryText} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Hero Section */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.completedBadge,
              workout.isPartial && {
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
              },
            ]}
          >
            <Ionicons
              name={workout.isPartial ? 'time-outline' : 'checkmark-circle'}
              size={16}
              color={workout.isPartial ? '#F59E0B' : colors.primaryText}
            />
            <Text
              style={[
                styles.completedBadgeText,
                workout.isPartial && { color: '#F59E0B' },
              ]}
            >
              {workout.isPartial
                ? language === 'uk'
                  ? `ЧАСТКОВА СЕСІЯ (${workout.totalSets}/${workout.plannedSets || workout.totalSets} ПІДХ.)`
                  : `PARTIAL SESSION (${workout.totalSets}/${workout.plannedSets || workout.totalSets} SETS)`
                : language === 'uk'
                  ? 'ЗАВЕРШЕНА СЕСІЯ'
                  : 'COMPLETED SESSION'}
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
            <Text style={styles.statValue}>
              {workout.isPartial && workout.plannedSets
                ? `${workout.totalSets}/${workout.plannedSets}`
                : workout.totalSets}
            </Text>
            <Text style={styles.statLabel}>{t('sets')}</Text>
          </View>
        </View>

        {/* 4. Personal Records Card */}
        {prs.length > 0 && (
          <View style={styles.prsCard}>
            <View style={styles.prHeader}>
              <MaterialCommunityIcons
                name="trophy"
                size={16}
                color="#FFD130"
              />
              <Text style={styles.prSectionTitle}>
                {t('personalRecords')}
              </Text>
            </View>

            {prs.map((record, index) => (
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
              </View>
            ))}
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

        {/* 7. Exercises Breakdown Header + Edit Mode Toggle */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            {t('exercises').toUpperCase()}
          </Text>
          {isEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCancelEditing}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: colors.elevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700' }}>
                  {language === 'uk' ? 'Скасувати' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSaveEditing}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                }}
              >
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>
                  {language === 'uk' ? 'Зберегти' : 'Save'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={handleStartEditing}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 10,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="create-outline" size={14} color={colors.primaryText} />
              <Text style={{ color: colors.primaryText, fontSize: 11.5, fontWeight: '800' }}>
                {language === 'uk' ? 'Редагувати підходи' : 'Edit sets'}
              </Text>
            </Pressable>
          )}
        </View>

        {isEditing && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.primaryMuted,
              borderWidth: 1,
              borderColor: colors.accentLine,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 9,
              marginBottom: 12,
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primaryText} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 }}>
              {language === 'uk'
                ? 'Змініть вагу чи повторення або натисніть на мітку сету (1/W/D/F). Рекорди та тоннаж перерахуються автоматично.'
                : 'Adjust weight or reps, or tap the set badge (1/W/D/F). PRs and volume will recalculate automatically.'}
            </Text>
          </View>
        )}

        {displayedExercises.map((exercise, exIdx) => {
          const savedNote = notes[exercise.exerciseName.trim().toLowerCase()] || '';
          const bestWeight = Math.max(
            0,
            ...exercise.sets.filter((s) => s.setType !== 'warmup').map((s) => s.weight)
          );
          const isSupersetA1 = Boolean(
            exercise.supersetWithNext && exIdx < displayedExercises.length - 1
          );
          const isSupersetA2 = Boolean(
            exIdx > 0 && displayedExercises[exIdx - 1]?.supersetWithNext
          );
          let workingSetCounter = 0;

          return (
            <View key={exercise.exerciseId || exIdx} style={styles.exerciseCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  setSelectedGuideExercise({
                    name: exercise.exerciseName,
                    muscleGroup: exercise.muscleGroup,
                  });
                }}
                style={styles.exerciseHeaderRow}
              >
                <View style={styles.exerciseThumbWrap}>
                  <Image
                    source={getExerciseImage(exercise.exerciseName)}
                    style={styles.exerciseThumb}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.exerciseHeaderInfo}>
                  <Text style={styles.exerciseName}>{te(exercise.exerciseName)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={styles.muscle}>{tm(exercise.muscleGroup)}</Text>
                    {(isSupersetA1 || isSupersetA2) && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                          backgroundColor: 'rgba(168, 85, 247, 0.16)',
                          borderWidth: 1,
                          borderColor: 'rgba(168, 85, 247, 0.35)',
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 6,
                        }}
                      >
                        <Ionicons name="link" size={10} color="#A855F7" />
                        <Text style={{ color: '#A855F7', fontSize: 9.5, fontWeight: '800' }}>
                          {isSupersetA1
                            ? language === 'uk'
                              ? 'СУПЕРСЕТ A1'
                              : 'SUPERSET A1'
                            : language === 'uk'
                              ? 'СУПЕРСЕТ A2'
                              : 'SUPERSET A2'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: colors.primaryMuted,
                    borderWidth: 1,
                    borderColor: colors.accentLine,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Ionicons name="play-circle-outline" size={13} color={colors.primaryText} />
                  <Text style={{ color: colors.primaryText, fontSize: 10, fontWeight: '800' }}>
                    {language === 'uk' ? 'Техніка' : 'Guide'}
                  </Text>
                </View>
              </Pressable>

              {savedNote ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: colors.primaryMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="bookmark" size={13} color={colors.primaryText} />
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 }}>
                    {savedNote}
                  </Text>
                </View>
              ) : null}

              {exercise.sets.map((set, index) => {
                const setType = set.setType ?? 'normal';
                if (setType !== 'warmup') {
                  workingSetCounter += 1;
                }
                const isTopSet =
                  setType !== 'warmup' && set.weight > 0 && set.weight === bestWeight && index === 0;
                const badgeText =
                  setType === 'warmup'
                    ? language === 'uk'
                      ? 'W • Розігрів'
                      : 'W • Warmup'
                    : setType === 'dropset'
                      ? `${t('set')} ${workingSetCounter} • D`
                      : setType === 'failure'
                        ? `${t('set')} ${workingSetCounter} • F`
                        : `${t('set')} ${workingSetCounter}`;
                const shortBadge =
                  setType === 'warmup'
                    ? 'W'
                    : setType === 'dropset'
                      ? 'D'
                      : setType === 'failure'
                        ? 'F'
                        : String(workingSetCounter);
                const badgeColor =
                  setType === 'warmup'
                    ? '#F59E0B'
                    : setType === 'dropset'
                      ? '#A855F7'
                      : setType === 'failure'
                        ? '#EF4444'
                        : undefined;

                if (isEditing) {
                  const displayWeight = formatWeight(fromKg(set.weight));
                  return (
                    <View
                      key={`${exercise.exerciseId}-edit-${index}`}
                      style={[
                        styles.setRow,
                        { justifyContent: 'space-between', gap: 8 },
                      ]}
                    >
                      {/* Set Type Cycle Button */}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleCycleDraftSetType(exIdx, index)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          backgroundColor: badgeColor
                            ? `${badgeColor}22`
                            : colors.elevated,
                          borderWidth: 1,
                          borderColor: badgeColor || colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: badgeColor || colors.text,
                            fontSize: 12,
                            fontWeight: '900',
                          }}
                        >
                          {shortBadge}
                        </Text>
                      </Pressable>

                      {/* Weight Input Control */}
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.elevated,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          height: 36,
                          paddingHorizontal: 4,
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            const stepKg = unitLabel === 'lbs' ? toKg(5) : 2.5;
                            handleUpdateDraftSet(exIdx, index, {
                              weightKg: Math.max(0, set.weight - stepKg),
                            });
                          }}
                          style={{
                            width: 26,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.secondary, fontSize: 15, fontWeight: '800' }}>
                            -
                          </Text>
                        </Pressable>
                        <TextInput
                          value={String(displayWeight)}
                          onChangeText={(txt) => {
                            const num = parseFloat(txt.replace(',', '.'));
                            if (!isNaN(num) && num >= 0) {
                              handleUpdateDraftSet(exIdx, index, { weightKg: toKg(num) });
                            } else if (txt === '') {
                              handleUpdateDraftSet(exIdx, index, { weightKg: 0 });
                            }
                          }}
                          keyboardType="decimal-pad"
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontSize: 13.5,
                            fontWeight: '800',
                            textAlign: 'center',
                            paddingVertical: 0,
                          }}
                        />
                        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', marginRight: 2 }}>
                          {unitLabel}
                        </Text>
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            const stepKg = unitLabel === 'lbs' ? toKg(5) : 2.5;
                            handleUpdateDraftSet(exIdx, index, {
                              weightKg: set.weight + stepKg,
                            });
                          }}
                          style={{
                            width: 26,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.secondary, fontSize: 15, fontWeight: '800' }}>
                            +
                          </Text>
                        </Pressable>
                      </View>

                      {/* Reps Input Control */}
                      <View
                        style={{
                          flex: 0.85,
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.elevated,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          height: 36,
                          paddingHorizontal: 4,
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            handleUpdateDraftSet(exIdx, index, {
                              reps: Math.max(1, set.reps - 1),
                            });
                          }}
                          style={{
                            width: 24,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.secondary, fontSize: 15, fontWeight: '800' }}>
                            -
                          </Text>
                        </Pressable>
                        <TextInput
                          value={String(set.reps)}
                          onChangeText={(txt) => {
                            const num = parseInt(txt, 10);
                            if (!isNaN(num) && num >= 1) {
                              handleUpdateDraftSet(exIdx, index, { reps: num });
                            }
                          }}
                          keyboardType="number-pad"
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontSize: 13.5,
                            fontWeight: '800',
                            textAlign: 'center',
                            paddingVertical: 0,
                          }}
                        />
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            handleUpdateDraftSet(exIdx, index, {
                              reps: set.reps + 1,
                            });
                          }}
                          style={{
                            width: 24,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.secondary, fontSize: 15, fontWeight: '800' }}>
                            +
                          </Text>
                        </Pressable>
                      </View>

                      {/* Remove Set Button */}
                      <Pressable
                        disabled={exercise.sets.length <= 1}
                        onPress={() => handleRemoveDraftSet(exIdx, index)}
                        style={{
                          width: 30,
                          height: 34,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: exercise.sets.length <= 1 ? 0.25 : 1,
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <View
                    key={`${exercise.exerciseId}-${set.completedAt || index}-${index}`}
                    style={styles.setRow}
                  >
                    <Text
                      style={[
                        styles.setLabel,
                        badgeColor ? { color: badgeColor, fontWeight: '800' } : null,
                      ]}
                    >
                      {badgeText}
                    </Text>
                    <Text style={styles.setValue}>
                      {set.weight ? formatWithUnit(set.weight) : t('bodyweight')} × {set.reps}{' '}
                      {language === 'uk' ? 'повт' : 'reps'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.primaryText}
                      />
                    </View>
                  </View>
                );
              })}

              {isEditing && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleAddDraftSet(exIdx)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 10,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.elevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="add" size={15} color={colors.primaryText} />
                  <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: '800' }}>
                    {language === 'uk' ? 'Додати підхід' : 'Add Set'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete workout"
          onPress={() => {
            hapticLight();
            Alert.alert(
              language === 'uk' ? 'Видалити тренування?' : 'Delete Workout?',
              language === 'uk'
                ? 'Цей запис буде видалено з історії, а персональні рекорди перераховано.'
                : 'This session will be removed from history and personal records will be recalculated.',
              [
                {
                  text: language === 'uk' ? 'Скасувати' : 'Cancel',
                  style: 'cancel',
                },
                {
                  text: language === 'uk' ? 'Видалити' : 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await useWorkoutHistoryStore.getState().deleteWorkout(workout.id);
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/history');
                    }
                  },
                },
              ]
            );
          }}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 12,
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.35)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text
            style={{
              color: '#EF4444',
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: 0.4,
            }}
          >
            {language === 'uk' ? 'ВИДАЛИТИ ЗАПИС ТРЕНУВАННЯ' : 'DELETE WORKOUT RECORD'}
          </Text>
        </Pressable>
      </ScrollView>

      {selectedGuideExercise && (
        <ExerciseDetailModal
          visible={Boolean(selectedGuideExercise)}
          onClose={() => setSelectedGuideExercise(null)}
          exerciseName={selectedGuideExercise.name}
          muscleGroup={selectedGuideExercise.muscleGroup}
        />
      )}

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  topBarTitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  topShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentLine,
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
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.accentLine,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  completedBadgeText: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  workoutSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },
  volumeCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  volumeValue: {
    color: colors.primaryText,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  volumeLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  prsCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  noPrWrap: {
    paddingVertical: 4,
  },
  noPrText: {
    color: colors.secondary,
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
    borderBottomColor: colors.divider,
  },
  prThumbWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  prValueText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.accentLine,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  storyBannerSubtitle: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  storyBannerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionTitle: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  muscle: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 10,
    marginTop: 8,
  },
  setLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    width: 52,
  },
  setValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  setVolume: {
    color: colors.secondary,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    margin: 20,
    gap: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  storiesModalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
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
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  storyDateText: {
    color: colors.secondary,
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
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  storyHeroStat: {
    marginVertical: 12,
  },
  storyHeroVolumeNum: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  storyTriLabel: {
    color: colors.secondary,
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
    color: colors.text,
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
    color: colors.secondary,
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
    borderTopColor: colors.divider,
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
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
