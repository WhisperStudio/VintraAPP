import { firebaseAuth } from '@/lib/firebase';
import { requestNotificationApi } from '@/lib/notification-api';

const endpoint =
  process.env.EXPO_PUBLIC_NOTIFICATION_API_URL ||
  'https://chat.vintrastudio.com/api/notifications';
export type NotificationLog = {
  id: string;
  title: string;
  body: string;
  targetBusinessId: string;
  status: string;
  recipients?: number;
  sentCount?: number;
  failedCount?: number;
  confirmedCount?: number;
  receiptFailedCount?: number;
  errors?: string[];
  createdAt: number;
  testToken?: string;
};
export type NotificationCenter = {
  businesses: { id: string; name: string; devices: number }[];
  devices: number;
  history: NotificationLog[];
};
export async function callNotificationService<T>(
  name: string,
  data: unknown,
): Promise<T> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Sign in to connect notifications.');
  return requestNotificationApi<T>(name, data, {
    endpoint,
    getToken: async (refresh) => {
      if (firebaseAuth.currentUser !== user)
        throw new Error('Your account changed. Please try again.');
      return user.getIdToken(refresh);
    },
  });
}
export const loadNotificationCenter = () =>
  callNotificationService<NotificationCenter>('notificationCenter', {});
export const createRequestId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export function queueAnnouncement(input: {
  title: string;
  body: string;
  targetBusinessId: string;
  requestId: string;
  testToken?: string;
}) {
  return callNotificationService<{ id: string; status: string }>(
    'queueAnnouncement',
    input,
  );
}
