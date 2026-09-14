import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function Button({ children, onPress, secondary = false }: PropsWithChildren<{ onPress?: () => void; secondary?: boolean }>) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.base, secondary && styles.secondary, pressed && styles.pressed]}><Text style={[styles.text, secondary && styles.secondaryText]}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 56, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }, secondary: { backgroundColor: 'transparent' }, pressed: { opacity: 0.72 }, text: { color: colors.background, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }, secondaryText: { color: colors.secondary, fontWeight: '600' } });
