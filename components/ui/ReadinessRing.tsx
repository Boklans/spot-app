import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

type ReadinessRingProps = {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function ReadinessRing({
  percentage,
  color,
  size = 88,
  strokeWidth = 7,
}: ReadinessRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Soft neon aura behind the ring */}
      <View
        style={[
          styles.glowBackdrop,
          {
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: (size * 0.75) / 2,
            backgroundColor: `${color}18`,
          },
        ]}
      />

      {/* Smooth Continuous Solid SVG Ring */}
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background Track Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Outer Glow Pass */}
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth + 4}
            strokeOpacity={0.2}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}

        {/* Solid Main Progress Arc */}
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>

      {/* Center Readout */}
      <View style={styles.centerWrap}>
        <Text style={styles.percentageText}>{clamped}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBackdrop: {
    position: 'absolute',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
