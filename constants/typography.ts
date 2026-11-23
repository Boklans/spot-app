import { TextStyle } from 'react-native';

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

const tabularNums: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  // Display (large workout weight, rest timer)
  display: {
    fontFamily: fonts.extraBold,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
    fontVariant: tabularNums,
  },
  displaySmall: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    fontVariant: tabularNums,
  },
  // H1 (Screen Title: Good afternoon, Program, Analytics)
  h1: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  // H2 (Card Title, Exercise Name, Workout Complete)
  h2: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  // H3 (Section Title: Next Up, Current Exercise, This Week)
  h3: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  // Body (Descriptions, explanations, muscles)
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodyBold: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  // Secondary (Meta information, dates, small stats)
  secondary: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  secondaryMedium: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  secondaryBold: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  // Eyebrow / Label (Category kicker, badges, status)
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700' as const,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  eyebrowMedium: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600' as const,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  // Button
  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  buttonSecondary: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  // Numeric values (weight, reps, timer)
  numeric: {
    fontFamily: fonts.bold,
    fontVariant: tabularNums,
    fontWeight: '700' as const,
  },
};
