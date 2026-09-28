import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';
import { loadAsync } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';

// Initialize non-UI services once at module load time so RootLayout stays 100% hook-free
loadAsync({
  ...Ionicons.font,
  ...MaterialCommunityIcons.font,
}).catch(() => undefined);

useAuthStore.getState().init();

import('@/lib/notificationService')
  .then(({ initNotifications, scheduleWorkoutDayReminders }) => {
    initNotifications().then(() => {
      scheduleWorkoutDayReminders().catch(() => undefined);
    });
  })
  .catch(() => undefined);

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
