import { Platform } from 'react-native';
import type { AffineMatrix } from '@/lib/exerciseAnimations/benchPressKinematics';
import { matrixToSvgString } from '@/lib/exerciseAnimations/benchPressKinematics';

/**
 * Zero-re-render imperative SVG updater for react-native-svg 15+ (Fabric + Web).
 *
 * - On iOS / Android: calls `setNativeProps({ matrix })` directly on `RNSVGGroup`
 *   (no string parsing, no React reconciliation).
 * - On Web: mutates the underlying DOM `SVGElement` directly via `elementRef.current`
 *   so 60fps animation runs smoothly without React re-renders.
 */
export function applySvgGroupMatrix(ref: any, matrix: AffineMatrix): void {
  if (!ref) return;

  if (Platform.OS === 'web') {
    const domEl = ref.elementRef?.current ?? ref;
    if (domEl && typeof domEl.setAttribute === 'function') {
      domEl.setAttribute('transform', matrixToSvgString(matrix));
    }
    return;
  }

  if (typeof ref.setNativeProps === 'function') {
    ref.setNativeProps({ matrix: [...matrix] });
  }
}

/**
 * Zero-re-render imperative opacity updater for SVG shapes/groups (e.g., muscle glow).
 */
export function applySvgOpacity(ref: any, opacity: number): void {
  if (!ref) return;
  const clamped = Math.max(0, Math.min(1, opacity));

  if (Platform.OS === 'web') {
    const domEl = ref.elementRef?.current ?? ref;
    if (domEl && typeof domEl.setAttribute === 'function') {
      domEl.setAttribute('opacity', clamped.toFixed(3));
    }
    return;
  }

  if (typeof ref.setNativeProps === 'function') {
    ref.setNativeProps({ opacity: clamped });
  }
}
