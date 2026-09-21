import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';

export const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220
export const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2
export const PADDING_OFFSET = PADDING_COUNT * ITEM_HEIGHT; // 88

interface AnimatedItemProps {
  label: string;
  unit?: string;
  index: number;
  scrollOffset: SharedValue<number>;
  itemHeight: number;
  onPress: () => void;
}

const AnimatedWheelItem = React.memo(
  function AnimatedWheelItem({
    label,
    unit,
    index,
    scrollOffset,
    itemHeight,
    onPress,
  }: AnimatedItemProps) {
    const itemTargetOffset = index * itemHeight;

    const animatedTextStyle = useAnimatedStyle(() => {
      const distance = Math.abs(scrollOffset.value - itemTargetOffset);

      const opacity = interpolate(
        distance,
        [0, itemHeight * 0.8, itemHeight * 1.8],
        [1, 0.45, 0.18],
        Extrapolation.CLAMP
      );

      const color = interpolateColor(
        distance,
        [0, itemHeight * 0.9, itemHeight * 1.8],
        [colors.primary, '#8E959F', '#555C65']
      );

      const scale = interpolate(
        distance,
        [0, itemHeight],
        [1.05, 0.9],
        Extrapolation.CLAMP
      );

      return {
        opacity,
        color,
        transform: [{ scale }],
      };
    });

    const animatedUnitStyle = useAnimatedStyle(() => {
      const distance = Math.abs(scrollOffset.value - itemTargetOffset);
      const opacity = interpolate(
        distance,
        [0, itemHeight * 0.4, itemHeight * 0.8],
        [1, 0.25, 0],
        Extrapolation.CLAMP
      );

      return {
        opacity,
      };
    });

    return (
      <Pressable onPress={onPress} style={styles.item} accessibilityRole="button">
        <View style={styles.itemRow}>
          <Animated.Text
            style={[styles.itemText, animatedTextStyle]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
          {unit ? (
            <Animated.Text
              style={[styles.itemUnitSelected, animatedUnitStyle]}
              numberOfLines={1}
            >
              {' '}{unit}
            </Animated.Text>
          ) : null}
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.unit === next.unit &&
    prev.index === next.index &&
    prev.itemHeight === next.itemHeight
);

export interface WheelPickerProps<T extends number | string> {
  data: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  unit?: string;
  onActivePress?: () => void;
}

export function WheelPicker<T extends number | string>({
  data,
  selectedValue,
  onValueChange,
  formatLabel,
  unit,
  onActivePress,
}: WheelPickerProps<T>) {
  const listRef = useRef<any>(null);
  const initialIndex = Math.max(0, data.findIndex((item) => item === selectedValue));
  const dataLength = data.length;

  // UI-thread shared values for smooth 60/120 FPS animations without JS overhead
  const scrollOffset = useSharedValue(initialIndex * ITEM_HEIGHT);
  const lastHapticIndex = useSharedValue(initialIndex);

  // Initial scroll position on mount
  useEffect(() => {
    scrollOffset.value = initialIndex * ITEM_HEIGHT;
    lastHapticIndex.value = initialIndex;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: initialIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 20);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to selected value ONLY if changed externally (e.g. direct keypad input)
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    const targetOffset = targetIdx * ITEM_HEIGHT;
    if (Math.abs(scrollOffset.value - targetOffset) > 1) {
      scrollOffset.value = targetOffset;
      lastHapticIndex.value = targetIdx;
      listRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
    }
  }, [selectedValue, data]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  // Strict UI-thread animated scroll handler:
  // - ZERO React state updates
  // - Updates scrollOffset directly on UI thread
  // - Triggers Haptics strictly once when mathematical index increments/decrements
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
      const rawIdx = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(dataLength - 1, rawIdx));

      if (clamped !== lastHapticIndex.value) {
        lastHapticIndex.value = clamped;
        runOnJS(triggerHaptic)();
      }
    },
  });

  // State update ONLY when wheel motion stops
  const commitSelection = useCallback(
    (offsetY: number) => {
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      listRef.current?.scrollToOffset({
        offset: clamped * ITEM_HEIGHT,
        animated: true,
      });

      if (data[clamped] !== selectedValue) {
        onValueChange(data[clamped]);
      }
    },
    [data, onValueChange, selectedValue]
  );

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocityY = Math.abs(e.nativeEvent.velocity?.y ?? 0);
    if (velocityY < 0.1) {
      commitSelection(e.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitSelection(e.nativeEvent.contentOffset.y);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const displayLabel = formatLabel ? formatLabel(item) : String(item);

      const handlePress = () => {
        const currentActiveIdx = Math.round(scrollOffset.value / ITEM_HEIGHT);
        if (index === currentActiveIdx) {
          onActivePress?.();
        } else {
          listRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: true,
          });
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(data[index]);
        }
      };

      return (
        <AnimatedWheelItem
          label={displayLabel}
          unit={unit}
          index={index}
          scrollOffset={scrollOffset}
          itemHeight={ITEM_HEIGHT}
          onPress={handlePress}
        />
      );
    },
    [data, formatLabel, onActivePress, onValueChange, scrollOffset, unit]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={false}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        bounces={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  list: {
    height: PICKER_HEIGHT,
    width: '100%',
  },
  listContent: {
    paddingVertical: PADDING_OFFSET,
  },
  item: {
    width: '100%',
    height: ITEM_HEIGHT,
    minHeight: ITEM_HEIGHT,
    maxHeight: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemRow: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    letterSpacing: -0.4,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: ITEM_HEIGHT,
    includeFontPadding: false,
  },
  itemUnitSelected: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
    lineHeight: ITEM_HEIGHT,
    includeFontPadding: false,
  },
});
