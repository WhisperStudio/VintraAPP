import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { signOut } from 'firebase/auth';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { firebaseAuth } from '@/lib/firebase';
import { resolveAllAdminProfiles } from '@/lib/admin-chat';
import { callNotificationService } from '@/lib/push-sender';

type Preferences = { enabled: boolean; sound: boolean; vibration: boolean };
type DeviceState = {
  status: 'idle' | 'registering' | 'ready' | 'disabled' | 'error';
  message: string;
  token: string | null;
};
let preferences: Preferences = { enabled: true, sound: true, vibration: true };
let state: DeviceState = {
  status: 'idle',
  message: 'Enable notifications to connect this device.',
  token: null,
};
const listeners = new Set<() => void>();
function updateState(next: DeviceState) {
  state = next;
  listeners.forEach((listener) => listener());
}
export function useNotificationDevice() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
}
export const getNotificationPreferences = () => preferences;
export async function loadNotificationPreferences() {
  const values = await AsyncStorage.multiGet([
    '@vintra_settings_notif',
    '@vintra_settings_sound',
    '@vintra_settings_vib',
  ]);
  preferences = {
    enabled: values[0][1] !== 'false',
    sound: values[1][1] !== 'false',
    vibration: values[2][1] !== 'false',
  };
  return preferences;
}
export const notificationChannel = (sound: boolean, vibration: boolean) =>
  `messages-${sound ? 'sound' : 'silent'}-${vibration ? 'vibrate' : 'still'}`;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldPlaySound:
        preferences.enabled &&
        preferences.sound &&
        notification.request.content.sound != null,
      shouldSetBadge: false,
      shouldShowBanner: preferences.enabled,
      shouldShowList: preferences.enabled,
    }),
  });
}
async function configureChannels() {
  if (Platform.OS !== 'android') return;
  for (const sound of [true, false])
    for (const vibration of [true, false]) {
      await Notifications.setNotificationChannelAsync(
        notificationChannel(sound, vibration),
        {
          name: `Messages · ${sound ? 'sound' : 'silent'} · ${vibration ? 'vibration' : 'no vibration'}`,
          importance: Notifications.AndroidImportance.HIGH,
          sound: sound ? 'default' : null,
          enableVibrate: vibration,
          vibrationPattern: vibration ? [0, 250, 120, 250] : [0],
        },
      );
    }
}
export async function requestNotificationAccess() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window))
      return {
        granted: false,
        message: 'This browser does not support notifications.',
      };
    const permission = await window.Notification.requestPermission();
    return {
      granted: permission === 'granted',
      message:
        permission === 'granted'
          ? 'Browser alerts enabled while Vintra is open.'
          : 'Allow notifications in your browser settings.',
    };
  }
  await configureChannels();
  const current = await Notifications.getPermissionsAsync();
  const result =
    current.granted || !current.canAskAgain
      ? current
      : await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
  return {
    granted:
      result.granted ||
      result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    message: result.granted
      ? 'Notifications enabled.'
      : 'Allow notifications in your device settings.',
  };
}
let syncTask: Promise<string | null> | null = null;
export function syncNotificationDevice(prompt = false): Promise<string | null> {
  if (syncTask) return syncTask;
  syncTask = syncDevice(prompt).finally(() => {
    syncTask = null;
  });
  return syncTask;
}
async function syncDevice(prompt: boolean) {
  const user = firebaseAuth.currentUser;
  if (!user?.emailVerified) return null;
  const settings = await loadNotificationPreferences();
  if (Platform.OS === 'web') {
    const granted = prompt
      ? (await requestNotificationAccess()).granted
      : typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted';
    updateState({
      status: settings.enabled && granted ? 'ready' : 'disabled',
      token: null,
      message:
        settings.enabled && granted
          ? 'Browser alerts are active while Vintra is open.'
          : 'Enable browser alerts while Vintra is open.',
    });
    return null;
  }
  updateState({
    ...state,
    status: 'registering',
    message: 'Connecting this device…',
  });
  try {
    await configureChannels();
    const permission =
      prompt && settings.enabled
        ? await requestNotificationAccess()
        : await Notifications.getPermissionsAsync();
    const granted =
      permission.granted ||
      ('ios' in permission &&
        permission.ios?.status ===
          Notifications.IosAuthorizationStatus.PROVISIONAL);
    let token =
      state.token || (await AsyncStorage.getItem('@vintra_push_token'));
    if (granted && settings.enabled) {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;
      if (!projectId)
        throw new Error('This build is missing its Expo project ID.');
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    if (token) {
      const profiles = await resolveAllAdminProfiles(user);
      if (firebaseAuth.currentUser?.uid !== user.uid) return null;
      await callNotificationService('registerNotificationDevice', {
        token,
        platform: Platform.OS,
        businessIds: profiles.map((profile) => profile.businessId),
        ...settings,
        enabled: settings.enabled && granted,
      });
      await AsyncStorage.setItem('@vintra_push_token', token);
    }
    const enabled = granted && settings.enabled;
    updateState({
      status: enabled ? 'ready' : 'disabled',
      token,
      message: enabled
        ? 'This device is connected for chat alerts.'
        : 'Notifications are off. Enable them here and in device settings.',
    });
    return enabled ? token : null;
  } catch (error) {
    updateState({
      ...state,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Could not register this device.',
    });
    throw error;
  }
}
let preferenceTask: Promise<void> = Promise.resolve();
export function saveNotificationPreferences(patch: Partial<Preferences>) {
  const next = preferenceTask
    .catch(() => {})
    .then(() => persistNotificationPreferences(patch));
  preferenceTask = next;
  return next;
}
async function persistNotificationPreferences(patch: Partial<Preferences>) {
  const previous = await loadNotificationPreferences();
  preferences = { ...previous, ...patch };
  await AsyncStorage.multiSet([
    ['@vintra_settings_notif', String(preferences.enabled)],
    ['@vintra_settings_sound', String(preferences.sound)],
    ['@vintra_settings_vib', String(preferences.vibration)],
  ]);
  if (syncTask) await syncTask.catch(() => {});
  await syncNotificationDevice(false);
}
export async function sendLocalNotification(
  title: string,
  body: string,
  playSound = true,
  data: Record<string, unknown> = {},
) {
  if (Platform.OS === 'web') {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      window.Notification.permission !== 'granted'
    )
      throw new Error('Enable browser notifications first.');
    const notification = new window.Notification(title, {
      body,
      tag:
        typeof data.notificationId === 'string'
          ? data.notificationId
          : undefined,
      silent: !playSound,
    });
    notification.onclick = () => {
      window.focus();
      if (
        typeof data.chatId === 'string' &&
        typeof data.businessId === 'string'
      )
        window.location.assign(
          `/?chatId=${encodeURIComponent(data.chatId)}&businessId=${encodeURIComponent(data.businessId)}`,
        );
      notification.close();
    };
    return;
  }
  await configureChannels();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: playSound ? 'default' : undefined },
    trigger:
      Platform.OS === 'android'
        ? { channelId: notificationChannel(playSound, preferences.vibration) }
        : null,
  });
}
export async function signOutWithNotifications() {
  if (syncTask) await syncTask.catch(() => {});
  const token =
    state.token || (await AsyncStorage.getItem('@vintra_push_token'));
  // Unregister before dropping authentication. Surface failures so a shared phone cannot silently retain access.
  if (token && firebaseAuth.currentUser?.emailVerified)
    await callNotificationService('unregisterNotificationDevice', { token });
  await signOut(firebaseAuth);
  updateState({
    status: 'idle',
    token: null,
    message: 'Sign in to connect notifications.',
  });
}
