import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { firebaseDb } from '@/lib/firebase';

type PermissionResult = {
  granted: boolean;
  message: string;
};

let notificationTapHandler: ((data: Record<string, unknown>) => void) | null = null;

/**
 * Register a callback invoked when the user taps a push notification.
 * Call this once from your root layout with navigation logic.
 */
export function setNotificationTapHandler(handler: (data: Record<string, unknown>) => void) {
  notificationTapHandler = handler;
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
} catch {}

async function configureNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('support-messages', {
    name: 'Support messages',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 120, 250],
  });
}

try {
  Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as Record<string, unknown>;
    notificationTapHandler?.(data);
  });
} catch {}

export async function requestNotificationAccess(): Promise<PermissionResult> {
  if (Platform.OS === 'web') {
    if (!('Notification' in window)) {
      return {
        granted: false,
        message: 'This browser does not support notifications.',
      };
    }

    const permission = await window.Notification.requestPermission();

    return {
      granted: permission === 'granted',
      message:
        permission === 'granted'
          ? 'Browser notifications are enabled.'
          : 'Notifications were not enabled.',
    };
  }

  try {
    await configureNotificationChannel();

    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.granted
      ? current
      : await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
    return {
      granted: finalStatus.granted,
      message: finalStatus.granted ? 'Notifications are enabled.' : 'Notifications were not enabled.',
    };
  } catch {
    return { granted: false, message: 'Notifications are not available on this build.' };
  }
}

export async function sendLocalNotification(title: string, body: string, playSound = true) {
  if (Platform.OS === 'web') {
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(title, { body });
      return;
    }

    throw new Error('Browser notifications are not enabled.');
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: playSound ? 'default' : undefined },
      trigger: Platform.OS === 'android' ? { channelId: 'support-messages' } : null,
    });
  } catch {}
}

export async function registerPushToken(userId: string, businessId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  const permission = await requestNotificationAccess();
  if (!permission.granted) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch {
    return null;
  }

  const payload = {
    token,
    userId,
    businessId,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  };

  await Promise.all([
    setDoc(doc(firebaseDb, `businesses/${businessId}/users/${userId}`), { pushToken: token, pushPlatform: Platform.OS, pushTokenUpdatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(firebaseDb, `pushTokens/${userId}_${businessId}_${Platform.OS}`), payload, { merge: true }),
  ]).catch(() => {});

  return token;
}
