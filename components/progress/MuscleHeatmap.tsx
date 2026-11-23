import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { MuscleRecoveryStat } from '@/lib/progressCalculator';

export type HeatmapMuscleKey = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core';

interface MuscleHeatmapProps {
  stats: Record<string, MuscleRecoveryStat>;
  volumes: Record<string, number>;
  selectedMuscle: string;
  onSelectMuscle: (muscle: HeatmapMuscleKey) => void;
  sex?: 'male' | 'female' | 'unspecified';
  formatVolume: (kg: number) => string;
}

type IntensityTier = 0 | 1 | 2 | 3;

function getIntensityTier(stat?: MuscleRecoveryStat): IntensityTier {
  if (!stat || stat.weeklySets <= 0) return 0;
  const ratio = stat.weeklySets / Math.max(1, stat.targetSets);
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}

function getTierFillId(tier: IntensityTier, prefix: string): string {
  return `url(#${prefix}-tier-${tier})`;
}

/**
 * Flagship studio-grade interactive Front + Back anatomical muscle heatmap.
 * Features:
 * - Sculpted anatomical Bezier contours with multi-head muscle separation
 *   (3-head quads, dual-head hamstrings & calves, anatomical traps/rhomboids/lats/glutes,
 *   deltoid caps, sculpted pectorals, 6-pack + obliques).
 * - Distinct athletic male & female silhouettes.
 * - Multi-stop studio lighting gradients + subtle specular highlights & ambient glow.
 * - Zero web console errors (platform-safe click/press binding).
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tm, language } = useI18n();
  const isUk = language === 'uk';
  const isFemale = sex === 'female';

  const getTier = (muscle: HeatmapMuscleKey): IntensityTier => getIntensityTier(stats[muscle]);

  const handleSelect = (muscle: HeatmapMuscleKey) => {
    hapticLight();
    onSelectMuscle(muscle);
  };

  const selectedStat = stats[selectedMuscle];
  const selectedTier = getIntensityTier(selectedStat);
  const selectedVol = volumes[selectedMuscle] ?? 0;

  const tierLabel = (tier: IntensityTier) => {
    if (isUk) {
      return tier === 3 ? 'Пік тижня' : tier === 2 ? 'Активно' : tier === 1 ? 'Старт' : 'Не треновано';
    }
    return tier === 3 ? 'Peak Load' : tier === 2 ? 'Active' : tier === 1 ? 'Light' : 'Untrained';
  };

  const tierBadgeStyle = (tier: IntensityTier) => {
    if (tier === 3) {
      return {
        bg: colors.isDark ? 'rgba(200, 255, 61, 0.16)' : 'rgba(21, 128, 61, 0.12)',
        border: colors.isDark ? 'rgba(200, 255, 61, 0.45)' : 'rgba(21, 128, 61, 0.35)',
        text: colors.primaryText,
      };
    }
    if (tier === 2) {
      return {
        bg: colors.isDark ? 'rgba(132, 204, 22, 0.14)' : 'rgba(34, 197, 94, 0.12)',
        border: colors.isDark ? 'rgba(132, 204, 22, 0.35)' : 'rgba(34, 197, 94, 0.3)',
        text: colors.isDark ? '#A3E635' : '#15803D',
      };
    }
    if (tier === 1) {
      return {
        bg: colors.isDark ? 'rgba(101, 163, 13, 0.12)' : 'rgba(74, 222, 128, 0.14)',
        border: colors.isDark ? 'rgba(101, 163, 13, 0.3)' : 'rgba(74, 222, 128, 0.35)',
        text: colors.isDark ? '#84CC16' : '#16A34A',
      };
    }
    return {
      bg: colors.elevated,
      border: colors.border,
      text: colors.secondary,
    };
  };

  const activeBadge = tierBadgeStyle(selectedTier);

  // Studio-lit material gradients
  const svgPalette = colors.isDark
    ? {
        bodyTop: '#232933',
        bodyMid: '#1B2028',
        bodyBottom: '#13171D',
        bodyStroke: 'rgba(255, 255, 255, 0.11)',
        tier0Top: '#313946',
        tier0Bot: '#212731',
        tier1Top: '#608F22',
        tier1Bot: '#395713',
        tier2Top: '#A1E932',
        tier2Bot: '#65AD14',
        tier3Top: '#E2FF7D',
        tier3Bot: '#B4EE1C',
        selectedStroke: '#FFFFFF',
        unselectedStroke: 'rgba(9, 11, 14, 0.72)',
        halo: '#C8FF3D',
        specular: 'rgba(255, 255, 255, 0.16)',
        detailLine: 'rgba(255, 255, 255, 0.08)',
      }
    : {
        bodyTop: '#E5ECF4',
        bodyMid: '#DCE4EE',
        bodyBottom: '#CDD8E5',
        bodyStroke: 'rgba(15, 23, 42, 0.14)',
        tier0Top: '#C9D4E2',
        tier0Bot: '#B4C1D2',
        tier1Top: '#86EFAC',
        tier1Bot: '#4ADE80',
        tier2Top: '#34D399',
        tier2Bot: '#16A34A',
        tier3Top: '#22C55E',
        tier3Bot: '#15803D',
        selectedStroke: '#0E1114',
        unselectedStroke: 'rgba(255, 255, 255, 0.78)',
        halo: '#16A34A',
        specular: 'rgba(255, 255, 255, 0.32)',
        detailLine: 'rgba(15, 23, 42, 0.09)',
      };

  // Platform-safe SVG press handler (avoids react-native-svg responder warnings on Web)
  const interactionProps = (muscle: HeatmapMuscleKey) =>
    Platform.OS === 'web'
      ? ({ onClick: () => handleSelect(muscle), style: { cursor: 'pointer' } } as any)
      : { onPress: () => handleSelect(muscle) };

  const muscleGroupProps = (muscle: HeatmapMuscleKey, prefix: string) => {
    const tier = getTier(muscle);
    const isSel = selectedMuscle === muscle;
    return {
      fill: getTierFillId(tier, prefix),
      stroke: isSel ? svgPalette.selectedStroke : svgPalette.unselectedStroke,
      strokeWidth: isSel ? 1.85 : 0.85,
      strokeLinejoin: 'round' as const,
      strokeLinecap: 'round' as const,
      opacity: isSel ? 1 : tier > 0 ? 0.9 : 0.82,
      ...interactionProps(muscle),
    };
  };

  const renderDefs = (prefix: string) => (
    <Defs>
      <RadialGradient id={`${prefix}-ambient`} cx="50%" cy="40%" r="54%">
        <Stop offset="0%" stopColor={svgPalette.halo} stopOpacity={colors.isDark ? 0.13 : 0.09} />
        <Stop offset="70%" stopColor={svgPalette.halo} stopOpacity={colors.isDark ? 0.03 : 0.02} />
        <Stop offset="100%" stopColor={svgPalette.halo} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`${prefix}-body`} x1="0" y1="0" x2="0.15" y2="1">
        <Stop offset="0%" stopColor={svgPalette.bodyTop} />
        <Stop offset="55%" stopColor={svgPalette.bodyMid} />
        <Stop offset="100%" stopColor={svgPalette.bodyBottom} />
      </LinearGradient>
      <LinearGradient id={`${prefix}-tier-0`} x1="0" y1="0" x2="0.25" y2="1">
        <Stop offset="0%" stopColor={svgPalette.tier0Top} />
        <Stop offset="100%" stopColor={svgPalette.tier0Bot} />
      </LinearGradient>
      <LinearGradient id={`${prefix}-tier-1`} x1="0" y1="0" x2="0.25" y2="1">
        <Stop offset="0%" stopColor={svgPalette.tier1Top} />
        <Stop offset="100%" stopColor={svgPalette.tier1Bot} />
      </LinearGradient>
      <LinearGradient id={`${prefix}-tier-2`} x1="0" y1="0" x2="0.25" y2="1">
        <Stop offset="0%" stopColor={svgPalette.tier2Top} />
        <Stop offset="100%" stopColor={svgPalette.tier2Bot} />
      </LinearGradient>
      <LinearGradient id={`${prefix}-tier-3`} x1="0" y1="0" x2="0.25" y2="1">
        <Stop offset="0%" stopColor={svgPalette.tier3Top} />
        <Stop offset="100%" stopColor={svgPalette.tier3Bot} />
      </LinearGradient>
    </Defs>
  );

  // High-craft sculpted athletic human body silhouette (200x400 anatomical proportion grid)
  const bodySilhouette = isFemale
    ? // Sculpted athletic female silhouette (refined shoulders, tapered waist, athletic hips/glutes, sculpted calves & feet)
      'M100 18 C110 18 117 26 117 38 C117 48 112 56 107 60 L109 70 C123 73 140 78 148 91 C154 102 157 126 161 151 C164 168 168 186 169 198 C169 206 165 212 161 212 C158 212 156 206 155 198 C153 190 151 177 148 164 C144 147 140 128 135 117 L130 144 C126 158 126 168 132 182 C140 200 144 218 140 242 C137 266 131 286 128 306 C126 324 128 346 126 365 C125 373 130 379 128 383 C125 387 113 387 109 381 C107 377 108 367 109 355 C109 336 107 312 105 289 C104 266 103 243 100 229 C97 243 96 266 95 289 C93 312 91 336 91 355 C92 367 93 377 91 381 C87 387 75 387 72 383 C70 379 75 373 74 365 C72 346 74 324 72 306 C69 286 63 266 60 242 C56 218 60 200 68 182 C74 168 74 158 70 144 L65 117 C60 128 56 147 52 164 C49 177 47 190 45 198 C44 206 42 212 39 212 C35 212 31 206 31 198 C32 186 36 168 39 151 C43 126 46 102 52 91 C60 78 77 73 91 70 L93 60 C88 56 83 48 83 38 C83 26 90 18 100 18 Z'
    : // Sculpted athletic male V-taper silhouette (broad delts, muscular neck/traps, tapered waist, sweeping quads, athletic calves & feet)
      'M100 16 C112 16 119 25 119 38 C119 49 113 57 109 61 L113 71 C130 74 149 80 158 94 C165 106 168 131 172 156 C175 174 179 192 179 205 C179 213 174 218 169 217 C165 216 163 209 162 200 C160 190 157 177 154 164 C150 147 146 128 140 118 L133 151 C130 165 130 180 135 198 C140 216 142 236 138 261 C134 285 129 304 128 323 C126 341 128 358 126 370 C125 377 131 382 129 386 C126 390 112 390 108 384 C106 379 107 368 108 355 C108 335 106 310 104 285 C103 262 102 241 100 227 C98 241 97 262 96 285 C94 310 92 335 92 355 C93 368 94 379 92 384 C88 390 74 390 71 386 C69 382 75 377 74 370 C72 358 74 341 72 323 C71 304 66 285 62 261 C58 236 60 216 65 198 C70 180 70 165 67 151 L60 118 C54 128 50 147 46 164 C43 177 40 190 38 200 C37 209 35 216 31 217 C26 218 21 213 21 205 C21 192 25 174 28 156 C32 131 35 106 42 94 C51 80 70 74 87 71 L91 61 C87 57 81 49 81 38 C81 25 88 16 100 16 Z';

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {isUk ? 'АНАТОМІЧНА КАРТА' : 'ANATOMY HEATMAP'}
          </Text>
          <Text style={styles.title}>
            {isUk ? 'Навантаження за 7 днів' : '7-Day Muscle Load'}
          </Text>
        </View>
        <View style={styles.tapHintPill}>
          <Text style={styles.tapHintText}>
            {isUk ? 'Торкніться мʼяза' : 'Tap a muscle'}
          </Text>
        </View>
      </View>

      {/* Dual Studio Sculpted Figures: Front & Back */}
      <View style={styles.figuresRow}>
        {/* ================= FRONT ANATOMY ================= */}
        <View style={styles.figureCol}>
          <Text style={styles.viewLabel}>{isUk ? 'СПЕРЕДУ' : 'FRONT'}</Text>
          <Svg viewBox="0 0 200 400" width="100%" height={304} style={styles.svgFigure}>
            {renderDefs('front')}

            {/* Ambient Spotlight Halo */}
            <Ellipse cx="100" cy="180" rx="84" ry="140" fill="url(#front-ambient)" />

            {/* Sculpted Base Body */}
            <Path
              d={bodySilhouette}
              fill="url(#front-body)"
              stroke={svgPalette.bodyStroke}
              strokeWidth={1.15}
            />

            {/* Clavicle & Neck Sculpt Lines */}
            <Path
              d="M84 74 Q100 81 116 74 M94 62 Q100 68 106 62"
              fill="none"
              stroke={svgPalette.detailLine}
              strokeWidth={1.1}
            />

            {/* UPPER TRAPS COLLAR (Front visibility — part of Back) */}
            <G {...muscleGroupProps('Back', 'front')}>
              <Path d="M88 67 C82 71 74 75 68 78 C75 79 84 78 92 75 Z" />
              <Path d="M112 67 C118 71 126 75 132 78 C125 79 116 78 108 75 Z" />
            </G>

            {/* SHOULDERS — Anterior & Lateral Deltoid Caps (L + R) */}
            <G {...muscleGroupProps('Shoulders', 'front')}>
              <Path
                d={
                  isFemale
                    ? 'M68 79 C55 82 47 93 49 111 C53 117 61 114 66 104 C70 96 71 86 72 80 Z'
                    : 'M65 77 C49 81 40 94 43 114 C48 121 57 118 63 107 C68 97 70 86 71 78 Z'
                }
              />
              <Path
                d={
                  isFemale
                    ? 'M132 79 C145 82 153 93 151 111 C147 117 139 114 134 104 C130 96 129 86 128 80 Z'
                    : 'M135 77 C151 81 160 94 157 114 C152 121 143 118 137 107 C132 97 130 86 129 78 Z'
                }
              />
            </G>

            {/* CHEST — Sculpted Pectoralis Major (L + R) with organic clavicular sweep */}
            <G {...muscleGroupProps('Chest', 'front')}>
              <Path
                d={
                  isFemale
                    ? 'M71 84 C79 80 91 81 98 86 L98 116 C89 122 74 120 68 110 C65 102 66 91 71 84 Z'
                    : 'M68 81 C78 77 92 78 98 84 L98 120 C87 126 70 123 64 111 C61 102 63 90 68 81 Z'
                }
              />
              <Path
                d={
                  isFemale
                    ? 'M129 84 C121 80 109 81 102 86 L102 116 C111 122 126 120 132 110 C135 102 134 91 129 84 Z'
                    : 'M132 81 C122 77 108 78 102 84 L102 120 C113 126 130 123 136 111 C139 102 137 90 132 81 Z'
                }
              />
            </G>

            {/* ARMS — Sculpted Biceps Brachii + Brachioradialis Forearms (L + R) */}
            <G {...muscleGroupProps('Arms', 'front')}>
              {/* Left Bicep */}
              <Path
                d={
                  isFemale
                    ? 'M49 114 C44 126 44 142 48 154 C53 157 59 152 61 140 C63 129 62 119 58 112 Z'
                    : 'M43 117 C36 130 36 148 42 160 C48 163 56 157 59 144 C61 131 60 120 55 113 Z'
                }
              />
              {/* Left Forearm */}
              <Path
                d={
                  isFemale
                    ? 'M47 157 C41 171 38 187 40 200 C44 202 48 196 51 184 C53 173 55 164 54 157 Z'
                    : 'M40 163 C33 178 30 195 33 207 C38 209 44 202 47 189 C50 177 52 167 50 161 Z'
                }
              />
              {/* Right Bicep */}
              <Path
                d={
                  isFemale
                    ? 'M151 114 C156 126 156 142 152 154 C147 157 141 152 139 140 C137 129 138 119 142 112 Z'
                    : 'M157 117 C164 130 164 148 158 160 C152 163 144 157 141 144 C139 131 140 120 145 113 Z'
                }
              />
              {/* Right Forearm */}
              <Path
                d={
                  isFemale
                    ? 'M153 157 C159 171 162 187 160 200 C156 202 152 196 149 184 C147 173 145 164 146 157 Z'
                    : 'M160 163 C167 178 170 195 167 207 C162 209 156 202 153 189 C150 177 148 167 150 161 Z'
                }
              />
            </G>

            {/* CORE — External Obliques + Sculpted Rectus Abdominis (6-pack + V-taper) */}
            <G {...muscleGroupProps('Core', 'front')}>
              {/* Left & Right Oblique sweeps */}
              <Path
                d={
                  isFemale
                    ? 'M72 124 C74 140 75 156 78 176 C84 173 85 157 84 130 Z'
                    : 'M68 126 C70 144 71 162 75 184 C82 180 84 162 83 132 Z'
                }
              />
              <Path
                d={
                  isFemale
                    ? 'M128 124 C126 140 125 156 122 176 C116 173 115 157 116 130 Z'
                    : 'M132 126 C130 144 129 162 125 184 C118 180 116 162 117 132 Z'
                }
              />
              {/* Upper Abs L + R */}
              <Path d="M86 124 C90 123 95 123 98 125 L98 141 C94 142 89 142 86 140 C85 135 85 129 86 124 Z" />
              <Path d="M114 124 C110 123 105 123 102 125 L102 141 C106 142 111 142 114 140 C115 135 115 129 114 124 Z" />
              {/* Mid Abs L + R */}
              <Path d="M86 145 C90 144 95 144 98 146 L98 162 C94 163 89 163 86 161 C85 156 85 150 86 145 Z" />
              <Path d="M114 145 C110 144 105 144 102 146 L102 162 C106 163 111 163 114 161 C115 156 115 150 114 145 Z" />
              {/* Lower Ab V-Taper */}
              <Path d="M87 166 C94 165 106 165 113 166 C111 179 106 192 100 198 C94 192 89 179 87 166 Z" />
            </G>

            {/* LEGS — Sculpted Multi-Head Quadriceps (Lateralis + Rectus Femoris + VMO) + Calves */}
            <G {...muscleGroupProps('Legs', 'front')}>
              {/* Left Vastus Lateralis (Outer Quad Sweep) */}
              <Path
                d={
                  isFemale
                    ? 'M68 200 C59 224 61 254 70 278 C75 275 78 256 78 232 C78 214 75 203 68 200 Z'
                    : 'M67 201 C58 225 60 256 70 281 C75 277 79 257 79 233 C79 215 75 204 67 201 Z'
                }
              />
              {/* Left Rectus Femoris (Central Quad) */}
              <Path d="M77 202 C82 199 88 202 91 212 C93 233 91 258 84 277 C79 278 76 263 76 238 C76 220 76 208 77 202 Z" />
              {/* Left Vastus Medialis (VMO Teardrop above knee) */}
              <Path d="M93 234 C96 248 95 267 89 280 C85 280 84 270 86 256 C88 244 90 237 93 234 Z" />

              {/* Right Vastus Lateralis (Outer Quad Sweep) */}
              <Path
                d={
                  isFemale
                    ? 'M132 200 C141 224 139 254 130 278 C125 275 122 256 122 232 C122 214 125 203 132 200 Z'
                    : 'M133 201 C142 225 140 256 130 281 C125 277 121 257 121 233 C121 215 125 204 133 201 Z'
                }
              />
              {/* Right Rectus Femoris (Central Quad) */}
              <Path d="M123 202 C118 199 112 202 109 212 C107 233 109 258 116 277 C121 278 124 263 124 238 C124 220 124 208 123 202 Z" />
              {/* Right Vastus Medialis (VMO Teardrop above knee) */}
              <Path d="M107 234 C104 248 105 267 111 280 C115 280 116 270 114 256 C112 244 110 237 107 234 Z" />

              {/* Left Tibialis & Outer Calf */}
              <Path d="M75 304 C70 322 72 346 78 364 C83 365 88 355 90 338 C91 322 89 309 84 301 Z" />
              {/* Right Tibialis & Outer Calf */}
              <Path d="M125 304 C130 322 128 346 122 364 C117 365 112 355 110 338 C109 322 111 309 116 301 Z" />
            </G>

            {/* Subtle Patella / Knee Sculpt Detail */}
            <Path
              d="M76 289 Q82 296 88 289 M112 289 Q118 296 124 289"
              fill="none"
              stroke={svgPalette.detailLine}
              strokeWidth={1.2}
            />

            {/* Subtle Top Specular Sheen on Chest for 3D depth */}
            <Path
              d="M72 86 Q83 84 93 88 M128 86 Q117 84 107 88"
              fill="none"
              stroke={svgPalette.specular}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* ================= BACK ANATOMY ================= */}
        <View style={styles.figureCol}>
          <Text style={styles.viewLabel}>{isUk ? 'ЗЗАДУ' : 'BACK'}</Text>
          <Svg viewBox="0 0 200 400" width="100%" height={304} style={styles.svgFigure}>
            {renderDefs('back')}

            {/* Ambient Spotlight Halo */}
            <Ellipse cx="100" cy="180" rx="84" ry="140" fill="url(#back-ambient)" />

            {/* Sculpted Base Body */}
            <Path
              d={bodySilhouette}
              fill="url(#back-body)"
              stroke={svgPalette.bodyStroke}
              strokeWidth={1.15}
            />

            {/* SHOULDERS — Posterior Deltoids (L + R) */}
            <G {...muscleGroupProps('Shoulders', 'back')}>
              <Path
                d={
                  isFemale
                    ? 'M68 80 C55 83 47 94 49 111 C54 116 62 113 67 103 C71 95 72 86 73 80 Z'
                    : 'M65 78 C49 82 40 95 43 114 C49 120 58 116 64 105 C69 95 71 86 72 78 Z'
                }
              />
              <Path
                d={
                  isFemale
                    ? 'M132 80 C145 83 153 94 151 111 C146 116 138 113 133 103 C129 95 128 86 127 80 Z'
                    : 'M135 78 C151 82 160 95 157 114 C151 120 142 116 136 105 C131 95 129 86 128 78 Z'
                }
              />
            </G>

            {/* BACK — Organic Curved Upper/Mid Traps + Infraspinatus + Sweeping Lats + Erector Spinae */}
            <G {...muscleGroupProps('Back', 'back')}>
              {/* Organic Flowing Trapezius (Neck down to Mid-Back) */}
              <Path
                d={
                  isFemale
                    ? 'M91 66 C83 71 75 76 70 81 C74 96 84 114 100 132 C116 114 126 96 130 81 C125 76 117 71 109 66 C104 68 96 68 91 66 Z'
                    : 'M89 64 C80 70 71 75 66 80 C71 97 82 117 100 136 C118 117 129 97 134 80 C129 75 120 70 111 64 C105 66 95 66 89 64 Z'
                }
              />
              {/* Left Sweeping Lat Wing + Teres Major */}
              <Path
                d={
                  isFemale
                    ? 'M68 97 C62 114 63 134 70 153 C77 161 86 161 93 154 C94 142 93 134 89 124 C81 114 74 104 68 97 Z'
                    : 'M64 95 C56 115 58 138 66 159 C75 168 85 167 93 158 C94 145 93 136 88 125 C79 114 71 103 64 95 Z'
                }
              />
              {/* Right Sweeping Lat Wing + Teres Major */}
              <Path
                d={
                  isFemale
                    ? 'M132 97 C138 114 137 134 130 153 C123 161 114 161 107 154 C106 142 107 134 111 124 C119 114 126 104 132 97 Z'
                    : 'M136 95 C144 115 142 138 134 159 C125 168 115 167 107 158 C106 145 107 136 112 125 C121 114 129 103 136 95 Z'
                }
              />
              {/* Tapered Erector Spinae / Lower Back Pillars */}
              <Path d="M84 159 C89 156 94 153 98 148 L98 182 C92 183 85 181 82 176 C81 170 82 164 84 159 Z" />
              <Path d="M116 159 C111 156 106 153 102 148 L102 182 C108 183 115 181 118 176 C119 170 118 164 116 159 Z" />
            </G>

            {/* ARMS — Sculpted Triceps Horseshoe + Forearms (L + R) */}
            <G {...muscleGroupProps('Arms', 'back')}>
              {/* Left Tricep */}
              <Path
                d={
                  isFemale
                    ? 'M49 114 C44 127 44 143 48 155 C54 157 59 151 61 139 C63 128 62 119 58 113 Z'
                    : 'M43 117 C36 131 36 149 42 161 C48 163 56 156 59 143 C61 130 60 120 55 113 Z'
                }
              />
              {/* Left Forearm */}
              <Path
                d={
                  isFemale
                    ? 'M47 158 C41 172 38 188 40 200 C44 202 48 196 51 184 C53 173 55 164 54 158 Z'
                    : 'M40 164 C33 179 30 196 33 207 C38 209 44 202 47 189 C50 177 52 167 50 162 Z'
                }
              />
              {/* Right Tricep */}
              <Path
                d={
                  isFemale
                    ? 'M151 114 C156 127 156 143 152 155 C146 157 141 151 139 139 C137 128 138 119 142 113 Z'
                    : 'M157 117 C164 131 164 149 158 161 C152 163 144 156 141 143 C139 130 140 120 145 113 Z'
                }
              />
              {/* Right Forearm */}
              <Path
                d={
                  isFemale
                    ? 'M153 158 C159 172 162 188 160 200 C156 202 152 196 149 184 C147 173 145 164 146 158 Z'
                    : 'M160 164 C167 179 170 196 167 207 C162 209 156 202 153 189 C150 177 148 167 150 162 Z'
                }
              />
            </G>

            {/* LEGS — Sculpted Glutes + Dual-Head Hamstrings + Dual-Head Gastrocnemius Calves */}
            <G {...muscleGroupProps('Legs', 'back')}>
              {/* Left Gluteus Maximus */}
              <Path
                d={
                  isFemale
                    ? 'M71 186 C59 198 58 221 70 233 C82 239 95 234 98 222 L98 189 C89 185 78 184 71 186 Z'
                    : 'M72 188 C62 199 62 219 73 229 C84 235 95 230 98 220 L98 190 C89 187 79 186 72 188 Z'
                }
              />
              {/* Right Gluteus Maximus */}
              <Path
                d={
                  isFemale
                    ? 'M129 186 C141 198 142 221 130 233 C118 239 105 234 102 222 L102 189 C111 185 122 184 129 186 Z'
                    : 'M128 188 C138 199 138 219 127 229 C116 235 105 230 102 220 L102 190 C111 187 121 186 128 188 Z'
                }
              />
              {/* Left Outer Hamstring (Biceps Femoris) */}
              <Path d="M67 236 C63 255 66 274 73 288 C78 286 81 273 82 256 C82 245 79 239 67 236 Z" />
              {/* Left Inner Hamstring (Semitendinosus) */}
              <Path d="M84 238 C89 238 94 236 96 244 C96 261 93 278 86 289 C81 288 80 274 81 257 C82 246 82 241 84 238 Z" />

              {/* Right Outer Hamstring (Biceps Femoris) */}
              <Path d="M133 236 C137 255 134 274 127 288 C122 286 119 273 118 256 C118 245 121 239 133 236 Z" />
              {/* Right Inner Hamstring (Semitendinosus) */}
              <Path d="M116 238 C111 238 106 236 104 244 C104 261 107 278 114 289 C119 288 120 274 119 257 C118 246 118 241 116 238 Z" />

              {/* Left Gastrocnemius (Outer + Inner Calf Heads) */}
              <Path d="M75 301 C68 317 70 338 76 352 C81 350 83 336 83 319 C83 308 80 302 75 301 Z" />
              <Path d="M86 301 C91 304 94 316 93 332 C92 346 87 355 82 354 C81 344 82 329 83 316 C84 307 84 303 86 301 Z" />

              {/* Right Gastrocnemius (Outer + Inner Calf Heads) */}
              <Path d="M125 301 C132 317 130 338 124 352 C119 350 117 336 117 319 C117 308 120 302 125 301 Z" />
              <Path d="M114 301 C109 304 106 316 107 332 C108 346 113 355 118 354 C119 344 118 329 117 316 C116 307 116 303 114 301 Z" />
            </G>

            {/* Subtle Top Specular Sheen on Traps & Glutes */}
            <Path
              d="M84 74 Q100 71 116 74 M76 194 Q85 191 93 195 M124 194 Q115 191 107 195"
              fill="none"
              stroke={svgPalette.specular}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      </View>

      {/* Selected Muscle Live Focus Strip */}
      <View style={styles.focusStrip}>
        <View style={styles.focusLeft}>
          <View style={styles.focusTitleRow}>
            <Text style={styles.focusMuscleName}>{tm(selectedMuscle)}</Text>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: activeBadge.bg, borderColor: activeBadge.border },
              ]}
            >
              <Text style={[styles.tierBadgeText, { color: activeBadge.text }]}>
                {tierLabel(selectedTier)}
              </Text>
            </View>
          </View>
          <Text style={styles.focusMeta}>
            {selectedStat
              ? `${selectedStat.weeklySets}/${selectedStat.targetSets} ${isUk ? 'робочих сетів за 7д' : 'working sets (7d)'}`
              : isUk
                ? '0 робочих сетів за 7д'
                : '0 working sets (7d)'}
            {'  ·  '}
            {selectedVol > 0 ? formatVolume(selectedVol) : isUk ? '0 кг' : '0 kg'}
          </Text>
        </View>
      </View>

      {/* Quick Select Muscle Pills */}
      <View style={styles.quickPillsRow}>
        {(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as HeatmapMuscleKey[]).map((m) => {
          const isSel = selectedMuscle === m;
          const t = getTier(m);
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`Select ${m}`}
              onPress={() => handleSelect(m)}
              style={[styles.muscleChip, isSel && styles.muscleChipActive]}
            >
              <View
                style={[
                  styles.chipDot,
                  {
                    backgroundColor:
                      t === 3
                        ? svgPalette.tier3Top
                        : t === 2
                          ? svgPalette.tier2Top
                          : t === 1
                            ? svgPalette.tier1Top
                            : svgPalette.tier0Top,
                  },
                ]}
              />
              <Text style={[styles.muscleChipText, isSel && styles.muscleChipTextActive]}>
                {tm(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Intensity Scale Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>{isUk ? 'Інтенсивність:' : 'Intensity:'}</Text>
        <View style={styles.legendSteps}>
          {[
            { color: svgPalette.tier0Top, label: '0' },
            { color: svgPalette.tier1Top, label: isUk ? 'Низька' : 'Light' },
            { color: svgPalette.tier2Top, label: isUk ? 'Середня' : 'Active' },
            { color: svgPalette.tier3Top, label: isUk ? 'Пік' : 'Peak' },
          ].map((step) => (
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
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      ...cardElevation(colors),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    eyebrow: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
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
    tapHintPill: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    tapHintText: {
      fontFamily: fonts.semiBold,
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '600',
    },
    figuresRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingVertical: 2,
    },
    figureCol: {
      flex: 1,
      alignItems: 'center',
    },
    viewLabel: {
      fontFamily: fonts.bold,
      color: colors.muted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.3,
      marginBottom: 4,
    },
    svgFigure: {
      maxWidth: 170,
    },
    focusStrip: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    focusLeft: {
      gap: 4,
    },
    focusTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    focusMuscleName: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    tierBadge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    tierBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 11,
      fontWeight: '700',
    },
    focusMeta: {
      fontFamily: fonts.semiBold,
      color: colors.secondary,
      fontSize: 12.5,
      fontWeight: '600',
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
      borderRadius: 999,
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
