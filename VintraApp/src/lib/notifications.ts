import { Alert, Platform } from 'react-native';

type PermissionResult = {
  granted: boolean;
  token?: string;
  message: string;
};

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

  return {
    granted: false,
    message: 'Push notifications are paused until the Apple Developer setup is ready.',
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

  Alert.alert(title, body);
}
