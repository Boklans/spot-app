/**
 * SPOT 2.0 Unified Motion Tokens (P3-01)
 * Consistent "machined hardware" spring & timing curves across sheets, buttons, and meters.
 */
export const springs = {
  snappy: { speed: 34, bounciness: 5, useNativeDriver: true as const },
  sheet: { damping: 28, stiffness: 280, mass: 0.9, useNativeDriver: true as const },
  celebrate: { speed: 42, bounciness: 12, useNativeDriver: true as const },
  meter: { speed: 18, bounciness: 4, useNativeDriver: true as const },
} as const;

export const durations = {
  instant: 120,
  fast: 180,
  normal: 240,
  sheetOut: 190,
} as const;
