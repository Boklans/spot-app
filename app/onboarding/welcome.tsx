import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';

export default function Welcome() { return <Screen scroll={false} style={styles.screen}><View style={styles.mark}><Text style={styles.logo}>SPOT</Text><View style={styles.line} /></View><View style={styles.hero}><Text style={styles.eyebrow}>ADAPTIVE TRAINING</Text><Text style={styles.title}>Train smarter.{"\n"}<Text style={styles.accent}>Progress automatically.</Text></Text><Text style={styles.body}>A focused training system that remembers your work and helps you make the next session count.</Text></View><View style={styles.actions}><Button onPress={() => router.push('/onboarding/goal')}>Get started</Button><Button secondary onPress={() => router.replace('/(tabs)')}>Log in</Button></View></Screen>; }
const styles = StyleSheet.create({ screen: { justifyContent: 'space-between', paddingTop: spacing.huge }, mark: { flexDirection: 'row', alignItems: 'center' }, logo: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 4 }, line: { height: 1, backgroundColor: colors.primary, width: 38, marginLeft: spacing.md }, hero: { marginTop: 80 }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: spacing.lg }, title: { color: colors.text, fontSize: typography.display, lineHeight: 52, fontWeight: '800', letterSpacing: -1 }, accent: { color: colors.primary }, body: { color: colors.secondary, fontSize: 16, lineHeight: 25, marginTop: spacing.xl, maxWidth: 330 }, actions: { gap: spacing.sm } });
