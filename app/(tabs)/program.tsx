import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { defaultOnboarding, loadOnboarding } from '@/store/workoutStore';

export default function Program() {
	const [program, setProgram] = useState<GeneratedProgram>(() => generateProgram(defaultOnboarding));
	useEffect(() => { loadOnboarding().then((data) => setProgram(generateProgram(data ?? defaultOnboarding))); }, []);

	return <Screen><View style={styles.header}><View><Text style={styles.eyebrow}>YOUR PROGRAM</Text><Text style={styles.title}>{program.name}</Text><Text style={styles.meta}>{program.daysPerWeek} days / week</Text></View><Text style={styles.edit}>EDIT</Text></View><Text style={styles.description}>{program.description}</Text>{program.workouts.map((workout, index) => <Pressable accessibilityRole="button" key={workout.id} onPress={() => router.push({ pathname: '/workout/preview', params: { workoutId: workout.id } })}><Card style={styles.card}><View style={styles.cardHead}><View><Text style={styles.number}>0{index + 1}  •  {workout.dayLabel}</Text><Text style={styles.name}>{workout.name}</Text></View><Text style={styles.arrow}>›</Text></View><View style={styles.muscles}>{workout.muscleGroups.map((muscle) => <View key={muscle} style={styles.pill}><Text style={styles.pillText}>{muscle}</Text></View>)}</View><View style={styles.exercises}>{workout.exercises.map((exercise) => <View key={exercise.name} style={styles.exercise}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.exerciseMeta}>{exercise.sets} sets  •  {exercise.targetRepRange}  •  {exercise.recommendedWeight ? `${exercise.recommendedWeight} kg` : 'Bodyweight'}</Text></View>)}</View></Card></Pressable>)}</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 8 }, meta: { color: colors.secondary, marginTop: 6 }, edit: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }, description: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xl }, card: { marginBottom: spacing.md }, cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, number: { color: colors.muted, fontSize: 11, fontWeight: '800' }, name: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 5 }, arrow: { color: colors.secondary, fontSize: 28 }, muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl }, pill: { backgroundColor: colors.elevated, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 }, pillText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, exercises: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, exercise: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.md }, exerciseName: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '700' }, exerciseMeta: { color: colors.secondary, fontSize: 11, textAlign: 'right' } });
