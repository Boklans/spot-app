import { ViewStyle } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

export type ThemeColors = {
  isDark: boolean;
  background: string;
  surface: string;
  elevated: string;
  border: string;
  borderHighlight: string;
  primary: string;
  primaryText: string;
  onPrimary: string;
  primaryMuted: string;
  accentLine: string;
  accentIndicator: string;
  activeChipBg: string;
  activeChipText: string;
  completedRowBg: string;
  completedRowBorder: string;
  activeRowBg: string;
  restAccent: string;
  restAccentMuted: string;
  superset: string;
  supersetMuted: string;
  warmup: string;
  failure: string;
  prGold: string;
  overlayBackdrop: string;
  text: string;
  secondary: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
  purple: string;
  divider: string;
};

/**
 * Carbon Dark / Obsidian Cockpit — SPOT Signature Flagship Palette
 * Pre-charged #0B0D0F Obsidian canvas prevents OLED purple smearing while harmonizing
 * seamlessly with dark-studio 3D anatomy assets and surgical #C8FF3D Volt accents.
 */
export const darkColors = {
  isDark: true,
  background: '#0B0D0F',
  surface: '#15181C',
  elevated: '#1C2129',
  border: '#242B35',
  borderHighlight: 'rgba(255, 255, 255, 0.085)',
  primary: '#C8FF3D',
  primaryText: '#C8FF3D',
  onPrimary: '#0B0D0F',
  primaryMuted: 'rgba(200, 255, 61, 0.12)',
  accentLine: '#C8FF3D',
  accentIndicator: '#C8FF3D',
  activeChipBg: '#C8FF3D',
  activeChipText: '#0B0D0F',
  completedRowBg: '#0F1914',
  completedRowBorder: '#1A3326',
  activeRowBg: '#181E26',
  restAccent: '#38BDF8',
  restAccentMuted: 'rgba(56, 189, 248, 0.14)',
  superset: '#A855F7',
  supersetMuted: 'rgba(168, 85, 247, 0.14)',
  warmup: '#F59E0B',
  failure: '#EF4444',
  prGold: '#FACC15',
  overlayBackdrop: 'rgba(0, 0, 0, 0.74)',
  text: '#F5F7FA',
  secondary: '#96A0AE',
  muted: '#848F9F',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  purple: '#A855F7',
  divider: 'rgba(255, 255, 255, 0.06)',
} as const satisfies ThemeColors;

/**
 * Daylight Athletic Instrument — WCAG AA High-Contrast Light Palette
 */
export const lightColors = {
  isDark: false,
  background: '#F3F5F8',
  surface: '#FFFFFF',
  elevated: '#EDF1F5',
  border: '#DCE3EC',
  borderHighlight: '#FFFFFF',
  primary: '#C8FF3D',
  primaryText: '#15803D',
  onPrimary: '#0E1114',
  primaryMuted: '#ECFCCB',
  accentLine: '#15803D',
  accentIndicator: '#15803D',
  activeChipBg: '#0E1114',
  activeChipText: '#FFFFFF',
  completedRowBg: '#ECFDF5',
  completedRowBorder: '#A7F3D0',
  activeRowBg: '#F8FAFC',
  restAccent: '#0284C7',
  restAccentMuted: '#E0F2FE',
  superset: '#7C3AED',
  supersetMuted: '#F3E8FF',
  warmup: '#D97706',
  failure: '#DC2626',
  prGold: '#CA8A04',
  overlayBackdrop: 'rgba(15, 23, 42, 0.48)',
  text: '#0E1114',
  secondary: '#5B6779',
  muted: '#5A6678',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  purple: '#6D28D9',
  divider: 'rgba(15, 23, 42, 0.06)',
} as const satisfies ThemeColors;

// Static default export for backward compatibility
export const colors: ThemeColors = darkColors;

/**
 * Anodized 1px hardware surface elevation (zero blurry GPU shadows on dark OLED plates).
 */
export function cardElevation(themeColors: ThemeColors): ViewStyle {
  if (themeColors.isDark) {
    return {
      borderWidth: 1,
      borderColor: themeColors.border,
      borderTopColor: themeColors.borderHighlight,
    };
  }
  return {
    borderWidth: 1,
    borderColor: themeColors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  };
}

/**
 * Reactive hook that returns current theme colors based on userProfileStore.
 */
export function useThemeColors(): ThemeColors {
  const theme = useUserProfileStore((s) => s.profile?.theme);
  return theme === 'light' ? lightColors : darkColors;
}
