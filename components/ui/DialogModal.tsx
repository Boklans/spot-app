import React, { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DialogModalProps {
  visible: boolean;
  onClose: () => void;
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Centered Dialog Modal with decoupled backdrop fade and 0.95 -> 1.0 tactile card spring.
 */
export function DialogModal({
  visible,
  onClose,
  cardStyle,
  children,
}: PropsWithChildren<DialogModalProps>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reducedMotion) {
        opacity.setValue(1);
        scale.setValue(1);
        return;
      }
      opacity.setValue(0);
      scale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 24,
          stiffness: 340,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      if (reducedMotion) {
        opacity.setValue(0);
        setMounted(false);
        return;
      }
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, reducedMotion, opacity, scale]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
            },
            cardStyle,
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlayBackdrop,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 20,
      ...cardElevation(colors),
    },
  });
