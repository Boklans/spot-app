export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Soft = 'soft',
  Rigid = 'rigid',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(10);
    } catch {
      // ignore
    }
  }
}

export async function notificationAsync(_type?: NotificationFeedbackType): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([15, 30, 15]);
    } catch {
      // ignore
    }
  }
}

export async function selectionAsync(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(5);
    } catch {
      // ignore
    }
  }
}
