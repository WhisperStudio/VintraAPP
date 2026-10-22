import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase';

const functions = getFunctions(firebaseApp, 'us-central1');
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
  try {
    return (await httpsCallable<unknown, T>(functions, name)(data)).data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'functions/not-found' ||
      code === 'functions/unavailable' ||
      code === 'functions/internal'
    ) {
      throw new Error(
        'The notification service is unavailable. Check that the Firebase notification functions are deployed, then retry.',
      );
    }
    throw error;
  }
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
