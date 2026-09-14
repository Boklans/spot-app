import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { type OnboardingGoal, saveOnboarding } from '@/store/workoutStore';

const options: Array<{ value: OnboardingGoal; label: string; detail: string }> = [
	{ value: 'build_muscle', label: 'Build Muscle', detail: 'Build size & shape' },
	{ value: 'get_stronger', label: 'Get Stronger', detail: 'Increase strength' },
	{ value: 'lose_fat', label: 'Lose Fat', detail: 'Reduce body fat' },
	{ value: 'recomposition', label: 'Recomposition', detail: 'Build muscle while reducing fat' },
];

export default function Goal() {
	const [selected, setSelected] = useState<OnboardingGoal>('build_muscle');

	return <Screen style={styles.screen}><Text style={styles.step}>01 / 04</Text><Text style={styles.title}>What's your goal</Text><Text style={styles.subtitle}>We'll use this to build your training plan.</Text><View style={styles.options}>{options.map((option) => <Pressable accessibilityRole="button" key={option.value} onPress={() => setSelected(option.value)}><Card style={[styles.option, selected === option.value && styles.selected]}><Text style={styles.optionTap}>{option.label}<Text style={styles.detail}>{'\n'}{option.detail}</Text></Text><Text style={styles.check}>{selected === option.value ? '✓' : ''}</Text></Card></Pressable>)}</View><Button onPress={async () => { await saveOnboarding({ goal: selected }); router.push('/onboarding/experience'); }}>Continue</Button></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingTop: spacing.huge }, step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xl }, title: { color: colors.text, fontSize: 32, fontWeight: '800' }, subtitle: { color: colors.secondary, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xxl }, options: { gap: spacing.sm, flex: 1 }, option: { flexDirection: 'row', alignItems: 'center', minHeight: 78, padding: spacing.lg }, selected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, optionTap: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' }, detail: { color: colors.secondary, fontSize: 13, fontWeight: '400', lineHeight: 24 }, check: { color: colors.primary, fontSize: 22, fontWeight: '800' } });
