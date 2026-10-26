import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
