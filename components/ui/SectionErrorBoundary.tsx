import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';

interface InnerProps {
  children: ReactNode;
  colors: ThemeColors;
  fallbackTitle?: string;
}

interface InnerState {
  hasError: boolean;
}

class SectionErrorBoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { hasError: false };

  static getDerivedStateFromError(): InnerState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Isolated section crash — prevented from crashing the parent screen
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { colors, fallbackTitle } = this.props;
    return (
      <View
        style={[
          styles.fallbackCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
        <Text style={[styles.title, { color: colors.text }]}>
          {fallbackTitle || 'Chart temporarily unavailable'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.handleRetry}
          style={[
            styles.retryBtn,
            { backgroundColor: colors.elevated, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }
}

export function SectionErrorBoundary({
  children,
  fallbackTitle,
}: {
  children: ReactNode;
  fallbackTitle?: string;
}) {
  const colors = useThemeColors();
  return (
    <SectionErrorBoundaryInner colors={colors} fallbackTitle={fallbackTitle}>
      {children}
    </SectionErrorBoundaryInner>
  );
}

const styles = StyleSheet.create({
  fallbackCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: 2,
  },
  retryText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
