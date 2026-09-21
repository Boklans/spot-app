import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    useAuthStore.getState().init();
    import('@/lib/notificationService')
      .then(({ initNotifications, scheduleWorkoutDayReminders }) => {
        initNotifications().then(() => {
          scheduleWorkoutDayReminders().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
