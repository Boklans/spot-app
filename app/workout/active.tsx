import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SetRow } from '@/components/workout/SetRow';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { formatWeight } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Active() {
	const session = useWorkoutSessionStore((state) => state.session);
	const completeCurrentSet = useWorkoutSessionStore((state) => state.completeCurrentSet);
	const [finishing, setFinishing] = useState(false);

	if (!session) {
		return <Screen><Text style={styles.empty}>No active workout.</Text><Button onPress={() => router.replace('/workout/preview')}>BACK TO WORKOUT</Button></Screen>;
	}

	const exercise = session.exercises[session.currentExerciseIndex];
	const activeSet = exercise.sets[session.currentSetIndex];
	const progress = getSessionProgress(session);
	const isFinalSet = session.currentSetIndex === exercise.sets.length - 1;
	const isFinalExercise = session.currentExerciseIndex === session.exercises.length - 1;
	const exitWorkout = () => router.replace('/(tabs)');
	const handleClose = () => {
		if (progress.completedSets === 0) {
			exitWorkout();
			return;
		}
		Alert.alert('ABANDON WORKOUT?', 'Your current workout progress will be saved so you can resume it later.', [
			{ text: 'KEEP WORKOUT', style: 'cancel' },
			{ text: 'EXIT WORKOUT', style: 'destructive', onPress: exitWorkout },
		]);
	};

	const finishSet = async () => {
		if (finishing) return;
		completeCurrentSet();
		if (isFinalSet && isFinalExercise) {
			setFinishing(true);
			const completedSession = useWorkoutSessionStore.getState().session;
			try {
				if (completedSession) await finalizeWorkoutSession(completedSession);
				router.replace('/workout/complete');
			} catch {
				setFinishing(false);
				Alert.alert('Could not save workout', 'Your workout is still on this device. Try saving again.');
			}
		} else {
			router.push('/workout/rest');
		}
	};

	return <Screen>
		<View style={styles.header}>
			<Pressable accessibilityRole="button" hitSlop={12} onPress={handleClose} style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable>
			<View style={styles.headCenter}><Text style={styles.title}>{session.workoutName}</Text><Text style={styles.progress}>EXERCISE {session.currentExerciseIndex + 1} / {session.exercises.length}</Text></View>
			<Text style={styles.percent}>{Math.round(progress.percentage)}%</Text>
		</View>
		<ProgressBar value={progress.percentage} />
		<View style={styles.exerciseHead}><Text style={styles.exercise}>{exercise.name.toUpperCase()}</Text><Text style={styles.muscle}>{exercise.muscleGroup.toUpperCase()}</Text></View>
		<View style={styles.setIdentity}><Text style={styles.setNumber}>SET {session.currentSetIndex + 1} OF {exercise.sets.length}</Text><Text style={styles.setProgress}>{progress.completedSets} OF {progress.totalSets} TOTAL SETS</Text></View>
		<View style={styles.today}><Text style={styles.label}>TODAY'S TARGET</Text><Text style={styles.weight}>{activeSet.weight ? formatWeight(activeSet.weight) : 'BODYWEIGHT'}{activeSet.weight ? <Text style={styles.unit}> KG</Text> : null}</Text><Text style={styles.target}>{activeSet.targetReps} REPS</Text><Text style={styles.recommendation}>{exercise.recommendation.explanation}</Text></View>
		<View style={styles.previous}><Text style={styles.label}>PREVIOUS</Text><Text style={styles.previousValue}>{exercise.previousSets.length > 0 ? exercise.previousSets.map((set) => `${set.weight ? `${formatWeight(set.weight)} kg` : 'Bodyweight'} × ${set.reps}`).join('   ') : 'No previous performance'}</Text></View>
		<Card style={styles.sets}>{exercise.sets.map((set, index) => <SetRow key={set.id} number={index + 1} reps={set.reps} active={index === session.currentSetIndex} completed={set.completed} />)}</Card>
		<Button disabled={finishing} onPress={finishSet}>{finishing ? 'SAVING WORKOUT' : isFinalSet && isFinalExercise ? 'FINISH WORKOUT' : 'COMPLETE SET'}</Button>
		<Pressable accessibilityRole="button" onPress={() => router.push('/workout/input')} style={styles.adjustButton}><Text style={styles.adjust}>ADJUST WEIGHT & REPS</Text></Pressable>
	</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }, closeButton: { width: 40, minHeight: 44, justifyContent: 'center' }, close: { color: colors.secondary, fontSize: 30, fontWeight: '300' }, headCenter: { alignItems: 'center' }, title: { color: colors.text, fontSize: 18, fontWeight: '800' }, progress: { color: colors.secondary, fontSize: 10, letterSpacing: 1, marginTop: 5 }, percent: { color: colors.primary, fontSize: 13, fontWeight: '800', width: 50, textAlign: 'right' }, exerciseHead: { marginTop: spacing.xxl, marginBottom: spacing.lg }, exercise: { color: colors.text, fontSize: 28, fontWeight: '900' }, muscle: { color: colors.primary, fontSize: 11, letterSpacing: 1.3, fontWeight: '800', marginTop: 7 }, setIdentity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }, setNumber: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }, setProgress: { color: colors.secondary, fontSize: 10, fontWeight: '800' }, previous: { paddingVertical: spacing.md, marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }, label: { color: colors.secondary, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }, previousValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.sm }, today: { marginBottom: spacing.lg }, weight: { color: colors.text, fontSize: 46, fontWeight: '900', marginTop: spacing.sm }, unit: { color: colors.secondary, fontSize: 13 }, target: { color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 4 }, recommendation: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md }, sets: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.lg }, adjustButton: { alignItems: 'center', minHeight: 52, justifyContent: 'center', marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }, adjust: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });
