import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Welcome() {
  const { t } = useI18n();

  const handleGetStarted = () => {
    hapticMedium();
    router.push('/onboarding/goal');
  };

  const handleLogin = () => {
    hapticMedium();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Hero Athlete Background Photo */}
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/welcome_hero.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        {/* Smooth gradient seamlessly melting into pure black */}
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0)',
            'rgba(0, 0, 0, 0.2)',
            'rgba(0, 0, 0, 0.6)',
            'rgba(0, 0, 0, 0.92)',
            '#000000',
          ]}
          locations={[0, 0.35, 0.65, 0.88, 1.0]}
          style={styles.gradientOverlay}
        />
      </View>

      {/* 2. Content & Actions (weighted towards the bottom, below center) */}
      <SafeAreaView style={styles.safeContent}>
        <View style={styles.centerBlock}>
          {/* Stylized Brand Logo: SP (white) + O (neon lime) + T (white) */}
          <View style={styles.logoRow}>
            <Text style={styles.logoWhite}>SP</Text>
            <Text style={styles.logoLime}>O</Text>
            <Text style={styles.logoWhite}>T</Text>
          </View>

          {/* Centered Tagline */}
          <Text style={styles.tagline}>{t('welcomeTagline')}</Text>
        </View>

        {/* 3. Bottom Actions */}
        <View style={styles.actions}>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    opacity: 0.42, // Subdued atmospheric silhouette, secondary to UI
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '85%',
  },
  safeContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 20 : 28,
  },
  centerBlock: {
    alignItems: 'center',
    marginBottom: 88, // Lifted slightly higher
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoWhite: {
    color: '#FFFFFF',
    fontSize: 96,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  logoLime: {
    color: colors.primary,
    fontSize: 96,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
    textShadowColor: 'rgba(200, 255, 61, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 33,
    textAlign: 'center',
    letterSpacing: -0.3,
    opacity: 0.95,
  },
  actions: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  getStartedBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  getStartedBtnText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  loginBtn: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  loginBtnText: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
