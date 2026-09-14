import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function SetRow({ number, reps, completed, active }: { number: number; reps: number; completed?: boolean; active?: boolean }) { return <View style={[styles.row, active && styles.active]}><Text style={styles.set}>SET {number}</Text><Text style={[styles.reps, completed && styles.done]}>{reps} reps</Text><Text style={[styles.status, completed && styles.done]}>{completed ? 'COMPLETED' : active ? 'ACTIVE' : 'UP NEXT'}</Text></View>; }
const styles = StyleSheet.create({ row: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, active: { backgroundColor: colors.primaryMuted, borderRadius: 12, borderBottomColor: 'transparent' }, set: { color: colors.secondary, fontSize: 12, fontWeight: '800', width: 72 }, reps: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }, status: { color: colors.muted, fontSize: 10, fontWeight: '800' }, done: { color: colors.primary } });
