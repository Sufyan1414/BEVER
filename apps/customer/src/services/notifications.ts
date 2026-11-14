/**
 * Notifications (customer). Local notifications work with no server key:
 * the app plans tomorrow's morning message from the customer's own order history and
 * schedules it on the phone. Live push while the app is closed needs Firebase (not connected yet).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const MORNING_ID = 'bever-morning';
const PREF_KEY = 'bever.notify.morning';
const CHANNEL = 'bever-default';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

export interface NudgePlan {
  hour: number;
  minute: number;
  title: string;
  body: string;
  data: Record<string, string>;
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'BEVER updates', importance: Notifications.AndroidImportance.HIGH });
}

/** Asks once (Android 13+ shows a system prompt). Returns whether notifications are allowed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch { return false; }
}

export async function getMorningEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(PREF_KEY)) !== 'off'; } catch { return true; }
}

export async function setMorningEnabled(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* non-fatal */ }
  if (!on && supported) { try { await Notifications.cancelScheduledNotificationAsync(MORNING_ID); } catch { /* none scheduled */ } }
}

/** Replace the daily morning notification with a fresh plan. */
export async function scheduleMorning(plan: NudgePlan): Promise<void> {
  if (!supported) return;
  try {
    if (!(await ensureNotificationPermission())) return;
    try { await Notifications.cancelScheduledNotificationAsync(MORNING_ID); } catch { /* none scheduled */ }
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: { title: plan.title, body: plan.body, data: plan.data, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: plan.hour, minute: plan.minute, channelId: CHANNEL },
    });
  } catch { /* never crash the app over a notification */ }
}

/** Show a notification right now (order updates while the app is running). */
export async function notifyNow(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  if (!supported) return;
  try {
    if (!(await ensureNotificationPermission())) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: true }, trigger: null });
  } catch { /* ignore */ }
}

export { Notifications };
