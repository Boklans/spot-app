import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Card } from './Card';

export function StatCard({
  value,
  label,
  accent,
  style,
}: {
  value: string;
  label: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const accentColor = accent ?? colors.primaryText;

  return (
    <Card style={[styles.card, style]}>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 96, justifyContent: 'space-between', marginRight: spacing.sm },
  value: { ...typography.h2, fontWeight: '700' },
  label: { ...typography.eyebrow, letterSpacing: 0.7 },
});
