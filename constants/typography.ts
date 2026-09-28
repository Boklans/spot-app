import { TextStyle } from 'react-native';

const tabularNums: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  // Display (large workout weight, rest timer)
  display: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    fontVariant: tabularNums,
  },
  displaySmall: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    fontVariant: tabularNums,
  },
  // H1 (Screen Title: Good afternoon, Program, Analytics)
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  // H2 (Card Title, Exercise Name, Workout Complete)
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  // H3 (Section Title: Next Up, Current Exercise, This Week)
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  // Body (Descriptions, explanations, muscles)
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  // Secondary (Meta information, dates, small stats)
  secondary: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  secondaryMedium: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  secondaryBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  // Eyebrow / Label (Category kicker, badges, status)
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  eyebrowMedium: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  // Button
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  buttonSecondary: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  // Tab Bar
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  tabLabelActive: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
  },
  // Numeric tabular helper
  numeric: {
    fontVariant: tabularNums,
  },
} as const;

export const layout = {
  screenPadding: 24,
  cardPadding: 20,
  minTouchTarget: 44,
} as const;
