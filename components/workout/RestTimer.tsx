import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';

export function RestTimer({ seconds }: { seconds: number }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]); const minutes = Math.floor(seconds / 60).toString().padStart(2, '0'); const rest = (seconds % 60).toString().padStart(2, '0'); return <View style={styles.wrap}><Text style={styles.time}>{minutes}:{rest}</Text><Text style={styles.label}>REST TIME</Text></View>; }
const createStyles = (colors: ThemeColors) => StyleSheet.create({ wrap: { alignItems: 'center', paddingVertical: 30 }, time: { color: colors.text, ...typography.display, letterSpacing: 1 }, label: { color: colors.secondary, ...typography.eyebrow, marginTop: 8 } });
