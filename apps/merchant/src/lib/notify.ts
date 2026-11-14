/** Local notifications for this app (no server key needed). */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'bever-default';
const MORNING_ID = 'bever-morning';
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'BEVER alerts', importance: Notifications.AndroidImportance.HIGH });
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch { return false; }
}

export async function notifyNow(title: string, body: string): Promise<void> {
  if (!supported) return;
  try {
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null });
  } catch { /* never crash over a notification */ }
}

/** One daily message at hour:minute, replaced each time the app plans a new one. */
export async function scheduleMorning(hour: number, minute: number, title: string, body: string): Promise<void> {
  if (!supported) return;
  try {
    if (!(await ensurePermission())) return;
    try { await Notifications.cancelScheduledNotificationAsync(MORNING_ID); } catch { /* none */ }
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
  } catch { /* ignore */ }
}
