import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { type OnboardingExperience, saveOnboarding } from '@/store/workoutStore';

const options: Array<{ value: OnboardingExperience; label: string; detail: string }> = [
	{ value: 'beginner', label: 'Beginner', detail: 'Less than 6 months' },
	{ value: 'intermediate', label: 'Intermediate', detail: '6 months – 3 years' },
	{ value: 'advanced', label: 'Advanced', detail: '3+ years' },
];

export default function Experience() {
	const [selected, setSelected] = useState<OnboardingExperience>('intermediate');

	return <Screen style={styles.screen}><Text style={styles.step}>02 / 04</Text><Text style={styles.title}>What's your experience</Text><Text style={styles.subtitle}>How long have you been training consistently?</Text><View style={styles.options}>{options.map((option) => <Pressable accessibilityRole="button" key={option.value} onPress={() => setSelected(option.value)}><Card style={[styles.option, selected === option.value && styles.selected]}><Text style={styles.optionTap}>{option.label}<Text style={styles.detail}>{'\n'}{option.detail}</Text></Text><Text style={styles.check}>{selected === option.value ? '✓' : ''}</Text></Card></Pressable>)}</View><Button onPress={async () => { await saveOnboarding({ experience: selected }); router.push('/onboarding/frequency'); }}>Continue</Button></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingTop: spacing.huge }, step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xl }, title: { color: colors.text, fontSize: 32, fontWeight: '800' }, subtitle: { color: colors.secondary, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xxl }, options: { gap: spacing.sm, flex: 1 }, option: { flexDirection: 'row', alignItems: 'center', minHeight: 78, padding: spacing.lg }, selected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, optionTap: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' }, detail: { color: colors.secondary, fontSize: 13, fontWeight: '400', lineHeight: 24 }, check: { color: colors.primary, fontSize: 22, fontWeight: '800' } });
