import React, { useEffect, useMemo } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, Pressable, StatusBar, LogBox, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { darkColors, lightColors, useThemeColors } from '@/constants/colors';
import { useUserProfileStore } from '@/store/userProfileStore';
import { loadAsync } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/store/authStore';
import { useCustomExercisesStore } from '@/store/customExercisesStore';
import { useProgramStore } from '@/store/programStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { loadOnboarding } from '@/store/workoutStore';
import {
  initNotifications,
  scheduleWorkoutDayReminders,
  startLiveWorkoutNotificationSync,
} from '@/lib/notificationService';

LogBox.ignoreLogs(['Error configuring Purchases', 'Invalid API key']);

// Hold native splash screen until profile/theme/language/session stores hydrate
SplashScreen.preventAutoHideAsync().catch(() => undefined);

let bootstrapped = false;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const activeTheme = useUserProfileStore.getState().profile?.theme;
  const palette = activeTheme === 'light' ? lightColors : darkColors;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ color: palette.primaryText, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        SPOT
      </Text>
      <Text
        style={{
          color: palette.text,
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Щось пішло не так / Something went wrong
      </Text>
      <Text
        style={{
          color: palette.secondary,
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        {error?.message || 'Unexpected application error'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        onPress={retry}
        style={{
          backgroundColor: palette.primary,
          paddingHorizontal: 24,
          paddingVertical: 14,
          borderRadius: 14,
        }}
      >
        <Text style={{ color: palette.onPrimary, fontSize: 15, fontWeight: '800' }}>
          Спробувати знову / Try Again
        </Text>
      </Pressable>
    </View>
  );
}

export default function SpotAppRoot() {
  const theme = useUserProfileStore((s) => s.profile.theme) ?? 'dark';
  const colors = useThemeColors();

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    const fontPromise = loadAsync({
      ...Ionicons.font,
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      Inter_800ExtraBold,
    })
      .then(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          document.documentElement.style.fontFamily =
            "'Inter_400Regular', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        }
      })
      .catch(() => undefined);

    const coreHydrationPromise = Promise.all([
      useUserProfileStore.getState().loadProfile().catch(() => undefined),
      loadOnboarding().catch(() => undefined),
      useWorkoutSessionStore.getState().hydrateSession().catch(() => undefined),
      useProgramStore.getState().loadProgram().catch(() => undefined),
      useCustomExercisesStore.getState().loadCustomExercises().catch(() => undefined),
      fontPromise,
    ]);

    const splashTimeout = new Promise<void>((resolve) => {
      setTimeout(resolve, 2500);
    });

    Promise.race([coreHydrationPromise, splashTimeout])
      .finally(() => {
        SplashScreen.hideAsync().catch(() => undefined);
      });

    // Deterministic order: initialize Purchases before Auth syncUser to avoid race condition
    useSubscriptionStore
      .getState()
      .init()
      .catch(() => undefined)
      .finally(() => {
        useAuthStore.getState().init().catch(() => undefined);
      });

    coreHydrationPromise
      .then(() => initNotifications())
      .then(() => {
        startLiveWorkoutNotificationSync();
        // Silent permission check on cold boot so Welcome screen is never hijacked by OS dialog
        return scheduleWorkoutDayReminders({ promptIfNeeded: false }).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

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
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
