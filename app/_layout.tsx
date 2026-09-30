import React from 'react';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import { colors } from '@/constants/colors';
import { loadAsync } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';
import { initNotifications, scheduleWorkoutDayReminders } from '@/lib/notificationService';

// Initialize non-UI services once at module load time so the root layout stays 100% hook-free
loadAsync({
  ...Ionicons.font,
  ...MaterialCommunityIcons.font,
}).catch(() => undefined);

useAuthStore.getState().init();

initNotifications()
  .then(() => scheduleWorkoutDayReminders().catch(() => undefined))
  .catch(() => undefined);

const spotDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
  },
};

export default function SpotAppRoot() {
  return (
    <ThemeProvider value={spotDarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ThemeProvider>
  );
}
