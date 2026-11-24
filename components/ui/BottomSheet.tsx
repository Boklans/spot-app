import React, { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional override for sheet surface background (default: colors.surface) */
  backgroundColor?: string;
  maxHeight?: ViewStyle['maxHeight'];
  showHandle?: boolean;
}

/**
 * Native-feeling BottomSheet with decoupled backdrop fade and spring sheet entry/exit.
 * Uses `useNativeDriver: true` exclusively and honors OS Reduce Motion.
 */
export function BottomSheet({
  visible,
  onClose,
  backgroundColor,
  maxHeight = '88%',
  showHandle = true,
  children,
}: PropsWithChildren<BottomSheetProps>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.55)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reducedMotion) {
        backdropOpacity.setValue(1);
        sheetTranslateY.setValue(0);
        return;
      }
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(Math.min(440, SCREEN_HEIGHT * 0.55));
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 26,
          stiffness: 290,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      if (reducedMotion) {
        backdropOpacity.setValue(0);
        sheetTranslateY.setValue(440);
        setMounted(false);
        return;
      }
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: Math.min(440, SCREEN_HEIGHT * 0.55),
          duration: 190,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, reducedMotion, backdropOpacity, sheetTranslateY]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close modal" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              maxHeight,
              backgroundColor: backgroundColor ?? colors.surface,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <SafeAreaView edges={['bottom']} style={styles.safeInner}>
            {showHandle ? (
              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>
            ) : null}
            {children}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
    },
    sheetContainer: {
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      overflow: 'hidden',
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    safeInner: {
      maxHeight: '100%',
      flexShrink: 1,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 2,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.16)',
    },
  });
