import { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function Screen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return <SafeAreaView style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}</SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, scroll: { flexGrow: 1 }, content: { flex: 1, padding: spacing.xl, paddingBottom: spacing.huge } },);
