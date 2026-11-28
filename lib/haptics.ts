import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

/**
 * Standardized, defensive haptic feedback utilities across SPOT (P3-01).
 * Respects user `hapticsEnabled` preference in Profile Settings.
 */
export function isHapticsEnabled(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return useUserProfileStore.getState().profile.hapticsEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Light impact for minor UI interactions (e.g., stepper +/- buttons, keypad digits).
 */
export async function hapticLight(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    try {
      Vibration.vibrate(20);
    } catch {}
  }
}

/**
 * Medium impact for structural actions (e.g., completing a normal set, moving items).
 */
export async function hapticMedium(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    try {
      Vibration.vibrate(40);
    } catch {}
  }
}

/**
 * Success notification reserved strictly for milestones (PRs, Rest 00:00, Workout Saved).
 */
export async function hapticSuccess(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    try {
      Vibration.vibrate([0, 45, 55, 45]);
    } catch {}
  }
}

/**
 * Selection feedback for tab changes, modal toggles, and SVG chart scrubbing detents.
 */
export async function hapticSelection(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    try {
      Vibration.vibrate(12);
    } catch {}
  }
}

export const hapticImpact = hapticLight;

/**
 * Error notification feedback (e.g., failed purchase, validation error).
 */
export async function hapticError(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    try {
      Vibration.vibrate([0, 50, 90, 50]);
    } catch {}
  }
}
