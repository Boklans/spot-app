import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) { return <View style={[styles.card, style]}>{children}</View>; }
const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, borderWidth: 1, borderColor: colors.border } });
