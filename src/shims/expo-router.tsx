import React, { useEffect, useState } from 'react';
import { flattenStyle, type StyleProp, type TextStyle, type ViewStyle } from './react-native';

export type RouteHref =
  | string
  | {
      pathname: string;
      params?: Record<string, string | number | undefined>;
    };

export interface RouteEntry {
  pathname: string;
  params: Record<string, string>;
}

let historyStack: RouteEntry[] = [{ pathname: '/', params: {} }];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function parseHref(href: RouteHref): RouteEntry {
  if (typeof href === 'string') {
    const [rawPath, queryString] = href.split('?');
    const params: Record<string, string> = {};
    if (queryString) {
      const sp = new URLSearchParams(queryString);
      sp.forEach((v, k) => {
        params[k] = v;
      });
    }
    return { pathname: normalizePath(rawPath), params };
  }

  const params: Record<string, string> = {};
  if (href.params) {
    for (const [k, v] of Object.entries(href.params)) {
      if (v !== undefined) params[k] = String(v);
    }
  }
  return { pathname: normalizePath(href.pathname), params };
}

function normalizePath(p: string): string {
  if (!p) return '/';
  const cleaned = p.trim();
  if (cleaned === '/(tabs)' || cleaned === '/(tabs)/index') return '/(tabs)/index';
  if (cleaned === '/history/index') return '/history';
  return cleaned;
}

export const router = {
  push(href: RouteHref) {
    const entry = parseHref(href);
    historyStack = [...historyStack, entry];
    notify();
  },
  replace(href: RouteHref) {
    const entry = parseHref(href);
    if (historyStack.length === 0) {
      historyStack = [entry];
    } else {
      historyStack = [...historyStack.slice(0, -1), entry];
    }
    notify();
  },
  back() {
    if (historyStack.length > 1) {
      historyStack = historyStack.slice(0, -1);
      notify();
    }
  },
  canGoBack(): boolean {
    return historyStack.length > 1;
  },
  navigate(href: RouteHref) {
    router.push(href);
  },
};

export function useCurrentRoute(): RouteEntry {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = () => setTick((t) => t + 1);
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);
  return historyStack[historyStack.length - 1] || { pathname: '/', params: {} };
}

export function useLocalSearchParams<T extends Record<string, string | string[] | undefined> = Record<string, string>>(): T {
  const current = useCurrentRoute();
  return current.params as unknown as T;
}

export function useFocusEffect(effect: () => void | (() => void)) {
  const current = useCurrentRoute();
  useEffect(() => {
    return effect();
  }, [current.pathname, effect]);
}

// Route registry populated by App.tsx
let routeRenderer: ((route: RouteEntry) => React.ReactNode) | null = null;
let tabScreensRegistry: Record<string, React.ComponentType> = {};

export function registerRouteRenderer(
  fn: (route: RouteEntry) => React.ReactNode,
  tabs: Record<string, React.ComponentType>
) {
  routeRenderer = fn;
  tabScreensRegistry = tabs;
}

export function Stack(_props: {
  screenOptions?: Record<string, unknown>;
  children?: React.ReactNode;
}) {
  const current = useCurrentRoute();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        width: '100%',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {routeRenderer ? routeRenderer(current) : null}
    </div>
  );
}

Stack.Screen = function StackScreen(_props: Record<string, unknown>) {
  return null;
};

export interface TabsProps {
  screenOptions?:
    | Record<string, unknown>
    | ((props: { route: { name: string } }) => {
        headerShown?: boolean;
        tabBarActiveTintColor?: string;
        tabBarInactiveTintColor?: string;
        tabBarStyle?: StyleProp<ViewStyle>;
        tabBarLabelStyle?: StyleProp<TextStyle>;
        tabBarIcon?: (props: { color: string; size: number; focused: boolean }) => React.ReactNode;
      });
  children?: React.ReactNode;
}

export function Tabs({ screenOptions, children }: TabsProps) {
  const current = useCurrentRoute();
  const activeTabName = current.pathname.startsWith('/(tabs)/')
    ? current.pathname.replace('/(tabs)/', '') || 'index'
    : 'index';

  const tabConfigs: Array<{
    name: string;
    title: string;
    tabBarIcon?: (props: { color: string; size: number; focused: boolean }) => React.ReactNode;
  }> = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.props) {
      const p = child.props as {
        name?: string;
        options?: {
          title?: string;
          tabBarIcon?: (props: { color: string; size: number; focused: boolean }) => React.ReactNode;
        };
      };
      if (p.name) {
        tabConfigs.push({
          name: p.name,
          title: p.options?.title || p.name,
          tabBarIcon: p.options?.tabBarIcon,
        });
      }
    }
  });

  const ActiveComponent = tabScreensRegistry[activeTabName] || tabScreensRegistry.index;
  const sampleOpts =
    typeof screenOptions === 'function'
      ? screenOptions({ route: { name: activeTabName } })
      : (screenOptions as Record<string, unknown>) || {};

  const tabBarCss = flattenStyle(sampleOpts.tabBarStyle as StyleProp<ViewStyle>);
  const labelCss = flattenStyle(sampleOpts.tabBarLabelStyle as StyleProp<TextStyle>);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {ActiveComponent ? <ActiveComponent /> : null}
      </div>

      {/* Bottom Tab Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          backgroundColor: '#15181C',
          height: 76,
          paddingTop: 8,
          paddingBottom: 12,
          flexShrink: 0,
          zIndex: 50,
          ...tabBarCss,
        }}
      >
        {tabConfigs.map((tab) => {
          const focused = tab.name === activeTabName;
          const opts =
            typeof screenOptions === 'function'
              ? screenOptions({ route: { name: tab.name } })
              : (screenOptions as Record<string, unknown>) || {};
          const activeColor = (opts.tabBarActiveTintColor as string) || '#C8FF3D';
          const inactiveColor = (opts.tabBarInactiveTintColor as string) || '#555C65';
          const color = focused ? activeColor : inactiveColor;
          const iconRenderer =
            tab.tabBarIcon ||
            (opts.tabBarIcon as
              | ((props: { color: string; size: number; focused: boolean }) => React.ReactNode)
              | undefined);

          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => {
                router.replace(`/(tabs)/${tab.name}`);
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color,
                padding: 0,
              }}
            >
              {iconRenderer ? iconRenderer({ color, size: 22, focused }) : null}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  ...labelCss,
                }}
              >
                {tab.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Tabs.Screen = function TabsScreen(_props: {
  name: string;
  options?: { title?: string };
}) {
  return null;
};

export const DarkTheme = {
  dark: true,
  colors: {
    primary: '#C8FF3D',
    background: '#0B0D0F',
    card: '#15181C',
    text: '#F5F5F5',
    border: '#292E35',
    notification: '#FF5C5C',
  },
};

export const DefaultTheme = {
  dark: false,
  colors: {
    primary: '#C8FF3D',
    background: '#F3F5F8',
    card: '#FFFFFF',
    text: '#0E1114',
    border: '#E2E8F0',
    notification: '#DC2626',
  },
};

export function ThemeProvider({
  children,
}: {
  value?: unknown;
  children?: React.ReactNode;
}) {
  return <>{children}</>;
}

