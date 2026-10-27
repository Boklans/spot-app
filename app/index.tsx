import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useI18n } from '@/lib/i18n';
import { useProgramStore } from '@/store/programStore';
import { loadOnboarding } from '@/store/workoutStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Index() {
	const colors = useThemeColors();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const { language } = useI18n();
	const isUk = language === 'uk';

	const logoScale = useRef(new Animated.Value(0.75)).current;
	const logoOpacity = useRef(new Animated.Value(0)).current;
	const subTranslateY = useRef(new Animated.Value(16)).current;
	const subOpacity = useRef(new Animated.Value(0)).current;
	const pulseScale = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		let mounted = true;

		Animated.sequence([
			Animated.parallel([
				Animated.spring(logoScale, {
					toValue: 1,
					friction: 6,
					tension: 65,
					useNativeDriver: true,
				}),
				Animated.timing(logoOpacity, {
					toValue: 1,
					duration: 380,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]),
			Animated.parallel([
				Animated.timing(subOpacity, {
					toValue: 1,
					duration: 280,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.spring(subTranslateY, {
					toValue: 0,
					friction: 7,
					tension: 70,
					useNativeDriver: true,
				}),
			]),
		]).start();

		const pulseLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulseScale, {
					toValue: 1.12,
					duration: 650,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
				Animated.timing(pulseScale, {
					toValue: 1,
					duration: 650,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
			])
		);
		pulseLoop.start();

		const minSplashDelay = new Promise((resolve) => setTimeout(resolve, 750));

		Promise.all([
			loadOnboarding(),
			useWorkoutSessionStore.getState().hydrateSession(),
			useProgramStore.getState().loadProgram(),
			minSplashDelay,
		]).then(([data]) => {
			if (!mounted) return;
			router.replace(data?.completed ? '/(tabs)' : '/onboarding/welcome');
		}).catch(() => {
			if (!mounted) return;
			router.replace('/onboarding/welcome');
		});

		return () => {
			mounted = false;
			pulseLoop.stop();
		};
	}, [logoOpacity, logoScale, pulseScale, subOpacity, subTranslateY]);

	return (
		<Screen scroll={false} style={styles.loading}>
			<Animated.View
				style={[
					styles.logoRow,
					{
						opacity: logoOpacity,
						transform: [{ scale: logoScale }],
					},
				]}
			>
				<Text style={styles.logoPrimaryText}>SP</Text>
				<Animated.Text
					style={[
						styles.logoLime,
						{ transform: [{ scale: pulseScale }] },
					]}
				>
					O
				</Animated.Text>
				<Text style={styles.logoPrimaryText}>T</Text>
			</Animated.View>

			<Animated.View
				style={{
					alignItems: 'center',
					opacity: subOpacity,
					transform: [{ translateY: subTranslateY }],
				}}
			>
				<ActivityIndicator
					size="small"
					color={colors.isDark ? colors.primary : colors.primaryText}
					style={styles.spinner}
				/>
				<Text style={styles.message}>
					{isUk ? 'Підготовка вашої програми...' : 'Loading your training...'}
				</Text>
			</Animated.View>
		</Screen>
	);
}

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
		loading: { alignItems: 'center', justifyContent: 'center' },
		logoRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
		},
		logoPrimaryText: {
			color: colors.text,
			fontSize: 56,
			fontWeight: '900',
			fontStyle: 'italic',
			letterSpacing: 2,
		},
		logoLime: {
			color: colors.isDark ? colors.primary : '#16A34A',
			fontSize: 56,
			fontWeight: '900',
			fontStyle: 'italic',
			letterSpacing: 2,
			textShadowColor: colors.isDark ? 'rgba(200, 255, 61, 0.55)' : 'rgba(22, 163, 74, 0.25)',
			textShadowOffset: { width: 0, height: 0 },
			textShadowRadius: 18,
		},
		spinner: {
			marginTop: spacing.lg,
		},
		message: {
			color: colors.secondary,
			fontSize: 13,
			fontWeight: '600',
			marginTop: spacing.sm,
			letterSpacing: 0.2,
		},
	});
