import { TextStyle } from 'react-native';

/**
 * SPOT 2.0 Canonical 2-Family Font System:
 * - Inter (400..800): Full Ukrainian Cyrillic (Ґ, Є, І, Ї) & UI prose
 * - JetBrains Mono (600, 700): Hardware-fixed tabular numerals for clocks, weights, reps & indices
 *
 * IMPORTANT: Never co-declare `fontWeight` alongside `fontFamily` on React Native —
 * doing so causes Android to fall back to system Roboto or iOS to synthesize faux bold.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

const tabularNums: TextStyle['fontVariant'] = ['tabular-nums'];

const baseMetrics: Pick<TextStyle, 'includeFontPadding'> = {
  includeFontPadding: false,
};

export const typography = {
  // ─── Semantic v2 Tokens ────────────────────────────────────────────────────
  timerHero: {
    ...baseMetrics,
    fontFamily: fonts.monoBold,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.0,
    fontVariant: tabularNums,
  },
  metricHero: {
    ...baseMetrics,
    fontFamily: fonts.monoBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    fontVariant: tabularNums,
  },
  screenTitle: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  cardTitle: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  setNumeric: {
    ...baseMetrics,
    fontFamily: fonts.monoBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
    fontVariant: tabularNums,
  },
  body: {
    ...baseMetrics,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    ...baseMetrics,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
  },
  buttonPrimary: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  subhead: {
    ...baseMetrics,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  subheadMedium: {
    ...baseMetrics,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  subheadStrong: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  telemetryCaption: {
    ...baseMetrics,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    fontVariant: tabularNums,
  },
  eyebrow: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },

  // ─── Backward-Compatible Aliases ───────────────────────────────────────────
  display: {
    ...baseMetrics,
    fontFamily: fonts.monoBold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.6,
    fontVariant: tabularNums,
  },
  displaySmall: {
    ...baseMetrics,
    fontFamily: fonts.monoBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
    fontVariant: tabularNums,
  },
  h1: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  h2: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  h3: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  bodyBold: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
  },
  secondary: {
    ...baseMetrics,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryMedium: {
    ...baseMetrics,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryBold: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrowMedium: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  button: {
    ...baseMetrics,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  buttonSecondary: {
    ...baseMetrics,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
