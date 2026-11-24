import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { BodyPart, Slug } from 'react-native-body-highlighter';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';
import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { bodyFemaleFront } from 'react-native-body-highlighter/dist/assets/bodyFemaleFront';
import { bodyFemaleBack } from 'react-native-body-highlighter/dist/assets/bodyFemaleBack';
import { useThemeColors } from '@/constants/colors';
import { normalizeMuscleCategory } from '@/lib/progressCalculator';

export type AnatomyMuscleCategory = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core';

const SLUG_TO_MUSCLE: Partial<Record<Slug, AnatomyMuscleCategory>> = {
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

interface AnatomyPreviewProps {
  /** Raw muscle group names from workout.muscleGroups or exercises */
  muscles: string[];
  sex?: 'male' | 'female' | 'unspecified';
  /** Height of each figure (width scales 1:2 automatically) */
  height?: number;
  /** Show both front and back side-by-side (default true) */
  showBack?: boolean;
}

/**
 * Compact, commercial-grade anatomical target-muscle preview
 * using real Illustrator-traced male/female vector silhouettes.
 * Ideal for Hero Workout Cards (Home) and Workout Preview headers.
 */
export function AnatomyPreview({
  muscles,
  sex = 'male',
  height = 104,
  showBack = true,
}: AnatomyPreviewProps) {
  const colors = useThemeColors();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const isFemale = sex === 'female';
  const width = Math.round(height * 0.5);

  const activeSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of muscles) {
      const norm = normalizeMuscleCategory(m);
      if (norm && norm !== 'Other') set.add(norm);
    }
    return set;
  }, [muscles]);

  const palette = colors.isDark
    ? {
        structural: '#202631',
        structuralOutline: 'rgba(255, 255, 255, 0.14)',
        hair: '#181D26',
        inactive: '#303949',
        activeTop: '#D9FF66',
        activeBot: '#A8E619',
        stroke: 'rgba(9, 11, 14, 0.55)',
      }
    : {
        structural: '#E2E8F0',
        structuralOutline: 'rgba(15, 23, 42, 0.16)',
        hair: '#CBD5E1',
        inactive: '#CFD9E6',
        activeTop: '#22C55E',
        activeBot: '#15803D',
        stroke: 'rgba(255, 255, 255, 0.65)',
      };

  const renderFigure = (side: 'front' | 'back') => {
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

    const gradId = `mini-${uid}-${isFemale ? 'f' : 'm'}-${side}`;

    return (
      <Svg viewBox={viewBox} width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0.2" y2="1">
            <Stop offset="0%" stopColor={palette.activeTop} />
            <Stop offset="100%" stopColor={palette.activeBot} />
          </LinearGradient>
        </Defs>

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
            return (
              <G key={slug}>
                {allPaths.map((d, i) => (
                  <Path
                    key={`${slug}-${i}`}
                    d={d}
                    fill={slug === 'hair' ? palette.hair : palette.structural}
                    stroke={palette.structuralOutline}
                    strokeWidth={1.2}
                  />
                ))}
              </G>
            );
          }

          const isActive = activeSet.has(muscleKey);
          return (
            <G key={slug} opacity={isActive ? 1 : 0.88}>
              {allPaths.map((d, i) => (
                <Path
                  key={`${slug}-${i}`}
                  d={d}
                  fill={isActive ? `url(#${gradId})` : palette.inactive}
                  stroke={palette.stroke}
                  strokeWidth={isActive ? 2.2 : 1.2}
                  strokeLinejoin="round"
                />
              ))}
            </G>
          );
        })}
      </Svg>
    );
  };

  return (
    <View style={styles.wrap}>
      {renderFigure('front')}
      {showBack ? renderFigure('back') : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
