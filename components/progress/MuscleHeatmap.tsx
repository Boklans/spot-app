import React, { useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { BodyPart, Slug } from 'react-native-body-highlighter';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';
import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { bodyFemaleFront } from 'react-native-body-highlighter/dist/assets/bodyFemaleFront';
import { bodyFemaleBack } from 'react-native-body-highlighter/dist/assets/bodyFemaleBack';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { MuscleRecoveryStat } from '@/lib/progressCalculator';

export type HeatmapMuscleKey = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core';
type HeatmapMode = 'load' | 'recovery';

interface MuscleHeatmapProps {
  stats: Record<string, MuscleRecoveryStat>;
  volumes: Record<string, number>;
  selectedMuscle: string;
  onSelectMuscle: (muscle: HeatmapMuscleKey) => void;
  sex?: 'male' | 'female' | 'unspecified';
  formatVolume: (kg: number) => string;
}

type IntensityTier = 0 | 1 | 2 | 3;

const SLUG_TO_MUSCLE: Partial<Record<Slug, HeatmapMuscleKey>> = {
  chest: 'Chest',
  trapezius: 'Back',
  'upper-back': 'Back',
  'lower-back': 'Back',
  deltoids: 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearm: 'Arms',
  quadriceps: 'Legs',
  hamstring: 'Legs',
  gluteal: 'Legs',
  calves: 'Legs',
  tibialis: 'Legs',
  adductors: 'Legs',
  abs: 'Core',
  obliques: 'Core',
};

const STRUCTURAL_SLUGS = new Set<Slug>(['head', 'hair', 'neck', 'hands', 'knees', 'ankles', 'feet']);

function getIntensityTier(stat?: MuscleRecoveryStat): IntensityTier {
  if (!stat || stat.weeklySets <= 0) return 0;
  const ratio = stat.weeklySets / Math.max(1, stat.targetSets);
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}

function getRecoveryTier(stat?: MuscleRecoveryStat): 'fresh' | 'recovering' | 'fatigued' {
  if (!stat || stat.hoursSinceLast === null) return 'fresh';
  if (stat.recoveryPercent >= 85) return 'fresh';
  if (stat.recoveryPercent >= 45) return 'recovering';
  return 'fatigued';
}

/**
 * Hevy / Fitbod / Whoop-grade dual-mode interactive Front + Back anatomical muscle map
 * supporting both 7-Day Training Load and Real-Time Muscle Recovery views.
 */
export function MuscleHeatmap({
  stats,
  volumes,
  selectedMuscle,
  onSelectMuscle,
  sex = 'male',
  formatVolume,
}: MuscleHeatmapProps) {
  const colors = useThemeColors();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tm, language } = useI18n();
  const isUk = language === 'uk';
  const isFemale = sex === 'female';
  const [mode, setMode] = useState<HeatmapMode>('load');

  const getTier = (muscle: HeatmapMuscleKey): IntensityTier => getIntensityTier(stats[muscle]);

  const handleSelect = (muscle: HeatmapMuscleKey) => {
    hapticLight();
    onSelectMuscle(muscle);
  };

  const selectedStat = stats[selectedMuscle];
  const selectedTier = getIntensityTier(selectedStat);
  const selectedRecTier = getRecoveryTier(selectedStat);
  const selectedVol = volumes[selectedMuscle] ?? 0;

  // Regional balance breakdown (Upper / Lower / Core)
  const balance = useMemo(() => {
    const upper =
      (stats.Chest?.weeklySets ?? 0) +
      (stats.Back?.weeklySets ?? 0) +
      (stats.Shoulders?.weeklySets ?? 0) +
      (stats.Arms?.weeklySets ?? 0);
    const lower = stats.Legs?.weeklySets ?? 0;
    const core = stats.Core?.weeklySets ?? 0;
    const total = upper + lower + core;
    if (total === 0) return null;
    const upperPct = Math.round((upper / total) * 100);
    const lowerPct = Math.round((lower / total) * 100);
    const corePct = Math.max(0, 100 - upperPct - lowerPct);
    return { upper, lower, core, total, upperPct, lowerPct, corePct };
  }, [stats]);

  const tierLabel = (tier: IntensityTier) => {
    if (isUk) {
      return tier === 3 ? 'Пік тижня' : tier === 2 ? 'Активно' : tier === 1 ? 'Старт' : 'Не треновано';
    }
    return tier === 3 ? 'Peak Load' : tier === 2 ? 'Active' : tier === 1 ? 'Light' : 'Untrained';
  };

  const recoveryLabel = (rec: 'fresh' | 'recovering' | 'fatigued') => {
    if (isUk) {
      return rec === 'fresh' ? 'Готові' : rec === 'recovering' ? 'Відновлення' : 'Втомлені';
    }
    return rec === 'fresh' ? 'Fresh' : rec === 'recovering' ? 'Recovering' : 'Fatigued';
  };

  const palette = colors.isDark
    ? {
        outline: 'rgba(255, 255, 255, 0.14)',
        structural: '#1B2029',
        hair: '#141820',
        tier0: '#272F3C',
        tier1: '#4D731F',
        tier2: '#89D11E',
        tier3: '#C8FF3D',
        tier1GradTop: '#5E8C25',
        tier1GradBot: '#3C5917',
        tier2GradTop: '#A1E930',
        tier2GradBot: '#6CB214',
        tier3GradTop: '#DBFF6E',
        tier3GradBot: '#B5EE1A',
        recFreshTop: '#4ADE80',
        recFreshBot: '#16A34A',
        recMidTop: '#FCD34D',
        recMidBot: '#D97706',
        recLowTop: '#FB7185',
        recLowBot: '#E11D48',
        recFreshFlat: '#22C55E',
        recMidFlat: '#F59E0B',
        recLowFlat: '#F43F5E',
        selectedStroke: '#F5F7FA',
        muscleSepStroke: 'rgba(9, 11, 14, 0.55)',
        halo: mode === 'recovery' ? '#22C55E' : '#C8FF3D',
      }
    : {
        outline: 'rgba(15, 23, 42, 0.16)',
        structural: '#E2E8F0',
        hair: '#CBD5E1',
        tier0: '#CDD7E4',
        tier1: '#86EFAC',
        tier2: '#22C55E',
        tier3: '#15803D',
        tier1GradTop: '#A7F3D0',
        tier1GradBot: '#4ADE80',
        tier2GradTop: '#4ADE80',
        tier2GradBot: '#16A34A',
        tier3GradTop: '#22C55E',
        tier3GradBot: '#166534',
        recFreshTop: '#4ADE80',
        recFreshBot: '#15803D',
        recMidTop: '#FBBF24',
        recMidBot: '#D97706',
        recLowTop: '#FB7185',
        recLowBot: '#DC2626',
        recFreshFlat: '#16A34A',
        recMidFlat: '#D97706',
        recLowFlat: '#DC2626',
        selectedStroke: '#0E1114',
        muscleSepStroke: 'rgba(255, 255, 255, 0.65)',
        halo: '#16A34A',
      };

  const activeBadge = useMemo(() => {
    if (mode === 'recovery') {
      if (selectedRecTier === 'fatigued') {
        return {
          bg: colors.isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(220, 38, 38, 0.10)',
          border: colors.isDark ? 'rgba(244, 63, 94, 0.4)' : 'rgba(220, 38, 38, 0.30)',
          text: palette.recLowFlat,
          label: `${selectedStat?.recoveryPercent ?? 100}% · ${recoveryLabel('fatigued')}`,
        };
      }
      if (selectedRecTier === 'recovering') {
        return {
          bg: colors.isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 119, 6, 0.10)',
          border: colors.isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(217, 119, 6, 0.30)',
          text: palette.recMidFlat,
          label: `${selectedStat?.recoveryPercent ?? 100}% · ${recoveryLabel('recovering')}`,
        };
      }
      return {
        bg: colors.isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(22, 163, 74, 0.10)',
        border: colors.isDark ? 'rgba(34, 197, 94, 0.38)' : 'rgba(22, 163, 74, 0.30)',
        text: palette.recFreshFlat,
        label: `${selectedStat?.recoveryPercent ?? 100}% · ${recoveryLabel('fresh')}`,
      };
    }

    if (selectedTier === 3) {
      return {
        bg: colors.isDark ? 'rgba(200, 255, 61, 0.14)' : 'rgba(21, 128, 61, 0.11)',
        border: colors.isDark ? 'rgba(200, 255, 61, 0.38)' : 'rgba(21, 128, 61, 0.30)',
        text: colors.primaryText,
        label: tierLabel(3),
      };
    }
    if (selectedTier === 2) {
      return {
        bg: colors.isDark ? 'rgba(137, 209, 30, 0.13)' : 'rgba(34, 197, 94, 0.11)',
        border: colors.isDark ? 'rgba(137, 209, 30, 0.32)' : 'rgba(34, 197, 94, 0.28)',
        text: colors.isDark ? '#A3E635' : '#15803D',
        label: tierLabel(2),
      };
    }
    if (selectedTier === 1) {
      return {
        bg: colors.isDark ? 'rgba(77, 115, 31, 0.18)' : 'rgba(74, 222, 128, 0.14)',
        border: colors.isDark ? 'rgba(101, 163, 13, 0.32)' : 'rgba(74, 222, 128, 0.35)',
        text: colors.isDark ? '#84CC16' : '#16A34A',
        label: tierLabel(1),
      };
    }
    return {
      bg: colors.elevated,
      border: colors.border,
      text: colors.secondary,
      label: tierLabel(0),
    };
  }, [mode, selectedRecTier, selectedTier, selectedStat, colors, palette, isUk]);

  const renderAnatomyFigure = (side: 'front' | 'back') => {
    const parts: BodyPart[] = isFemale
      ? side === 'front'
        ? bodyFemaleFront
        : bodyFemaleBack
      : side === 'front'
        ? bodyFront
        : bodyBack;

    const viewBox = isFemale
      ? side === 'front'
        ? '-50 -40 734 1538'
        : '756 0 774 1448'
      : side === 'front'
        ? '0 0 724 1448'
        : '724 0 724 1448';
    const gradPrefix = `hm-${uid}-${isFemale ? 'f' : 'm'}-${side}`;

    return (
      <View style={styles.figureCol}>
        <Text style={styles.viewLabel}>
          {side === 'front' ? (isUk ? 'СПЕРЕДУ' : 'FRONT') : isUk ? 'ЗЗАДУ' : 'BACK'}
        </Text>
        <View style={styles.figureFrame}>
          <Svg viewBox={viewBox} width={156} height={312}>
            <Defs>
              <RadialGradient id={`${gradPrefix}-glow`} cx="50%" cy="42%" r="50%">
                <Stop offset="0%" stopColor={palette.halo} stopOpacity={colors.isDark ? 0.07 : 0.05} />
                <Stop offset="100%" stopColor={palette.halo} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id={`${gradPrefix}-t1`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.tier1GradTop} />
                <Stop offset="100%" stopColor={palette.tier1GradBot} />
              </LinearGradient>
              <LinearGradient id={`${gradPrefix}-t2`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.tier2GradTop} />
                <Stop offset="100%" stopColor={palette.tier2GradBot} />
              </LinearGradient>
              <LinearGradient id={`${gradPrefix}-t3`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.tier3GradTop} />
                <Stop offset="100%" stopColor={palette.tier3GradBot} />
              </LinearGradient>
              <LinearGradient id={`${gradPrefix}-rfresh`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.recFreshTop} />
                <Stop offset="100%" stopColor={palette.recFreshBot} />
              </LinearGradient>
              <LinearGradient id={`${gradPrefix}-rmid`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.recMidTop} />
                <Stop offset="100%" stopColor={palette.recMidBot} />
              </LinearGradient>
              <LinearGradient id={`${gradPrefix}-rlow`} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={palette.recLowTop} />
                <Stop offset="100%" stopColor={palette.recLowBot} />
              </LinearGradient>
            </Defs>

            <Ellipse
              cx={side === 'front' ? 360 : 1090}
              cy={620}
              rx={320}
              ry={540}
              fill={`url(#${gradPrefix}-glow)`}
            />

            {parts.map((part) => {
              const slug = part.slug;
              if (!slug) return null;

              const allPaths = [
                ...(part.path?.common ?? []),
                ...(part.path?.left ?? []),
                ...(part.path?.right ?? []),
              ];
              if (allPaths.length === 0) return null;

              const isStructural = STRUCTURAL_SLUGS.has(slug);
              const muscleKey = SLUG_TO_MUSCLE[slug];

              if (isStructural || !muscleKey) {
                const structFill = slug === 'hair' ? palette.hair : palette.structural;
                return (
                  <G key={slug}>
                    {allPaths.map((d, i) => (
                      <Path
                        key={`${slug}-${i}`}
                        d={d}
                        fill={structFill}
                        stroke={palette.outline}
                        strokeWidth={1.2}
                      />
                    ))}
                  </G>
                );
              }

              const isSel = selectedMuscle === muscleKey;
              let fill = palette.tier0;
              let opacity = isSel ? 1 : 0.72;

              if (mode === 'recovery') {
                const rStat = stats[muscleKey];
                const rTier = getRecoveryTier(rStat);
                if (!rStat || rStat.hoursSinceLast === null) {
                  fill = palette.tier0;
                  opacity = isSel ? 1 : 0.65;
                } else {
                  fill =
                    rTier === 'fatigued'
                      ? `url(#${gradPrefix}-rlow)`
                      : rTier === 'recovering'
                        ? `url(#${gradPrefix}-rmid)`
                        : `url(#${gradPrefix}-rfresh)`;
                  opacity = isSel ? 1 : 0.6;
                }
              } else {
                const tier = getTier(muscleKey);
                fill =
                  tier === 3
                    ? `url(#${gradPrefix}-t3)`
                    : tier === 2
                      ? `url(#${gradPrefix}-t2)`
                      : tier === 1
                        ? `url(#${gradPrefix}-t1)`
                        : palette.tier0;
                opacity = isSel ? 1 : tier > 0 ? 0.54 : 0.72;
              }

              const stroke = isSel ? palette.selectedStroke : palette.muscleSepStroke;
              const strokeWidth = isSel ? 3.2 : 1.4;

              const pressProps =
                Platform.OS === 'web'
                  ? ({ onClick: () => handleSelect(muscleKey), style: { cursor: 'pointer' } } as any)
                  : { onPress: () => handleSelect(muscleKey) };

              return (
                <G key={slug} opacity={opacity} {...pressProps}>
                  {allPaths.map((d, i) => (
                    <Path
                      key={`${slug}-${i}`}
                      d={d}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinejoin="round"
                    />
                  ))}
                </G>
              );
            })}
          </Svg>
        </View>
      </View>
    );
  };

  const formatLastTrained = (hours: number | null) => {
    if (hours === null) {
      return isUk ? 'Ще не треновано · 100% готовності' : 'Not trained yet · 100% ready';
    }
    if (hours < 24) {
      return isUk
        ? `Останнє тренування: ${hours} год тому`
        : `Last trained ${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return isUk
      ? `Останнє тренування: ${days} дн. тому`
      : `Last trained ${days}d ago`;
  };

  return (
    <View style={styles.card}>
      {/* Header + Dual-Mode Segmented Switch */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {mode === 'recovery'
              ? isUk
                ? 'СТАТУС ВІДНОВЛЕННЯ'
                : 'MUSCLE READINESS'
              : isUk
                ? 'АНАТОМІЯ НАВАНТАЖЕННЯ'
                : 'MUSCLE DISTRIBUTION'}
          </Text>
          <Text style={styles.title}>
            {mode === 'recovery'
              ? isUk
                ? 'Відновлення мʼязів'
                : 'Recovery Anatomy'
              : isUk
                ? 'Карта мʼязів · 7 днів'
                : '7-Day Anatomy Map'}
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setMode('load');
            }}
            style={[styles.modeBtn, mode === 'load' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'load' && styles.modeBtnTextActive]}>
              {isUk ? 'Обсяг' : 'Load'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setMode('recovery');
            }}
            style={[styles.modeBtn, mode === 'recovery' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'recovery' && styles.modeBtnTextActive]}>
              {isUk ? 'Відновл.' : 'Recovery'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Real Illustrator-Traced Front + Back Anatomy */}
      <View style={styles.figuresRow}>
        {renderAnatomyFigure('front')}
        {renderAnatomyFigure('back')}
      </View>

      {/* Selected Muscle Telemetry Strip */}
      <View style={styles.focusStrip}>
        <View style={styles.focusTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.focusMuscleName}>{tm(selectedMuscle)}</Text>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: activeBadge.bg, borderColor: activeBadge.border },
              ]}
            >
              <Text style={[styles.tierBadgeText, { color: activeBadge.text }]}>
                {activeBadge.label}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.focusVolume,
              mode === 'recovery' ? { color: activeBadge.text } : null,
            ]}
          >
            {mode === 'recovery'
              ? `${selectedStat?.recoveryPercent ?? 100}%`
              : selectedVol > 0
                ? formatVolume(selectedVol)
                : isUk
                  ? '0 кг'
                  : '0 kg'}
          </Text>
        </View>
        <Text style={styles.focusMeta}>
          {mode === 'recovery'
            ? formatLastTrained(selectedStat?.hoursSinceLast ?? null)
            : selectedStat
              ? `${selectedStat.weeklySets} / ${selectedStat.targetSets} ${isUk ? 'робочих сетів за 7 днів' : 'working sets in last 7 days'}`
              : isUk
                ? '0 робочих сетів за 7 днів'
                : '0 working sets in last 7 days'}
        </Text>
      </View>

      {/* Clean Muscle Filter Pills */}
      <View style={styles.quickPillsRow}>
        {(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as HeatmapMuscleKey[]).map((m) => {
          const isSel = selectedMuscle === m;
          const rStat = stats[m];
          let dotColor = palette.tier0;

          if (mode === 'recovery') {
            if (rStat && rStat.hoursSinceLast !== null) {
              const rTier = getRecoveryTier(rStat);
              dotColor =
                rTier === 'fatigued'
                  ? palette.recLowFlat
                  : rTier === 'recovering'
                    ? palette.recMidFlat
                    : palette.recFreshFlat;
            }
          } else {
            const t = getTier(m);
            dotColor =
              t === 3 ? palette.tier3 : t === 2 ? palette.tier2 : t === 1 ? palette.tier1 : palette.tier0;
          }

          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`Select ${m}`}
              onPress={() => handleSelect(m)}
              style={[styles.muscleChip, isSel && styles.muscleChipActive]}
            >
              <View style={[styles.chipDot, { backgroundColor: isSel && colors.isDark ? '#090B0E' : dotColor }]} />
              <Text style={[styles.muscleChipText, isSel && styles.muscleChipTextActive]}>
                {tm(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Upper / Lower / Core Training Balance Bar */}
      {balance ? (
        <View style={styles.balanceWrap}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>
              {isUk ? 'Баланс тижня' : 'Split Balance'}
            </Text>
            <Text style={styles.balanceValues} numberOfLines={1}>
              {isUk ? 'Верх' : 'Upper'} {balance.upperPct}% · {isUk ? 'Низ' : 'Lower'} {balance.lowerPct}%
              {balance.corePct > 0 ? ` · ${isUk ? 'Кор' : 'Core'} ${balance.corePct}%` : ''}
            </Text>
          </View>
          <View style={styles.balanceTrack}>
            {balance.upperPct > 0 && (
              <View
                style={[
                  styles.balanceSegment,
                  { flex: balance.upperPct, backgroundColor: colors.accentLine },
                ]}
              />
            )}
            {balance.lowerPct > 0 && (
              <View
                style={[
                  styles.balanceSegment,
                  { flex: balance.lowerPct, backgroundColor: colors.purple },
                ]}
              />
            )}
            {balance.corePct > 0 && (
              <View
                style={[
                  styles.balanceSegment,
                  { flex: balance.corePct, backgroundColor: colors.warning },
                ]}
              />
            )}
          </View>
        </View>
      ) : null}

      {/* Minimalist Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>
          {mode === 'recovery' ? (isUk ? 'Стан:' : 'State:') : isUk ? 'Обсяг:' : 'Load:'}
        </Text>
        <View style={styles.legendSteps}>
          {(mode === 'recovery'
            ? [
                { color: palette.recLowFlat, label: isUk ? 'Втомлені' : 'Fatigued' },
                { color: palette.recMidFlat, label: isUk ? 'Відновл.' : 'Recovering' },
                { color: palette.recFreshFlat, label: isUk ? 'Готові' : 'Fresh' },
              ]
            : [
                { color: palette.tier0, label: '0' },
                { color: palette.tier1, label: isUk ? 'Низький' : 'Light' },
                { color: palette.tier2, label: isUk ? 'Середній' : 'Active' },
                { color: palette.tier3, label: isUk ? 'Пік' : 'Peak' },
              ]
          ).map((step) => (
            <View key={step.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: step.color }]} />
              <Text style={styles.legendItemText}>{step.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 16,
      marginBottom: 14,
      ...cardElevation(colors),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 10,
    },
    eyebrow: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.elevated,
      borderRadius: radii.pill,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
    },
    modeBtnActive: {
      backgroundColor: colors.activeChipBg,
    },
    modeBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.secondary,
    },
    modeBtnTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
      fontWeight: '700',
    },
    tierBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    tierBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    figuresRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      gap: 4,
      marginBottom: 10,
    },
    figureCol: {
      flex: 1,
      alignItems: 'center',
    },
    figureFrame: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewLabel: {
      fontFamily: fonts.bold,
      color: colors.muted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      marginBottom: 2,
    },
    focusStrip: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: radii.sm + 2,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    focusTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    focusMuscleName: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15.5,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    focusVolume: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 14.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    focusMeta: {
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12.5,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    quickPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
    },
    muscleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    muscleChipActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    chipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    muscleChipText: {
      fontFamily: fonts.semiBold,
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '600',
    },
    muscleChipTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
      fontWeight: '700',
    },
    balanceWrap: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: 6,
    },
    balanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    balanceLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
    balanceValues: {
      fontFamily: fonts.semiBold,
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
    },
    balanceTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      flexDirection: 'row',
      gap: 2,
      backgroundColor: colors.elevated,
    },
    balanceSegment: {
      height: '100%',
      borderRadius: 3,
    },
    legendRow: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    legendLabel: {
      fontFamily: fonts.semiBold,
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    legendSteps: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },
    legendItemText: {
      fontFamily: fonts.semiBold,
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '600',
    },
  });
