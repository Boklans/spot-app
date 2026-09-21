import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';

export const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220
export const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2
export const PADDING_OFFSET = PADDING_COUNT * ITEM_HEIGHT; // 88

interface WheelItemProps<T> {
  item: T;
  index: number;
  scrollY: Animated.Value;
  label: string;
  unit?: string;
  onPress: () => void;
}

const WheelItem = React.memo(function WheelItem<T>({
  index,
  scrollY,
  label,
  unit,
  onPress,
}: WheelItemProps<T>) {
  const itemOffset = index * ITEM_HEIGHT;

  // Scale: 1.06 at center, down to 0.85 when 2 items away (native driver)
  const scale = scrollY.interpolate({
    inputRange: [
      itemOffset - ITEM_HEIGHT * 2,
      itemOffset - ITEM_HEIGHT,
      itemOffset,
      itemOffset + ITEM_HEIGHT,
      itemOffset + ITEM_HEIGHT * 2,
    ],
    outputRange: [0.85, 0.94, 1.06, 0.94, 0.85],
    extrapolate: 'clamp',
  });

  // Active layer: SPOT Lime (#D4FF00), fades in at center
  const activeOpacity = scrollY.interpolate({
    inputRange: [
      itemOffset - ITEM_HEIGHT * 0.7,
      itemOffset,
      itemOffset + ITEM_HEIGHT * 0.7,
    ],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  // Inactive layer: Muted Grey (#6B7684), fades out at center
  const inactiveOpacity = scrollY.interpolate({
    inputRange: [
      itemOffset - ITEM_HEIGHT * 2,
      itemOffset - ITEM_HEIGHT,
      itemOffset - ITEM_HEIGHT * 0.5,
      itemOffset,
      itemOffset + ITEM_HEIGHT * 0.5,
      itemOffset + ITEM_HEIGHT,
      itemOffset + ITEM_HEIGHT * 2,
    ],
    outputRange: [0.18, 0.42, 0.05, 0, 0.05, 0.42, 0.18],
    extrapolate: 'clamp',
  });

  // Unit suffix: visible only when at center
  const unitOpacity = scrollY.interpolate({
    inputRange: [
      itemOffset - ITEM_HEIGHT * 0.5,
      itemOffset,
      itemOffset + ITEM_HEIGHT * 0.5,
    ],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="button">
      <Animated.View style={[styles.itemRow, { transform: [{ scale }] }]}>
        {/* Active Layer: SPOT Lime */}
        <Animated.View style={[styles.layerWrap, { opacity: activeOpacity }]}>
          <Animated.Text style={[styles.itemText, styles.itemTextActive]} numberOfLines={1}>
            {label}
          </Animated.Text>
          {unit ? (
            <Animated.Text style={[styles.itemUnit, { opacity: unitOpacity }]} numberOfLines={1}>
              {' '}{unit}
            </Animated.Text>
          ) : null}
        </Animated.View>

        {/* Inactive Layer: Muted Grey */}
        <Animated.View
          style={[styles.layerWrap, styles.inactiveLayerWrap, { opacity: inactiveOpacity }]}
          pointerEvents="none"
        >
          <Animated.Text style={[styles.itemText, styles.itemTextInactive]} numberOfLines={1}>
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
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

  // Native driver scroll tracking: ZERO JS thread overhead during scroll
  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_HEIGHT)).current;
  const lastCommittedIndexRef = useRef<number>(initialIndex);
  const lastVibratedIndexRef = useRef<number>(initialIndex);
  const dataLength = data.length;

  // Haptic feedback listener triggered natively on item index changes
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const rawIdx = Math.round(value / ITEM_HEIGHT);
      if (rawIdx !== lastVibratedIndexRef.current && rawIdx >= 0 && rawIdx < dataLength) {
        lastVibratedIndexRef.current = rawIdx;
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [dataLength, scrollY]);

  // Initial scroll position on mount
  useEffect(() => {
    lastCommittedIndexRef.current = initialIndex;
    lastVibratedIndexRef.current = initialIndex;
    scrollY.setValue(initialIndex * ITEM_HEIGHT);
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
      lastVibratedIndexRef.current = targetIdx;
      scrollY.setValue(targetIdx * ITEM_HEIGHT);
      listRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedValue, data, scrollY]);

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

  // 100% Native Driver scroll event
  const handleScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
    })
  ).current;

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
          scrollY={scrollY}
          label={displayLabel}
          unit={unit}
          onPress={handlePress}
        />
      );
    },
    [formatLabel, onActivePress, scrollY, unit, commitIndex]
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
        onScroll={handleScroll}
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
    width: '100%',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  layerWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    height: ITEM_HEIGHT,
  },
  inactiveLayerWrap: {
    position: 'absolute',
  },
  itemText: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    lineHeight: ITEM_HEIGHT,
  },
  itemTextActive: {
    color: colors.primary,
  },
  itemTextInactive: {
    color: '#8E959F',
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
