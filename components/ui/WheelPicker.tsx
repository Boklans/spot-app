import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
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
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';

export const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220
export const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2
export const PADDING_OFFSET = PADDING_COUNT * ITEM_HEIGHT; // 88

interface WheelItemProps<T> {
  item: T;
  index: number;
  scrollOffset: SharedValue<number>;
  label: string;
  unit?: string;
  onPress: () => void;
}

const WheelItem = React.memo(function WheelItem<T>({
  index,
  scrollOffset,
  label,
  unit,
  onPress,
}: WheelItemProps<T>) {
  const animatedTextStyle = useAnimatedStyle(() => {
    'worklet';
    const itemOffset = index * ITEM_HEIGHT;
    const distance = Math.abs(scrollOffset.value - itemOffset);

    const opacity = interpolate(
      distance,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1, 0.4, 0.16],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      distance,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1.06, 0.94, 0.85],
      Extrapolation.CLAMP
    );

    const color = interpolateColor(
      distance,
      [0, ITEM_HEIGHT],
      [colors.primary, '#637083']
    );

    return {
      opacity,
      transform: [{ scale }],
      color,
    };
  });

  const animatedUnitStyle = useAnimatedStyle(() => {
    'worklet';
    const itemOffset = index * ITEM_HEIGHT;
    const distance = Math.abs(scrollOffset.value - itemOffset);

    const opacity = interpolate(
      distance,
      [0, ITEM_HEIGHT * 0.5],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="button">
      <View style={styles.itemRow}>
        <Animated.Text style={[styles.itemText, animatedTextStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
        {unit ? (
          <Animated.Text style={[styles.itemUnit, animatedUnitStyle]} numberOfLines={1}>
            {' '}{unit}
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
  );
});

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
  const listRef = useRef<FlatList<T>>(null);
  const initialIndex = Math.max(0, data.findIndex((item) => item === selectedValue));

  // UI-thread shared values: NO React state updates during scroll
  const scrollOffset = useSharedValue(initialIndex * ITEM_HEIGHT);
  const lastHapticIndex = useSharedValue(initialIndex);
  const lastCommittedIndexRef = useRef<number>(initialIndex);
  const dataLength = data.length;

  // Initial scroll position on mount
  useEffect(() => {
    lastCommittedIndexRef.current = initialIndex;
    lastHapticIndex.value = initialIndex;
    scrollOffset.value = initialIndex * ITEM_HEIGHT;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: initialIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 20);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to selected value ONLY if changed externally (e.g. direct keypad input modal)
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    if (targetIdx !== lastCommittedIndexRef.current) {
      lastCommittedIndexRef.current = targetIdx;
      lastHapticIndex.value = targetIdx;
      scrollOffset.value = targetIdx * ITEM_HEIGHT;
      listRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedValue, data, lastHapticIndex, scrollOffset]);

  // Haptic trigger executed on JS thread via runOnJS only when mathematical index increments
  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  // Reanimated scroll handler strictly runs on UI thread
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollOffset.value = event.contentOffset.y;

      const rawIdx = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      if (rawIdx !== lastHapticIndex.value && rawIdx >= 0 && rawIdx < dataLength) {
        lastHapticIndex.value = rawIdx;
        runOnJS(triggerHaptic)();
      }
    },
  });

  // Commit value update ONLY when the wheel comes to a complete rest
  const commitIndex = useCallback(
    (offsetY: number) => {
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      listRef.current?.scrollToOffset({
        offset: clamped * ITEM_HEIGHT,
        animated: true,
      });

      if (clamped !== lastCommittedIndexRef.current) {
        lastCommittedIndexRef.current = clamped;
        onValueChange(data[clamped]);
      }
    },
    [data, onValueChange]
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitIndex(e.nativeEvent.contentOffset.y);
    },
    [commitIndex]
  );

  // If stopped abruptly by user finger without momentum
  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = Math.abs(e.nativeEvent.velocity?.y ?? 0);
      if (velocityY < 0.1) {
        commitIndex(e.nativeEvent.contentOffset.y);
      }
    },
    [commitIndex]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const displayLabel = formatLabel ? formatLabel(item) : String(item);

      const handlePress = () => {
        const currentSelected = lastCommittedIndexRef.current === index;
        if (currentSelected) {
          onActivePress?.();
        } else {
          listRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: true,
          });
          commitIndex(index * ITEM_HEIGHT);
        }
      };

      return (
        <WheelItem
          key={`${item}-${index}`}
          item={item}
          index={index}
          scrollOffset={scrollOffset}
          label={displayLabel}
          unit={unit}
          onPress={handlePress}
        />
      );
    },
    [formatLabel, onActivePress, scrollOffset, unit, commitIndex]
  );

  return (
    <View style={styles.container}>
      {/* Visual Center Selection Indicator */}
      <View style={styles.centerHighlightBand} pointerEvents="none" />

      <Animated.FlatList
        ref={listRef as unknown as React.RefObject<FlatList<unknown>>}
        data={data}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={renderItem as unknown as React.ComponentProps<typeof Animated.FlatList>['renderItem']}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex >= 0 ? initialIndex : 0}
        ListHeaderComponent={<View style={styles.paddingSpacer} />}
        ListFooterComponent={<View style={styles.paddingSpacer} />}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        windowSize={7}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={30}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  list: {
    height: PICKER_HEIGHT,
    width: '100%',
  },
  listContent: {
    alignItems: 'center',
  },
  paddingSpacer: {
    height: PADDING_OFFSET,
    width: '100%',
  },
  item: {
    height: ITEM_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    height: ITEM_HEIGHT,
  },
  itemText: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    lineHeight: ITEM_HEIGHT,
  },
  itemUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    marginLeft: 3,
    lineHeight: ITEM_HEIGHT,
  },
  centerHighlightBand: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: PADDING_OFFSET,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(212, 255, 0, 0.35)',
    borderBottomColor: 'rgba(212, 255, 0, 0.35)',
    zIndex: 1,
  },
});
