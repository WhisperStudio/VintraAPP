import type { User } from 'firebase/auth';
import { requestNotificationApi } from '@/lib/notification-api';

const endpoint = process.env.EXPO_PUBLIC_ACCESS_API_URL || 'https://chat.vintrastudio.com/api/access';
export function requestAccessApi<T>(user: User, action: string, data: Record<string, unknown> = {}): Promise<T> {
  return requestNotificationApi<T>(action, data, {
    endpoint, getToken: () => user.getIdToken(true), serviceName: 'Account access',
  });
}
