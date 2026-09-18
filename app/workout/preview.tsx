import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ExerciseRow } from '@/components/workout/ExerciseRow';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { formatWeight } from '@/lib/weightUtils';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Preview() {
	const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
	const initializeSession = useWorkoutSessionStore((state) => state.initializeSession);
	const activeSession = useWorkoutSessionStore((state) => state.session);
	const activeRestEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
	const progress = useProgramProgressStore((state) => state.progress);
	const [program, setProgram] = useState<GeneratedProgram>(() => generateProgram(defaultOnboarding));

	useEffect(() => {
		loadOnboarding().then((data) => {
			const prog = generateProgram(data ?? defaultOnboarding);
			setProgram(prog);
			useProgramProgressStore.getState().loadProgress(prog);
		});
	}, []);

	const selectedId = typeof workoutId === 'string' ? workoutId : undefined;
	const rotationIndex = progress && progress.programId === program.id ? progress.nextSequenceIndex : 0;
	const safeIndex = rotationIndex >= 0 && rotationIndex < program.workouts.length ? rotationIndex : 0;
	const workout = program.workouts.find((item) => item.id === selectedId) ?? (program.workouts[safeIndex] ?? program.workouts[0]);

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
		<Text style={styles.section}>TODAY'S PLAN</Text>
		{workout.exercises.map((exercise) => <ExerciseRow key={exercise.name} name={exercise.name} muscle={exercise.muscleGroup} sets={exercise.sets} weight={exercise.recommendedWeight ? `${formatWeight(exercise.recommendedWeight)} kg` : 'Bodyweight'} />)}
		<View style={styles.bottom}><Button onPress={startWorkout}>START WORKOUT</Button></View>
	</Screen>;
}

const styles = StyleSheet.create({ backButton: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.lg }, back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, header: { marginBottom: spacing.xxl }, title: { color: colors.text, fontSize: 36, fontWeight: '800' }, meta: { color: colors.secondary, marginTop: spacing.sm }, section: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.md }, bottom: { marginTop: spacing.lg } });
