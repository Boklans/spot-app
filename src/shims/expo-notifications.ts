export enum AndroidImportance {
  UNKNOWN = 0,
  UNSPECIFIED = 1,
  NONE = 2,
  MIN = 3,
  LOW = 4,
  DEFAULT = 5,
  HIGH = 6,
  MAX = 7,
}

export enum AndroidNotificationPriority {
  MIN = 'min',
  LOW = 'low',
  DEFAULT = 'default',
  HIGH = 'high',
  MAX = 'max',
}

export enum SchedulableTriggerInputTypes {
  CALENDAR = 'calendar',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  DATE = 'date',
  TIME_INTERVAL = 'timeInterval',
}

export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

export interface NotificationResponse {
  actionIdentifier: string;
  userText?: string;
  notification: {
    request: {
      identifier: string;
      content: {
        title?: string | null;
        body?: string | null;
        data?: Record<string, unknown>;
      };
    };
  };
}

export function setNotificationHandler(_handler: unknown): void {}

export async function setNotificationChannelAsync(
  _channelId: string,
  _channel: unknown
): Promise<null> {
  return null;
}

export async function setNotificationCategoryAsync(
  _identifier: string,
  _actions: unknown[],
  _options?: unknown
): Promise<null> {
  return null;
}

export function addNotificationResponseReceivedListener(
  _listener: (response: NotificationResponse) => void
): { remove: () => void } {
  return { remove: () => {} };
}

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
  return null;
}

export async function dismissNotificationAsync(_identifier: string): Promise<void> {}

export async function getPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
  return { status: 'granted' };
}

export async function requestPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
  return { status: 'granted' };
}

export async function scheduleNotificationAsync(_request: {
  identifier?: string;
  content: unknown;
  trigger: unknown;
}): Promise<string> {
  return _request.identifier || `notif-${Date.now()}`;
}

export async function getAllScheduledNotificationsAsync(): Promise<Array<{ identifier: string }>> {
  return [];
}

export async function cancelScheduledNotificationAsync(_identifier: string): Promise<void> {}
