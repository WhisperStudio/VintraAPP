import { collection, getDocs, query, where } from 'firebase/firestore';

import { firebaseDb } from '@/lib/firebase';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export type PushResult = {
  total: number;
  sent: number;
  failed: number;
  errors: string[];
};

/**
 * Fetch unique Expo push tokens from the `pushTokens` collection.
 * Pass `'all'` to target every registered device, or a businessId to scope it.
 */
export async function fetchPushTokens(targetBusinessId: string): Promise<string[]> {
  const col = collection(firebaseDb, 'pushTokens');
  const snap =
    targetBusinessId === 'all'
      ? await getDocs(col)
      : await getDocs(query(col, where('businessId', '==', targetBusinessId)));

  const tokens = snap.docs
    .map((d) => (d.data() as { token?: string }).token)
    .filter((t): t is string => !!t && typeof t === 'string');

  return Array.from(new Set(tokens));
}

/**
 * Send a push notification to the given Expo push tokens via the Expo Push API.
 * Batches into chunks of 100 (Expo's per-request limit).
 */
export async function sendExpoPush(tokens: string[], title: string, body: string): Promise<PushResult> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    chunks.push(tokens.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'support-messages',
    }));
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as {
        data?: {
          status?: string;
          message?: string;
          details?: { error?: string };
        }[];
        errors?: { message?: string; code?: string }[];
      };
      if (Array.isArray(json.data)) {
        for (const ticket of json.data) {
          if (ticket.status === 'ok') {
            sent++;
          } else {
            failed++;
            const reason = ticket.details?.error || ticket.message || 'Unknown Expo push error';
            errors.push(reason);
          }
        }
      } else {
        failed += chunk.length;
        errors.push(...(json.errors || []).map((error) => error.message || error.code || 'Unexpected Expo push response'));
      }
    } catch {
      failed += chunk.length;
      errors.push('Could not reach Expo Push API');
    }
  }

  return { total: tokens.length, sent, failed, errors: Array.from(new Set(errors)).slice(0, 5) };
}
