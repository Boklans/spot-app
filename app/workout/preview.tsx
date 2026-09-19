import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { formatWeight } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Preview() {
	const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
	const initializeSession = useWorkoutSessionStore((state) => state.initializeSession);
	const activeSession = useWorkoutSessionStore((state) => state.session);
	const activeRestEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
	const progress = useProgramProgressStore((state) => state.progress);
	const program = useProgramStore((state) => state.program);

	useEffect(() => {
		useProgramStore.getState().loadProgram();
	}, []);

	const selectedId = typeof workoutId === 'string' ? workoutId : undefined;
	const scheduledWorkout = getScheduledWorkout(program, progress);
	const workout = program.workouts.find((item) => item.id === selectedId) ?? scheduledWorkout;
	const isOffRotation = selectedId !== undefined && workout.id !== scheduledWorkout.id;

	const startWorkout = async () => {
		if (activeSession && !activeSession.completed) {
			const resume = () => router.replace(activeRestEndsAt !== null ? '/workout/rest' : '/workout/active');
			Alert.alert('ACTIVE WORKOUT', 'You already have a workout in progress.', [
				{ text: 'CANCEL', style: 'cancel' },
				{ text: 'RESUME', onPress: resume },
				{ text: 'START NEW', style: 'destructive', onPress: async () => { await initializeSession(workout); router.replace('/workout/active'); } },
			]);
			return;
		}
		await initializeSession(workout);
		router.replace('/workout/active');
	};

	return <Screen>
		<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹  HOME</Text></Pressable>
		<View style={styles.header}><Text style={styles.title}>{workout.name}</Text><Text style={styles.meta}>{workout.exercises.length} exercises  •  ~{workout.estimatedMinutes} min</Text></View>
		{isOffRotation ? (
			<Card style={styles.offRotationBanner}>
				<Text style={styles.offRotationLabel}>OFF-ROTATION WORKOUT</Text>
				<Text style={styles.offRotationText}>Your scheduled next workout is {scheduledWorkout.name}. Completing this workout will rotate your program forward from here.</Text>
			</Card>
		) : (
			<View style={styles.rotationBadge}><Text style={styles.rotationBadgeText}>UP NEXT IN ROTATION</Text></View>
		)}
		<Text style={styles.section}>TODAY'S PLAN</Text>
		{workout.exercises.map((exercise) => <ExerciseRow key={exercise.name} name={exercise.name} muscle={exercise.muscleGroup} sets={exercise.sets} weight={exercise.recommendedWeight ? `${formatWeight(exercise.recommendedWeight)} kg` : 'Bodyweight'} />)}
		<View style={styles.bottom}><Button onPress={startWorkout}>START WORKOUT</Button></View>
	</Screen>;
}

const styles = StyleSheet.create({ backButton: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.lg }, back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, header: { marginBottom: spacing.xl }, title: { color: colors.text, fontSize: 36, fontWeight: '800' }, meta: { color: colors.secondary, marginTop: spacing.sm }, rotationBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8, marginBottom: spacing.md }, rotationBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, offRotationBanner: { marginBottom: spacing.lg, backgroundColor: colors.elevated, borderColor: '#F59E0B' }, offRotationLabel: { color: '#F59E0B', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 }, offRotationText: { color: colors.secondary, fontSize: 13, lineHeight: 18 }, section: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.md }, bottom: { marginTop: spacing.lg } });
