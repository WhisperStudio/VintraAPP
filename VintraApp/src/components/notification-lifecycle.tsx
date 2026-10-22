import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { type User } from 'firebase/auth';
import { listenSupportChats, resolveAllAdminProfiles } from '@/lib/admin-chat';
import {
  getNotificationPreferences,
  loadNotificationPreferences,
  sendLocalNotification,
  syncNotificationDevice,
} from '@/lib/notifications';

/** Mounted once for the authenticated app, independent of the selected tab. */
export function NotificationLifecycle({ user }: { user: User }) {
  const navigation = useRootNavigationState();
  useEffect(() => {
    let disposed = false;
    const unsubscribers: (() => void)[] = [];
    const sync = () => {
      syncNotificationDevice(false).catch(console.warn);
    };
    syncNotificationDevice(Platform.OS !== 'web').catch(console.warn);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const tokenSubscription =
      Platform.OS !== 'web' ? Notifications.addPushTokenListener(sync) : null;
    if (Platform.OS === 'web') {
      Promise.all([
        resolveAllAdminProfiles(user),
        loadNotificationPreferences(),
      ])
        .then(([profiles]) => {
          if (disposed) return;
          for (const profile of profiles) {
            let initialized = false;
            let known = new Map<string, Set<string>>();
            unsubscribers.push(
              listenSupportChats(
                profile.businessId,
                (chats) => {
                  const next = new Map<string, Set<string>>();
                  for (const chat of chats) {
                    next.set(
                      chat.id,
                      new Set(chat.messages.map((message) => message.id)),
                    );
                    if (!initialized) continue;
                    for (const message of chat.messages) {
                      if (
                        message.role !== 'user' ||
                        known.get(chat.id)?.has(message.id)
                      )
                        continue;
                      const preferences = getNotificationPreferences();
                      if (preferences.enabled)
                        sendLocalNotification(
                          chat.visitorName || 'New customer message',
                          message.text,
                          preferences.sound,
                          {
                            chatId: chat.id,
                            businessId: chat.businessId,
                            notificationId: message.id,
                          },
                        ).catch(console.warn);
                    }
                  }
                  known = next;
                  initialized = true;
                },
                console.warn,
              ),
            );
          }
        })
        .catch(console.warn);
    }
    return () => {
      disposed = true;
      appState.remove();
      tokenSubscription?.remove();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  useEffect(() => {
    if (Platform.OS === 'web' || !navigation?.key) return;
    let lastId = '';
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (id === lastId) return;
      lastId = id;
      const data = response.notification.request.content.data || {};
      if (
        data.type === 'chat' &&
        typeof data.chatId === 'string' &&
        typeof data.businessId === 'string'
      ) {
        router.push({
          pathname: '/',
          params: {
            chatId: data.chatId,
            businessId: data.businessId,
            notificationId: id,
          },
        });
      } else {
        router.push('/');
      }
      Notifications.clearLastNotificationResponseAsync().catch(console.warn);
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    const previous = Notifications.getLastNotificationResponse();
    if (previous) open(previous);
    return () => subscription.remove();
  }, [navigation?.key]);
  return null;
}
