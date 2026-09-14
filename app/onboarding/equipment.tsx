import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { saveOnboarding } from '@/store/workoutStore';

const options = [{ value: 'full_gym', label: 'Full Gym' }, { value: 'dumbbells', label: 'Dumbbells' }, { value: 'barbell', label: 'Barbell' }, { value: 'machines', label: 'Machines' }, { value: 'bodyweight', label: 'Bodyweight' }];
export default function Equipment() { const [selected, setSelected] = useState(['full_gym']); const toggle = (item: string) => setSelected(selected.includes(item) ? selected.filter(value => value !== item) : [...selected, item]); return <Screen style={styles.screen}><Text style={styles.step}>04 / 04</Text><Text style={styles.title}>What equipment do you have</Text><Text style={styles.subtitle}>Select everything available to you.</Text><View style={styles.options}>{options.map((item) => <Pressable accessibilityRole="button" key={item.value} onPress={() => toggle(item.value)}><Card style={[styles.option, selected.includes(item.value) && styles.selected]}><Text style={styles.name}>{item.label}</Text><Text style={styles.check}>{selected.includes(item.value) ? '✓' : '+'}</Text></Card></Pressable>)}</View><Button onPress={async () => { await saveOnboarding({ equipment: selected }); router.push('/onboarding/program-ready'); }}>Build my plan</Button></Screen>; }
const styles = StyleSheet.create({ screen: { paddingTop: spacing.huge }, step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xl }, title: { color: colors.text, fontSize: 32, fontWeight: '800' }, subtitle: { color: colors.secondary, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xxl }, options: { gap: spacing.sm, flex: 1 }, option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, padding: spacing.lg }, selected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, name: { color: colors.text, fontSize: 16, fontWeight: '800' }, check: { color: colors.primary, fontSize: 23, fontWeight: '800' } });
