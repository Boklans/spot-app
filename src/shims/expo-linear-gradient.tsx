import React from 'react';
import { flattenStyle, type StyleProp, type ViewStyle } from './react-native';

export interface LinearGradientProps {
  colors: readonly string[];
  locations?: readonly number[] | null;
  start?: { x: number; y: number } | null;
  end?: { x: number; y: number } | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function LinearGradient({
  colors,
  locations,
  start,
  end,
  style,
  children,
}: LinearGradientProps) {
  const s = start ?? { x: 0.5, y: 0 };
  const e = end ?? { x: 0.5, y: 1 };
  const angle = Math.round((Math.atan2(e.x - s.x, -(e.y - s.y)) * 180) / Math.PI + 180) % 360;

  const stops = colors
    .map((c, idx) => {
      const loc = locations && locations[idx] !== undefined ? `${Math.round(locations[idx] * 100)}%` : '';
      return loc ? `${c} ${loc}` : c;
    })
    .join(', ');

  const cssStyle = flattenStyle(style);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...cssStyle,
        backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
      }}
    >
      {children}
    </div>
  );
}
