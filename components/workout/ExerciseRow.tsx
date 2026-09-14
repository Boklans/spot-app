import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { Card } from '../ui/Card';

export function ExerciseRow({ name, muscle, sets, weight }: { name: string; muscle: string; sets: number; weight: string }) { return <Card style={styles.row}><View style={styles.number}><Text style={styles.numberText}>{sets}</Text><Text style={styles.caption}>SETS</Text></View><View style={styles.info}><Text style={styles.name}>{name}</Text><Text style={styles.muscle}>{muscle}</Text></View><Text style={styles.weight}>{weight}</Text></Card>; }
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md }, number: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' }, numberText: { color: colors.text, fontWeight: '800', fontSize: 16 }, caption: { color: colors.muted, fontSize: 8, fontWeight: '700' }, info: { flex: 1, marginLeft: spacing.md }, name: { color: colors.text, fontSize: 15, fontWeight: '700' }, muscle: { color: colors.secondary, marginTop: 4, fontSize: 12 }, weight: { color: colors.primary, fontWeight: '800', fontSize: 14 } });
