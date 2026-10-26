import React, { useMemo } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { StatusBar } from 'react-native';
import { useThemeColors } from '@/constants/colors';
import { useUserProfileStore } from '@/store/userProfileStore';
import { loadAsync } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { initNotifications, scheduleWorkoutDayReminders } from '@/lib/notificationService';

// Initialize non-UI services once at module load time so the root layout stays 100% hook-free
loadAsync({
  ...Ionicons.font,
  ...MaterialCommunityIcons.font,
}).catch(() => undefined);

useAuthStore.getState().init();
useSubscriptionStore.getState().init();
useWorkoutSessionStore.getState().hydrateSession().catch(() => undefined);

initNotifications()
  .then(() => scheduleWorkoutDayReminders().catch(() => undefined))
  .catch(() => undefined);

export default function SpotAppRoot() {
  const theme = useUserProfileStore((s) => s.profile.theme) ?? 'dark';
  const colors = useThemeColors();

  const navigationTheme = useMemo(() => {
    const baseTheme = theme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [theme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ThemeProvider>
  );
}
