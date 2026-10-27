import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { darkColors, type ThemeColors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { AuthModal } from '@/components/auth/AuthModal';
import { loadOnboarding } from '@/store/workoutStore';
import { useProgramStore } from '@/store/programStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Welcome() {
  const colors = darkColors;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, language } = useI18n();
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  // Entrance & ambient animations
  const heroScale = useRef(new Animated.Value(1.1)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(28)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(20)).current;
  const chipsOpacity = useRef(new Animated.Value(0)).current;
  const chipsTranslateY = useRef(new Animated.Value(18)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(32)).current;
  const oPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(110, [
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(logoTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 65,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            tension: 65,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(taglineTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 65,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(chipsOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(chipsTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 65,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(actionsOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(actionsTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(oPulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(oPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [
    actionsOpacity,
    actionsTranslateY,
    chipsOpacity,
    chipsTranslateY,
    heroOpacity,
    heroScale,
    logoOpacity,
    logoScale,
    logoTranslateY,
    oPulse,
    taglineOpacity,
    taglineTranslateY,
  ]);

  const handleGetStarted = () => {
    hapticMedium();
    useWorkoutSessionStore.getState().clearSession();
    void useWorkoutHistoryStore.getState().clearHistory();
    router.push('/onboarding/params');
  };

  const handleLogin = () => {
    hapticMedium();
    setAuthModalVisible(true);
  };

  const handleAuthSuccess = async (authMode?: 'signin' | 'signup') => {
    setAuthModalVisible(false);

    // Brand new sign-up: ALWAYS go to onboarding questionnaire
    if (authMode === 'signup') {
      router.push('/onboarding/params');
      return;
    }

    // Existing sign-in: verify if user has a real completed program
    const onboarding = await loadOnboarding();
    const program = useProgramStore.getState().program;

    const hasCompletedProgram =
      Boolean(onboarding?.completed) &&
      Boolean(program && Array.isArray(program.workouts) && program.workouts.length > 0);

    if (hasCompletedProgram) {
      router.replace('/(tabs)');
    } else {
      router.push('/onboarding/params');
    }
  };

  const setLang = (lang: 'en' | 'uk') => {
    if (language !== lang) {
      hapticLight();
      updateProfile({ language: lang });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        {...({ translucent: true, backgroundColor: 'transparent' } as any)}
      />

      {/* 1. Hero Athlete Background Photo with Zoom-Out Animation */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: heroOpacity,
            transform: [{ scale: heroScale }],
          },
        ]}
      >
        <Image
          source={require('@/assets/welcome_hero.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={
            colors.isDark
              ? [
                  'rgba(0, 0, 0, 0)',
                  'rgba(0, 0, 0, 0.2)',
                  'rgba(0, 0, 0, 0.6)',
                  'rgba(0, 0, 0, 0.92)',
                  '#000000',
                ]
              : [
                  'rgba(242, 244, 248, 0.15)',
                  'rgba(242, 244, 248, 0.35)',
                  'rgba(242, 244, 248, 0.75)',
                  'rgba(242, 244, 248, 0.96)',
                  '#F2F4F8',
                ]
          }
          locations={[0, 0.35, 0.65, 0.88, 1.0]}
          style={styles.gradientOverlay}
        />
      </Animated.View>

      {/* 2. Top Controls: Theme Toggle + Language Selector (EN / UA) */}
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topControlsRow}>

          <View style={styles.langRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch to English"
              onPress={() => setLang('en')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                EN
              </Text>
            </Pressable>
            <Text style={styles.langDivider}>/</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Перемкнути на українську"
              onPress={() => setLang('uk')}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
            >
              <Text style={[styles.langText, language === 'uk' && styles.langTextActive]}>
                UA
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* 3. Staggered Animated Content & Actions */}
      <SafeAreaView style={styles.safeContent}>
        <View style={styles.centerBlock}>
          <Animated.View
            style={[
              styles.logoRow,
              {
                opacity: logoOpacity,
                transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
              },
            ]}
          >
            <Text style={styles.logoPrimaryText}>SP</Text>
            <Animated.Text
              style={[
                styles.logoLime,
                { transform: [{ scale: oPulse }] },
              ]}
            >
              O
            </Animated.Text>
            <Text style={styles.logoPrimaryText}>T</Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.tagline,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslateY }],
              },
            ]}
          >
            {t('welcomeTagline')}
          </Animated.Text>

          <Animated.View
            style={[
              styles.pillarsRow,
              {
                opacity: chipsOpacity,
                transform: [{ translateY: chipsTranslateY }],
              },
            ]}
          >
            {(language === 'uk'
              ? ['Автопідбір ваг', 'Живий таймер у шторці', 'Аналітика 1RM']
              : ['Smart Loads', 'Live Shade Timer', '1RM Analytics']
            ).map((pillar) => (
              <View key={pillar} style={styles.pillarChip}>
                <View style={styles.pillarDot} />
                <Text style={styles.pillarText}>{pillar}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* 4. Bottom Actions */}
        <Animated.View
          style={[
            styles.actions,
            {
              opacity: actionsOpacity,
              transform: [{ translateY: actionsTranslateY }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.getStartedBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.getStartedBtnText}>{t('getStarted')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log in"
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.loginBtnText}>{t('logIn')}</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Cloud Auth / Sign In Modal */}
      <AuthModal
        visible={authModalVisible}
        initialMode="signin"
        onClose={() => setAuthModalVisible(false)}
        onSuccess={handleAuthSuccess}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.isDark ? '#000000' : colors.background,
    },
    imageContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 52 : 28,
      left: 0,
      right: 0,
      height: SCREEN_HEIGHT * 0.62,
    },
    heroImage: {
      width: '100%',
      height: '100%',
      opacity: colors.isDark ? 0.54 : 0.32,
    },
    gradientOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '85%',
    },
    safeTop: {
      zIndex: 10,
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? 36 : 12,
    },
    topControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)',
      borderWidth: 1,
      borderColor: colors.isDark ? 'rgba(255,255,255,0.12)' : colors.border,
    },
    langText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.isDark ? 'rgba(255, 255, 255, 0.45)' : colors.muted,
      letterSpacing: 0.8,
    },
    langTextActive: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    langDivider: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.isDark ? 'rgba(255, 255, 255, 0.2)' : colors.border,
    },
    safeContent: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    },
    centerBlock: {
      alignItems: 'center',
      marginBottom: 68,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    logoPrimaryText: {
      color: colors.text,
      fontSize: 96,
      fontWeight: '900',
      fontStyle: 'italic',
      letterSpacing: 2,
    },
    logoLime: {
      color: colors.isDark ? colors.primary : '#16A34A',
      fontSize: 96,
      fontWeight: '900',
      fontStyle: 'italic',
      letterSpacing: 2,
      paddingHorizontal: 28,
      marginHorizontal: -28,
      paddingVertical: 18,
      marginVertical: -18,
      textAlign: 'center',
      textShadowColor: colors.isDark ? 'rgba(200, 255, 61, 0.45)' : 'rgba(22, 163, 74, 0.25)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 18,
    },
    tagline: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 33,
      textAlign: 'center',
      letterSpacing: -0.3,
      opacity: 0.95,
    },
    pillarsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 18,
    },
    pillarChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
      borderWidth: 1,
      borderColor: colors.isDark ? 'rgba(255,255,255,0.12)' : colors.border,
    },
    pillarDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.isDark ? colors.primary : '#16A34A',
    },
    pillarText: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    actions: {
      width: '100%',
      gap: 12,
      alignItems: 'center',
    },
    getStartedBtn: {
      width: '85%',
      maxWidth: 320,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.isDark ? colors.primary : '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.35 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    btnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    getStartedBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    loginBtn: {
      paddingVertical: 8,
      paddingHorizontal: 24,
    },
    loginBtnText: {
      color: colors.secondary,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
  });
