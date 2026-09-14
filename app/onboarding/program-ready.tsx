import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { defaultOnboarding, loadOnboarding, saveOnboarding, type OnboardingData } from '@/store/workoutStore';

const goalLabels: Record<OnboardingData['goal'], string> = { build_muscle: 'Build Muscle', get_stronger: 'Get Stronger', lose_fat: 'Lose Fat', recomposition: 'Recomposition' };

export default function ProgramReady() {
	const [onboarding, setOnboarding] = useState(defaultOnboarding);
	const [program, setProgram] = useState<GeneratedProgram>(() => generateProgram(defaultOnboarding));

	useEffect(() => { loadOnboarding().then((data) => { const next = data ?? defaultOnboarding; setOnboarding(next); setProgram(generateProgram(next)); }); }, []);

	return <Screen style={styles.screen}><View style={styles.top}><Text style={styles.eyebrow}>YOUR PLAN IS READY</Text><Text style={styles.title}>{program.name}</Text><Text style={styles.meta}>{program.daysPerWeek} DAYS / WEEK  •  BUILT FOR {goalLabels[onboarding.goal].toUpperCase()}</Text></View><Text style={styles.section}>YOUR WEEK</Text>{program.workouts.map((workout) => <Card key={workout.id} style={styles.day}><Text style={styles.dayName}>{workout.dayLabel}</Text><View style={styles.dayInfo}><Text style={styles.workout}>{workout.name}</Text><Text style={styles.focus}>{workout.muscleGroups.join(' • ')}</Text></View></Card>)}<Text style={styles.duration}>~{program.estimatedWorkoutMinutes} min <Text style={styles.muted}>workout</Text></Text><Button onPress={async () => { await saveOnboarding({ completed: true }); router.replace('/(tabs)'); }}>Start training</Button></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingTop: spacing.huge }, top: { marginBottom: spacing.huge }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: spacing.lg }, title: { color: colors.text, fontSize: 38, fontWeight: '800' }, accent: { color: colors.primary }, meta: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginTop: spacing.md, letterSpacing: .7 }, section: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: spacing.md }, day: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md }, dayName: { color: colors.primary, width: 48, fontSize: 12, fontWeight: '900' }, dayInfo: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.md }, workout: { color: colors.text, fontSize: 16, fontWeight: '800' }, focus: { color: colors.secondary, marginTop: 4, fontSize: 12 }, duration: { color: colors.text, fontSize: 16, fontWeight: '800', marginVertical: spacing.xl }, muted: { color: colors.secondary, fontWeight: '400' } });
