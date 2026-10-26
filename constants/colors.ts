import { useUserProfileStore } from '@/store/userProfileStore';

export const darkColors = {
  background: '#0B0D0F',
  surface: '#15181C',
  elevated: '#1C2025',
  border: '#292E35',
  primary: '#C8FF3D',
  primaryText: '#C8FF3D',
  onPrimary: '#0B0D0F',
  primaryMuted: '#33420F',
  text: '#F5F5F5',
  secondary: '#8E959F',
  muted: '#555C65',
  success: '#65E572',
  warning: '#FFB84D',
  danger: '#FF5C5C',
  purple: '#7C5CFF',
  divider: 'rgba(255, 255, 255, 0.05)',
} as const;

export const lightColors = {
  background: '#F3F5F8',
  surface: '#FFFFFF',
  elevated: '#EDF1F5',
  border: '#E2E8F0',
  primary: '#C8FF3D',
  primaryText: '#15803D',
  onPrimary: '#0E1114',
  primaryMuted: '#ECFCCB',
  text: '#0E1114',
  secondary: '#64748B',
  muted: '#94A3B8',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  purple: '#6D28D9',
  divider: 'rgba(15, 23, 42, 0.06)',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  primary: string;
  primaryText: string;
  onPrimary: string;
  primaryMuted: string;
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

/**
 * Reactive hook that returns current theme colors based on userProfileStore.
 */
export function useThemeColors(): ThemeColors {
  const theme = useUserProfileStore((s) => s.profile.theme);
  return theme === 'light' ? lightColors : darkColors;
}
