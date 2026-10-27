import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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

	useEffect(() => {
		let mounted = true;
		Promise.all([
			loadOnboarding(),
			useWorkoutSessionStore.getState().hydrateSession(),
			useProgramStore.getState().loadProgram(),
		]).then(([data]) => {
			if (!mounted) return;
			router.replace(data?.completed ? '/(tabs)' : '/onboarding/welcome');
		}).catch(() => {
			if (!mounted) return;
			router.replace('/onboarding/welcome');
		});

		return () => { mounted = false; };
	}, []);

	return (
		<Screen scroll={false} style={styles.loading}>
			<View style={styles.logoRow}>
				<Text style={styles.logoPrimaryText}>SP</Text>
				<Text style={styles.logoLime}>O</Text>
				<Text style={styles.logoPrimaryText}>T</Text>
			</View>
			<ActivityIndicator
				size="small"
				color={colors.isDark ? colors.primary : colors.primaryText}
				style={styles.spinner}
			/>
			<Text style={styles.message}>
				{isUk ? 'Підготовка вашої програми...' : 'Loading your training...'}
			</Text>
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

