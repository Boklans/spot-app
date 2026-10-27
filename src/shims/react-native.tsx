import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type StyleProp<T> =
  | T
  | StyleProp<T>[]
  | null
  | undefined
  | false
  | Record<string, unknown>;

export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
export type ImageSourcePropType = string | { uri?: string; default?: string } | number;

export interface NativeScrollEvent {
  contentOffset: { x: number; y: number };
  contentSize?: { width: number; height: number };
  layoutMeasurement?: { width: number; height: number };
  velocity?: { x: number; y: number };
}

export interface NativeSyntheticEvent<T> {
  nativeEvent: T;
}

const UNITLESS_PROPS = new Set([
  'opacity',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'scale',
  'scaleX',
  'scaleY',
  'aspectRatio',
  'elevation',
]);

export function resolveAnimatedValue(val: unknown): unknown {
  if (val && typeof val === 'object' && '__getValue' in val && typeof (val as { __getValue: () => unknown }).__getValue === 'function') {
    return (val as { __getValue: () => unknown }).__getValue();
  }
  return val;
}

export function flattenStyle(style: unknown): React.CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<React.CSSProperties>((acc, item) => {
      return { ...acc, ...flattenStyle(item) };
    }, {});
  }
  if (typeof style !== 'object') return {};

  const raw = style as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, rawVal] of Object.entries(raw)) {
    const val = resolveAnimatedValue(rawVal);
    if (val === undefined || val === null || val === false) continue;

    switch (k) {
      case 'paddingHorizontal':
        out.paddingLeft = typeof val === 'number' ? `${val}px` : val;
        out.paddingRight = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'paddingVertical':
        out.paddingTop = typeof val === 'number' ? `${val}px` : val;
        out.paddingBottom = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'marginHorizontal':
        out.marginLeft = typeof val === 'number' ? `${val}px` : val;
        out.marginRight = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'marginVertical':
        out.marginTop = typeof val === 'number' ? `${val}px` : val;
        out.marginBottom = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'borderWidth':
        out.borderWidth = typeof val === 'number' ? `${val}px` : val;
        if (!out.borderStyle) out.borderStyle = 'solid';
        break;
      case 'borderTopWidth':
        out.borderTopWidth = typeof val === 'number' ? `${val}px` : val;
        if (!out.borderTopStyle) out.borderTopStyle = 'solid';
        break;
      case 'borderBottomWidth':
        out.borderBottomWidth = typeof val === 'number' ? `${val}px` : val;
        if (!out.borderBottomStyle) out.borderBottomStyle = 'solid';
        break;
      case 'borderLeftWidth':
        out.borderLeftWidth = typeof val === 'number' ? `${val}px` : val;
        if (!out.borderLeftStyle) out.borderLeftStyle = 'solid';
        break;
      case 'borderRightWidth':
        out.borderRightWidth = typeof val === 'number' ? `${val}px` : val;
        if (!out.borderRightStyle) out.borderRightStyle = 'solid';
        break;
      case 'transform':
        if (Array.isArray(val)) {
          const parts: string[] = [];
          for (const item of val) {
            if (item && typeof item === 'object') {
              for (const [tk, tvRaw] of Object.entries(item as Record<string, unknown>)) {
                const tv = resolveAnimatedValue(tvRaw);
                if (tk === 'translateX' || tk === 'translateY') {
                  parts.push(`${tk}(${typeof tv === 'number' ? `${tv}px` : tv})`);
                } else {
                  parts.push(`${tk}(${tv})`);
                }
              }
            }
          }
          out.transform = parts.join(' ');
        } else if (typeof val === 'string') {
          out.transform = val;
        }
        break;
      case 'fontVariant':
        if (Array.isArray(val)) {
          out.fontVariantNumeric = val.join(' ');
        }
        break;
      case 'flex':
        if (typeof val === 'number') {
          if (val > 0) {
            out.flex = `${val} 1 0%`;
            out.minHeight = 0;
            out.minWidth = 0;
          } else if (val === 0) {
            out.flex = '0 0 auto';
          }
        } else {
          out.flex = val;
        }
        break;
      case 'lineHeight':
        out.lineHeight = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'shadowColor':
      case 'shadowOffset':
      case 'shadowOpacity':
      case 'shadowRadius':
      case 'elevation':
      case 'textShadowColor':
      case 'textShadowOffset':
      case 'textShadowRadius':
      case 'includeFontPadding':
      case 'textAlignVertical':
        break;
      default:
        if (typeof val === 'number' && !UNITLESS_PROPS.has(k)) {
          out[k] = `${val}px`;
        } else {
          out[k] = val;
        }
    }
  }

  if (raw.textShadowColor && raw.textShadowRadius) {
    const r = Number(raw.textShadowRadius) || 8;
    out.textShadow = `0px 0px ${r}px ${String(raw.textShadowColor)}`;
  }

  return out as React.CSSProperties;
}

export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles;
  },
  flatten: flattenStyle,
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  absoluteFillObject: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hairlineWidth: 1,
};

export const Platform = {
  OS: 'web' as 'web' | 'ios' | 'android',
  select<T>(specifics: { web?: T; ios?: T; android?: T; default?: T }): T | undefined {
    return specifics.web ?? specifics.default ?? specifics.ios ?? specifics.android;
  },
};

export const Dimensions = {
  get(_dim: 'window' | 'screen') {
    const w = typeof window !== 'undefined' ? Math.min(window.innerWidth || 412, 460) : 412;
    const h = typeof window !== 'undefined' ? window.innerHeight || 840 : 840;
    return {
      width: w,
      height: h,
      scale: 2,
      fontScale: 1,
    };
  },
  addEventListener() {
    return { remove: () => {} };
  },
};

export const StatusBar = (_props: Record<string, unknown>) => null;

export const BackHandler = {
  addEventListener(_eventName: string, _handler: () => boolean) {
    return { remove: () => {} };
  },
  removeEventListener(_eventName: string, _handler: () => boolean) {},
};

export const AppState = {
  currentState: 'active' as 'active' | 'background' | 'inactive',
  addEventListener(_type: string, handler: (state: 'active' | 'background' | 'inactive') => void) {
    const onVis = () => {
      handler(document.visibilityState === 'visible' ? 'active' : 'background');
    };
    document.addEventListener('visibilitychange', onVis);
    return {
      remove: () => document.removeEventListener('visibilitychange', onVis),
    };
  },
};

export const Linking = {
  async canOpenURL(_url: string): Promise<boolean> {
    return true;
  },
  async openURL(url: string): Promise<void> {
    if (url.startsWith('mailto:')) {
      window.location.href = url;
    } else {
      Alert.alert('External Link', url);
    }
  },
};

export const Share = {
  async share(content: { message?: string; title?: string; url?: string }): Promise<{ action: string }> {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: content.title,
          text: content.message,
          url: content.url,
        });
        return { action: 'sharedAction' };
      } catch {
        // Fallback to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && content.message) {
      try {
        await navigator.clipboard.writeText(content.message);
        Alert.alert(content.title || 'Copied', 'Workout summary copied to clipboard!');
      } catch {
        Alert.alert(content.title || 'Share', content.message);
      }
    }
    return { action: 'sharedAction' };
  },
};

export const Vibration = {
  vibrate(pattern?: number | number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern || 20);
      } catch {
        // ignore
      }
    }
  },
  cancel() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    }
  },
};

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  in: (fn?: (t: number) => number) => fn || ((t: number) => t),
  out: (fn?: (t: number) => number) => fn || ((t: number) => t),
  inOut: (fn?: (t: number) => number) => fn || ((t: number) => t),
  bezier: () => (t: number) => t,
};

// --- Alert System (No window.alert; renders sleek in-app modal) ---
export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let alertListener: ((state: AlertState | null) => void) | null = null;

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const resolvedButtons: AlertButton[] =
      buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];
    if (alertListener) {
      alertListener({ title, message, buttons: resolvedButtons });
    }
  },
};

export function AlertHost() {
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  useEffect(() => {
    alertListener = setAlertState;
    return () => {
      alertListener = null;
    };
  }, []);

  if (!alertState) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: '#15181C',
          border: '1px solid #292E35',
          borderRadius: 20,
          padding: 22,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            color: '#F5F5F5',
            fontSize: 18,
            fontWeight: 800,
            marginBottom: alertState.message ? 8 : 18,
          }}
        >
          {alertState.title}
        </div>
        {alertState.message ? (
          <div
            style={{
              color: '#8E959F',
              fontSize: 14,
              lineHeight: '20px',
              marginBottom: 20,
            }}
          >
            {alertState.message}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertState.buttons.map((btn, idx) => {
            const isDestructive = btn.style === 'destructive';
            const isCancel = btn.style === 'cancel';
            return (
              <button
                key={idx}
                onClick={() => {
                  setAlertState(null);
                  btn.onPress?.();
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: isCancel ? '1px solid #292E35' : 'none',
                  backgroundColor: isDestructive
                    ? 'rgba(255, 92, 92, 0.16)'
                    : isCancel
                    ? '#1C2025'
                    : '#C8FF3D',
                  color: isDestructive ? '#FF5C5C' : isCancel ? '#F5F5F5' : '#0B0D0F',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {btn.text || 'OK'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Core Components ---
export interface ViewProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onLayout?: (e: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
  accessibilityRole?: string;
  accessibilityLabel?: string;
}

export const View = forwardRef<HTMLDivElement, ViewProps>(function View(
  { style, children, pointerEvents, onLayout },
  ref
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const css = flattenStyle(style);
  const hasFlex =
    css.flex !== undefined || css.flexGrow !== undefined || css.flexShrink !== undefined;

  useEffect(() => {
    if (onLayout && innerRef.current) {
      const rect = innerRef.current.getBoundingClientRect();
      onLayout({
        nativeEvent: {
          layout: { x: 0, y: 0, width: rect.width || 340, height: rect.height || 180 },
        },
      });
    }
  }, [onLayout]);

  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        minWidth: 0,
        minHeight: hasFlex ? 0 : undefined,
        flexShrink: hasFlex ? undefined : 0,
        pointerEvents: pointerEvents === 'none' ? 'none' : undefined,
        ...css,
      }}
    >
      {children}
    </div>
  );
});

export const SafeAreaView = forwardRef<HTMLDivElement, ViewProps>(function SafeAreaView(
  { style, children, ...rest },
  ref
) {
  return (
    <View ref={ref} style={style} {...rest}>
      {children}
    </View>
  );
});

export const KeyboardAvoidingView = forwardRef<
  HTMLDivElement,
  ViewProps & { behavior?: string; keyboardVerticalOffset?: number }
>(function KeyboardAvoidingView({ style, children }, ref) {
  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
});

export interface TextProps {
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' | string;
  adjustsFontSizeToFit?: boolean;
  onPress?: () => void;
  selectable?: boolean;
}

export const Text = forwardRef<HTMLSpanElement, TextProps>(function Text(
  { style, children, numberOfLines, onPress },
  ref
) {
  const css = flattenStyle(style);
  const clampStyle: React.CSSProperties =
    numberOfLines === 1
      ? {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }
      : numberOfLines && numberOfLines > 1
      ? {
          display: '-webkit-box',
          WebkitLineClamp: numberOfLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }
      : {};

  return (
    <span
      ref={ref}
      onClick={onPress}
      style={{
        boxSizing: 'border-box',
        color: '#F5F5F5',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        whiteSpace: 'pre-wrap',
        cursor: onPress ? 'pointer' : undefined,
        ...css,
        ...clampStyle,
      }}
    >
      {children}
    </span>
  );
});

export interface PressableEvent {
  stopPropagation: () => void;
  preventDefault: () => void;
}

export interface PressableProps {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  onPress?: (e: PressableEvent) => void;
  onLongPress?: () => void;
  disabled?: boolean;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityState?: Record<string, unknown>;
}

export const Pressable = forwardRef<HTMLDivElement, PressableProps>(function Pressable(
  { style, children, onPress, disabled, accessibilityLabel },
  ref
) {
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const resolvedChildren = typeof children === 'function' ? children({ pressed }) : children;
  const css = flattenStyle(resolvedStyle);
  const hasFlex =
    css.flex !== undefined || css.flexGrow !== undefined || css.flexShrink !== undefined;

  return (
    <div
      ref={ref}
      role="button"
      aria-label={accessibilityLabel}
      tabIndex={disabled ? -1 : 0}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onPress?.(e);
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPress?.(e);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        minWidth: 0,
        minHeight: hasFlex ? 0 : undefined,
        flexShrink: hasFlex ? undefined : 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...css,
      }}
    >
      {resolvedChildren}
    </div>
  );
});

export interface ScrollViewProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: string;
  keyboardDismissMode?: string;
  nestedScrollEnabled?: boolean;
  bounces?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  children?: React.ReactNode;
}

export interface ScrollView {
  scrollTo: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToEnd: (opts?: { animated?: boolean }) => void;
}

export const ScrollView = forwardRef<ScrollView, ScrollViewProps>(function ScrollView(
  {
    style,
    contentContainerStyle,
    horizontal,
    showsHorizontalScrollIndicator = true,
    showsVerticalScrollIndicator = true,
    onScroll,
    onMomentumScrollEnd,
    children,
  },
  ref
) {
  const domRef = useRef<HTMLDivElement | null>(null);
  const outerCss = flattenStyle(style);
  const innerCss = flattenStyle(contentContainerStyle);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    scrollTo({ x = 0, y = 0, animated = true }) {
      domRef.current?.scrollTo({
        left: x,
        top: y,
        behavior: animated ? 'smooth' : 'auto',
      });
    },
    scrollToEnd({ animated = true } = {}) {
      if (!domRef.current) return;
      domRef.current.scrollTo({
        left: domRef.current.scrollWidth,
        top: domRef.current.scrollHeight,
        behavior: animated ? 'smooth' : 'auto',
      });
    },
  }));

  const hideScrollbars =
    (!horizontal && !showsVerticalScrollIndicator) ||
    (horizontal && !showsHorizontalScrollIndicator);

  return (
    <div
      ref={domRef}
      className={hideScrollbars ? 'no-scrollbar' : undefined}
      onScroll={(e) => {
        const el = e.currentTarget;
        const synthetic: NativeSyntheticEvent<NativeScrollEvent> = {
          nativeEvent: {
            contentOffset: { x: el.scrollLeft, y: el.scrollTop },
            contentSize: { width: el.scrollWidth, height: el.scrollHeight },
            layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
            velocity: { x: 0, y: 0 },
          },
        };
        onScroll?.(synthetic);
        if (onMomentumScrollEnd) {
          if (scrollTimer.current) clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(() => {
            onMomentumScrollEnd(synthetic);
          }, 120);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        overflowX: horizontal ? 'auto' : 'hidden',
        overflowY: horizontal ? 'hidden' : 'auto',
        flex: horizontal ? '0 0 auto' : '1 1 0%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        boxSizing: 'border-box',
        WebkitOverflowScrolling: 'touch',
        ...outerCss,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          boxSizing: 'border-box',
          flexShrink: 0,
          width: horizontal ? 'auto' : '100%',
          ...innerCss,
        }}
      >
        {children}
      </div>
    </div>
  );
});

export interface FlatListProps<T> {
  data: readonly T[] | null | undefined;
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: React.ReactNode | React.ComponentType;
  ListFooterComponent?: React.ReactNode | React.ComponentType;
  ListEmptyComponent?: React.ReactNode | React.ComponentType;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  snapToInterval?: number;
  snapToAlignment?: string;
  decelerationRate?: string | number;
  initialScrollIndex?: number;
  getItemLayout?: (data: unknown, index: number) => { length: number; offset: number; index: number };
  scrollEventThrottle?: number;
  windowSize?: number;
  maxToRenderPerBatch?: number;
  updateCellsBatchingPeriod?: number;
  removeClippedSubviews?: boolean;
  keyboardShouldPersistTaps?: string;
}

export interface FlatListRef {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
  scrollToIndex: (params: { index: number; animated?: boolean }) => void;
}

export type FlatList<T = unknown> = FlatListRef & { __itemType?: T };

export const FlatList = forwardRef<FlatListRef, FlatListProps<any>>(function FlatList(
  {
    data,
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    style,
    contentContainerStyle,
    horizontal,
    showsVerticalScrollIndicator = true,
    onScroll,
    onMomentumScrollEnd,
    snapToInterval,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToOffset({ offset, animated }) {
      if (!containerRef.current) return;
      containerRef.current.scrollTo({
        top: horizontal ? 0 : offset,
        left: horizontal ? offset : 0,
        behavior: animated ? 'smooth' : 'auto',
      });
    },
    scrollToIndex({ index, animated }) {
      if (!containerRef.current) return;
      const offset = index * (snapToInterval || 44);
      containerRef.current.scrollTo({
        top: horizontal ? 0 : offset,
        left: horizontal ? offset : 0,
        behavior: animated ? 'smooth' : 'auto',
      });
    },
  }));

  const outerCss = flattenStyle(style);
  const innerCss = flattenStyle(contentContainerStyle);
  const items = data ?? [];

  const renderNode = (Comp?: React.ReactNode | React.ComponentType) => {
    if (!Comp) return null;
    if (typeof Comp === 'function') return <Comp />;
    return Comp;
  };

  return (
    <div
      ref={containerRef}
      className={!showsVerticalScrollIndicator ? 'no-scrollbar' : undefined}
      onScroll={(e) => {
        const el = e.currentTarget;
        const synthetic: NativeSyntheticEvent<NativeScrollEvent> = {
          nativeEvent: {
            contentOffset: { x: el.scrollLeft, y: el.scrollTop },
            contentSize: { width: el.scrollWidth, height: el.scrollHeight },
            layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
            velocity: { x: 0, y: 0 },
          },
        };
        onScroll?.(synthetic);
        if (onMomentumScrollEnd) {
          if (scrollTimer.current) clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(() => {
            onMomentumScrollEnd(synthetic);
          }, 130);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        overflowX: horizontal ? 'auto' : 'hidden',
        overflowY: horizontal ? 'hidden' : 'auto',
        boxSizing: 'border-box',
        scrollSnapType: snapToInterval ? (horizontal ? 'x mandatory' : 'y mandatory') : undefined,
        ...outerCss,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          boxSizing: 'border-box',
          width: '100%',
          ...innerCss,
        }}
      >
        {renderNode(ListHeaderComponent)}
        {items.length === 0
          ? renderNode(ListEmptyComponent)
          : items.map((item, index) => (
              <div
                key={keyExtractor ? keyExtractor(item, index) : String(index)}
                style={{
                  scrollSnapAlign: snapToInterval ? 'center' : undefined,
                  width: '100%',
                }}
              >
                {renderItem({ item, index })}
              </div>
            ))}
        {renderNode(ListFooterComponent)}
      </div>
    </div>
  );
});

export interface TextInputProps {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  style?: StyleProp<TextStyle>;
  secureTextEntry?: boolean;
  keyboardType?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  clearButtonMode?: string;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: string;
  onSubmitEditing?: () => void;
  selectTextOnFocus?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(
  function TextInput(
    {
      value,
      defaultValue,
      onChangeText,
      onBlur,
      onFocus,
      placeholder,
      style,
      secureTextEntry,
      keyboardType,
      multiline,
      maxLength,
      autoFocus,
      editable = true,
      onSubmitEditing,
    },
    ref
  ) {
    const css = flattenStyle(style);
    const inputType = secureTextEntry
      ? 'password'
      : keyboardType === 'email-address'
      ? 'email'
      : 'text';

    if (multiline) {
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => onChangeText?.(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          disabled={!editable}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#F5F5F5',
            fontFamily: 'inherit',
            resize: 'none',
            boxSizing: 'border-box',
            ...css,
          }}
        />
      );
    }

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        type={inputType}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChangeText?.(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmitEditing?.();
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={!editable}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#F5F5F5',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          ...css,
        }}
      />
    );
  }
);

export interface ImageProps {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function Image({ source, style, resizeMode = 'cover' }: ImageProps) {
  const css = flattenStyle(style);
  let src = '';
  if (typeof source === 'string') {
    src = source;
  } else if (source && typeof source === 'object') {
    src = source.uri || source.default || '';
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        display: 'block',
        objectFit: resizeMode === 'stretch' ? 'fill' : resizeMode === 'center' ? 'none' : resizeMode,
        boxSizing: 'border-box',
        ...css,
      }}
    />
  );
}

export interface ModalProps {
  visible?: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  statusBarTranslucent?: boolean;
  presentationStyle?: string;
  onRequestClose?: () => void;
  children?: React.ReactNode;
}

export function Modal({ visible, transparent, children }: ModalProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: transparent ? 'transparent' : '#050608',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          height: '100dvh',
          minHeight: 0,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: transparent ? 'transparent' : '#0B0D0F',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ActivityIndicator({
  size = 'small',
  color = '#C8FF3D',
}: {
  size?: 'small' | 'large' | number;
  color?: string;
}) {
  const px = typeof size === 'number' ? size : size === 'large' ? 32 : 18;
  return (
    <div
      style={{
        width: px,
        height: px,
        border: `2.5px solid rgba(255,255,255,0.15)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spot-spin 0.7s linear infinite',
      }}
    />
  );
}

export interface SwitchProps {
  value?: boolean;
  onValueChange?: (val: boolean) => void;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  ios_backgroundColor?: string;
  disabled?: boolean;
}

export function Switch({
  value = false,
  onValueChange,
  trackColor,
  thumbColor = '#FFFFFF',
  disabled,
}: SwitchProps) {
  const activeBg = trackColor?.true || '#C8FF3D';
  const inactiveBg = trackColor?.false || '#292E35';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onValueChange?.(!value)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? activeBg : inactiveBg,
        border: 'none',
        padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: value ? 'flex-end' : 'flex-start',
        transition: 'background-color 0.2s ease',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: thumbColor,
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}

// --- Animated Implementation ---
class AnimatedInterpolation {
  private parent: AnimatedValue;
  private inputRange: number[];
  private outputRange: (number | string)[];
  private extrapolate?: string;

  constructor(
    parent: AnimatedValue,
    config: {
      inputRange: number[];
      outputRange: (number | string)[];
      extrapolate?: string;
    }
  ) {
    this.parent = parent;
    this.inputRange = config.inputRange;
    this.outputRange = config.outputRange;
    this.extrapolate = config.extrapolate;
  }

  __getValue(): number | string {
    const val = this.parent.__getValue();
    const { inputRange, outputRange, extrapolate } = this;
    if (inputRange.length < 2) return outputRange[0] ?? val;

    if (val <= inputRange[0]) {
      if (extrapolate === 'clamp') return outputRange[0];
    }
    if (val >= inputRange[inputRange.length - 1]) {
      if (extrapolate === 'clamp') return outputRange[outputRange.length - 1];
    }

    let i = 0;
    for (; i < inputRange.length - 2; i++) {
      if (val < inputRange[i + 1]) break;
    }

    const inMin = inputRange[i];
    const inMax = inputRange[i + 1];
    const outMin = outputRange[i];
    const outMax = outputRange[i + 1];

    const t = inMax === inMin ? 0 : (val - inMin) / (inMax - inMin);
    const clampedT = extrapolate === 'clamp' ? Math.max(0, Math.min(1, t)) : t;

    if (typeof outMin === 'number' && typeof outMax === 'number') {
      return outMin + clampedT * (outMax - outMin);
    }
    return clampedT < 0.5 ? outMin : outMax;
  }

  __subscribe(cb: () => void): () => void {
    return this.parent.__subscribe(cb);
  }
}

class AnimatedValue {
  private _value: number;
  private _listeners = new Map<string, (state: { value: number }) => void>();
  private _subscribers = new Set<() => void>();
  private _nextId = 1;

  constructor(initial: number) {
    this._value = initial;
  }

  setValue(v: number) {
    if (this._value === v) return;
    this._value = v;
    for (const cb of this._listeners.values()) {
      cb({ value: v });
    }
    for (const sub of this._subscribers) {
      sub();
    }
  }

  __getValue(): number {
    return this._value;
  }

  addListener(cb: (state: { value: number }) => void): string {
    const id = String(this._nextId++);
    this._listeners.set(id, cb);
    return id;
  }

  removeListener(id: string) {
    this._listeners.delete(id);
  }

  removeAllListeners() {
    this._listeners.clear();
  }

  __subscribe(cb: () => void): () => void {
    this._subscribers.add(cb);
    return () => {
      this._subscribers.delete(cb);
    };
  }

  interpolate(config: {
    inputRange: number[];
    outputRange: (number | string)[];
    extrapolate?: string;
  }) {
    return new AnimatedInterpolation(this, config);
  }
}

function collectAnimatables(style: unknown, out: Set<{ __subscribe: (cb: () => void) => () => void }>) {
  if (!style) return;
  if (Array.isArray(style)) {
    for (const item of style) collectAnimatables(item, out);
    return;
  }
  if (typeof style === 'object') {
    if ('__subscribe' in style && typeof (style as { __subscribe: unknown }).__subscribe === 'function') {
      out.add(style as { __subscribe: (cb: () => void) => () => void });
      return;
    }
    for (const val of Object.values(style as Record<string, unknown>)) {
      collectAnimatables(val, out);
    }
  }
}

const AnimatedView = forwardRef<HTMLDivElement, ViewProps>(function AnimatedView(props, ref) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const anims = new Set<{ __subscribe: (cb: () => void) => () => void }>();
    collectAnimatables(props.style, anims);
    if (anims.size === 0) return;
    const unsubs = [...anims].map((a) => a.__subscribe(() => setTick((t) => t + 1)));
    return () => {
      for (const u of unsubs) u();
    };
  }, [props.style]);

  return <View ref={ref} {...props} />;
});

const AnimatedText = forwardRef<HTMLSpanElement, TextProps>(function AnimatedText(props, ref) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const anims = new Set<{ __subscribe: (cb: () => void) => () => void }>();
    collectAnimatables(props.style, anims);
    if (anims.size === 0) return;
    const unsubs = [...anims].map((a) => a.__subscribe(() => setTick((t) => t + 1)));
    return () => {
      for (const u of unsubs) u();
    };
  }, [props.style]);

  return <Text ref={ref} {...props} />;
});

export type ScrollViewInstance = ScrollView;
export type TextInputInstance = HTMLInputElement & HTMLTextAreaElement;

export const Animated = {
  Value: AnimatedValue,
  View: AnimatedView,
  Text: AnimatedText,
  FlatList: FlatList,
  ScrollView: ScrollView,
  timing(
    value: AnimatedValue,
    config: { toValue: number; duration?: number; easing?: unknown; useNativeDriver?: boolean }
  ) {
    return {
      start(cb?: (result: { finished: boolean }) => void) {
        value.setValue(config.toValue);
        cb?.({ finished: true });
      },
      stop() {},
    };
  },
  spring(
    value: AnimatedValue,
    config: { toValue: number; friction?: number; tension?: number; useNativeDriver?: boolean }
  ) {
    return {
      start(cb?: (result: { finished: boolean }) => void) {
        value.setValue(config.toValue);
        cb?.({ finished: true });
      },
      stop() {},
    };
  },
  sequence(animations: Array<{ start: (cb?: (res: { finished: boolean }) => void) => void; stop: () => void }>) {
    return {
      start(cb?: (result: { finished: boolean }) => void) {
        for (const a of animations) a.start();
        cb?.({ finished: true });
      },
      stop() {},
    };
  },
  parallel(animations: Array<{ start: (cb?: (res: { finished: boolean }) => void) => void; stop: () => void }>) {
    return {
      start(cb?: (result: { finished: boolean }) => void) {
        for (const a of animations) a.start();
        cb?.({ finished: true });
      },
      stop() {},
    };
  },
  loop(animation: { start: (cb?: (res: { finished: boolean }) => void) => void; stop: () => void }) {
    return {
      start() {
        animation.start();
      },
      stop() {
        animation.stop();
      },
    };
  },
  event(
    argMapping: Array<{ nativeEvent?: { contentOffset?: { y?: AnimatedValue; x?: AnimatedValue } } } | null>,
    _config?: { useNativeDriver?: boolean }
  ) {
    return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const mapping = argMapping[0];
      const yTarget = mapping?.nativeEvent?.contentOffset?.y;
      const xTarget = mapping?.nativeEvent?.contentOffset?.x;
      if (yTarget && e?.nativeEvent?.contentOffset) {
        yTarget.setValue(e.nativeEvent.contentOffset.y);
      }
      if (xTarget && e?.nativeEvent?.contentOffset) {
        xTarget.setValue(e.nativeEvent.contentOffset.x);
      }
    };
  },
};

export namespace Animated {
  export type Value = AnimatedValue;
}
