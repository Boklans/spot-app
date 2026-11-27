import React, { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight } from '@/lib/haptics';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional override for sheet surface background (default: colors.surface) */
  backgroundColor?: string;
  maxHeight?: ViewStyle['maxHeight'];
  showHandle?: boolean;
  enableSwipeToDismiss?: boolean;
  avoidKeyboard?: boolean;
}

/**
 * Native-feeling 60fps BottomSheet with decoupled backdrop fade, PanResponder
 * swipe-down dismissal on the handle, dynamic window dimensions, and KeyboardAvoidingView.
 */
export function BottomSheet({
  visible,
  onClose,
  backgroundColor,
  maxHeight = '88%',
  showHandle = true,
  enableSwipeToDismiss = true,
  avoidKeyboard = true,
  children,
}: PropsWithChildren<BottomSheetProps>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const hiddenOffset = Math.min(480, Math.max(280, windowHeight * 0.58));

  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(hiddenOffset)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reducedMotion) {
        backdropOpacity.setValue(1);
        sheetTranslateY.setValue(0);
        return;
      }
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(hiddenOffset);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 28,
          stiffness: 320,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      if (reducedMotion) {
        backdropOpacity.setValue(0);
        sheetTranslateY.setValue(hiddenOffset);
        setMounted(false);
        return;
      }
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: hiddenOffset,
          duration: 185,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, reducedMotion, hiddenOffset, backdropOpacity, sheetTranslateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enableSwipeToDismiss,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          enableSwipeToDismiss && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) {
            sheetTranslateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 96 || gesture.vy > 0.85) {
            hapticLight();
            onCloseRef.current();
          } else {
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              damping: 26,
              stiffness: 320,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [enableSwipeToDismiss, sheetTranslateY]
  );

  if (!mounted) return null;

  const sheetNode = (
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
          <View {...panResponder.panHandlers} style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
        ) : null}
        {children}
      </SafeAreaView>
    </Animated.View>
  );

  return (
    <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close modal" />
        </Animated.View>

        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={styles.keyboardWrap}
          >
            {sheetNode}
          </KeyboardAvoidingView>
        ) : (
          sheetNode
        )}
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
    keyboardWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlayBackdrop,
    },
    sheetContainer: {
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      overflow: 'hidden',
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    safeInner: {
      maxHeight: '100%',
      flexShrink: 1,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
  });
