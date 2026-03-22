import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'sidestore-cert-reminder';
const INTERVAL_DAYS = 6;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function scheduleCertReminder(): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] permission not granted — cert reminder not scheduled');
      return;
    }

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const alreadyScheduled = existing.some(n => n.identifier === NOTIFICATION_ID);
    if (alreadyScheduled) {
      console.log('[notifications] cert reminder already scheduled — skipping');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'mBowl — check SideStore',
        body: 'Refresh your SideStore cert before it expires. Takes 2 minutes.',
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: INTERVAL_DAYS * 24 * 60 * 60,
        repeats: true,
      },
    });

    console.log('[notifications] cert reminder scheduled every', INTERVAL_DAYS, 'days');
  } catch (e) {
    console.error('[notifications] scheduleCertReminder failed', e);
  }
}
