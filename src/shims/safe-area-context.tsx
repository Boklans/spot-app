import React, { forwardRef } from 'react';
import { View, type ViewProps } from './react-native';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useSafeAreaInsets(): EdgeInsets {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export interface SafeAreaViewProps extends ViewProps {
  edges?: readonly ('top' | 'right' | 'bottom' | 'left')[];
}

export const SafeAreaView = forwardRef<HTMLDivElement, SafeAreaViewProps>(function SafeAreaView(
  { edges: _edges, ...rest },
  ref
) {
  return <View ref={ref} {...rest} />;
});

export function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
