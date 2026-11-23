import { ViewStyle } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

export const darkColors = {
  isDark: true,
  background: '#0B0D0F',
  surface: '#15181C',
  elevated: '#1C2129',
  border: '#262D37',
  borderHighlight: 'rgba(255, 255, 255, 0.08)',
  primary: '#C8FF3D',
  primaryText: '#C8FF3D',
  onPrimary: '#0B0D0F',
  primaryMuted: 'rgba(200, 255, 61, 0.14)',
  accentLine: '#C8FF3D',
  activeChipBg: '#C8FF3D',
  activeChipText: '#0B0D0F',
  text: '#F5F7FA',
  secondary: '#96A0AE',
  muted: '#6E7785',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  purple: '#8B6FFF',
  divider: 'rgba(255, 255, 255, 0.06)',
} as const;

export const lightColors = {
  isDark: false,
  background: '#F3F5F8',
  surface: '#FFFFFF',
  elevated: '#EDF1F5',
  border: '#E2E8F0',
  borderHighlight: '#FFFFFF',
  primary: '#C8FF3D',
  primaryText: '#15803D',
  onPrimary: '#0E1114',
  primaryMuted: '#ECFCCB',
  accentLine: '#15803D',
  activeChipBg: '#0E1114',
  activeChipText: '#FFFFFF',
  text: '#0E1114',
  secondary: '#5B6779',
  muted: '#8C98A9',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  purple: '#6D28D9',
  divider: 'rgba(15, 23, 42, 0.06)',
} as const;

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
  activeChipBg: string;
  activeChipText: string;
  text: string;
  secondary: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
  purple: string;
  divider: string;
};

// Static default export for backward compatibility
export const colors = darkColors;

export function cardElevation(themeColors: ThemeColors): ViewStyle {
  if (themeColors.isDark) {
    return {
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.055)',
      borderTopColor: themeColors.borderHighlight,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 4,
    };
  }
  return {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 2,
  };
}

/**
 * Reactive hook that returns current theme colors based on userProfileStore.
 */
export function useThemeColors(): ThemeColors {
  const theme = useUserProfileStore((s) => s.profile?.theme);
  return theme === 'light' ? (lightColors as unknown as ThemeColors) : (darkColors as unknown as ThemeColors);
}

