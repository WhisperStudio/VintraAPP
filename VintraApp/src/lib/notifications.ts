import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PermissionResult = {
  granted: boolean;
  token?: string;
  message: string;
};

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

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
          ? 'Notifications are enabled for this browser.'
          : 'Notifications were not enabled.',
    };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return {
      granted: false,
      message: 'Notifications were not enabled.',
    };
  }

  const projectId = getProjectId();
  let token: string | undefined;
  let tokenError: string | undefined;

  if (projectId) {
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error) {
      tokenError = error instanceof Error ? error.message : 'Could not fetch Expo push token.';
    }
  }

  return {
    granted: true,
    token,
    message: token
      ? 'Notifications are enabled for this device.'
      : tokenError
        ? `Notifications are enabled, but push token is not ready yet: ${tokenError}`
        : 'Notifications are enabled, but no Expo project ID was found for push tokens.',
  };
}

export async function sendLocalNotification(title: string, body: string) {
  if (Platform.OS === 'web') {
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(title, { body });
      return;
    }

    throw new Error('Browser notifications are not enabled.');
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}
