import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS Reduce Motion accessibility preference.
 * Returns true when decorative/looping animations should be skipped.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(Boolean(enabled));
      })
      .catch(() => undefined);

    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduced(Boolean(enabled));
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
