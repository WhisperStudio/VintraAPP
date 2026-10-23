import { requestAccessApi } from '@/lib/access-api';
import { type User } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { firebaseDb } from '@/lib/firebase';

export type Widget = { key: string; name: string };

export async function fetchWidgets(businessId: string): Promise<Widget[]> {
  try {
    const snap = await getDocs(collection(firebaseDb, `businesses/${businessId}/chatWidgets`));
    if (!snap.empty) {
      return snap.docs.map(d => {
        const data = d.data();
        const name = String(
          data.name || data.widgetName || data.displayName || data.title ||
          data.assistantConfig?.name || data.assistantConfig?.title || d.id,
        );
        return { key: d.id, name };
      });
    }
  } catch { /* ignore */ }
  return [];
}

export type AdminProfile = {
  businessId: string;
  email: string;
  role: string;
  displayName?: string;
  businessName?: string;
};

export type SupportMessage = {
  id: string;
  role: 'user' | 'assistant' | 'support' | 'system';
  text: string;
  createdAt: Date;
};

export type SupportChat = {
  id: string;
  businessId: string;
  widgetKey: string;
  sessionId: string;
  status: string;
  preview: string;
  pageTitle?: string;
  pageUrl?: string;
  visitorName?: string;
  countryCode?: string;
  createdAt: Date;
  updatedAt: Date;
  supportRequestedAt?: Date;
  supportTypingAt?: Date;
  visitorTypingAt?: Date;
  messageCount: number;
  messages: SupportMessage[];
};

export type ChatAnalyticsTimelineEvent = {
  id: string;
  kind: string;
  sessionId: string;
  widgetKey?: string;
  countryCode?: string;
  createdAt: Date;
};

export type ChatAnalytics = {
  totalMessages: number;
  totalConversations: number;
  totalSessions: number;
  supportRequests: number;
  aiOnly: number;
  savedChats: number;
  timeline: ChatAnalyticsTimelineEvent[];
};

const ADMIN_ROLES = new Set(['admin', 'owner', 'support']);

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDate(value: unknown) {
  if (value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return new Date();
}

function normalizeRole(role: unknown): SupportMessage['role'] {
  return role === 'assistant' || role === 'support' || role === 'system' ? role : 'user';
}

function mapMessage(value: Record<string, unknown>): SupportMessage {
  return {
    id: String(value.id || JSON.stringify([value.role || 'user', value.text || '', value.createdAt || ''])),
    role: normalizeRole(value.role),
    text: String(value.text || ''),
    createdAt: toDate(value.createdAt),
  };
}

function mapChat(businessId: string, id: string, data: Record<string, unknown>): SupportChat {
  const messages = Array.isArray(data.messages)
    ? data.messages.map((message) => mapMessage((message || {}) as Record<string, unknown>))
    : [];

  return {
    id,
    businessId,
    widgetKey: String(data.widgetKey || ''),
    sessionId: String(data.sessionId || id),
    status: String(data.status || 'needs-human'),
    preview: String(data.preview || messages.at(-1)?.text || ''),
    pageTitle: data.pageTitle ? String(data.pageTitle) : undefined,
    pageUrl: data.pageUrl ? String(data.pageUrl) : undefined,
    visitorName: data.visitorName ? String(data.visitorName) : undefined,
    countryCode: data.countryCode ? String(data.countryCode) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    supportRequestedAt: data.supportRequestedAt ? toDate(data.supportRequestedAt) : undefined,
    supportTypingAt: data.supportTypingAt ? toDate(data.supportTypingAt) : undefined,
    visitorTypingAt: data.visitorTypingAt ? toDate(data.visitorTypingAt) : undefined,
    messageCount: Number(data.messageCount || messages.length),
    messages,
  };
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapTimelineEvent(value: Record<string, unknown>): ChatAnalyticsTimelineEvent {
  return {
    id: String(value.id || randomId()),
    kind: String(value.kind || value.type || 'activity'),
    sessionId: String(value.sessionId || value.chatId || value.id || ''),
    widgetKey: value.widgetKey ? String(value.widgetKey) : undefined,
    countryCode: value.countryCode ? String(value.countryCode).toUpperCase() : undefined,
    createdAt: toDate(value.createdAt),
  };
}

function mapChatAnalytics(data: Record<string, unknown>): ChatAnalytics {
  const raw = (data.chatAnalytics || data.analytics || {}) as Record<string, unknown>;
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.map((event) => mapTimelineEvent((event || {}) as Record<string, unknown>))
    : [];
  const uniqueTimelineSessions = new Set(timeline.map((event) => event.sessionId).filter(Boolean)).size;
  const supportTimelineSessions = new Set(
    timeline
      .filter((event) => event.kind === 'support-open' || event.kind === 'support-message' || event.kind === 'support-request')
      .map((event) => event.sessionId)
      .filter(Boolean),
  ).size;
  const savedTimelineSessions = new Set(
    timeline
      .filter((event) => event.kind === 'support-message')
      .map((event) => event.sessionId)
      .filter(Boolean),
  ).size;
  const totalConversations = Math.max(
    asNumber(raw.totalConversations),
    asNumber(raw.totalSessions),
    asNumber(raw.conversations),
    asNumber(raw.sessions),
    uniqueTimelineSessions,
  );
  const supportRequests = Math.max(
    asNumber(raw.supportRequests),
    asNumber(raw.supportSessions),
    supportTimelineSessions,
  );
  const savedChats = Math.max(asNumber(raw.savedChats), asNumber(raw.supportAnswered), savedTimelineSessions);
  const aiOnly = Math.max(asNumber(raw.aiOnly), asNumber(raw.aiSessions), totalConversations - supportRequests);

  return {
    totalMessages: asNumber(raw.totalMessages),
    totalConversations,
    totalSessions: Math.max(asNumber(raw.totalSessions), totalConversations),
    supportRequests,
    aiOnly,
    savedChats,
    timeline,
  };
}

export async function resolveAllAdminProfiles(user: User): Promise<AdminProfile[]> {
  if (!user.emailVerified) return [];
  const profiles = await requestAccessApi<AdminProfile[]>(user, 'listBusinesses');
  return profiles.filter(profile => ADMIN_ROLES.has(profile.role));
}

export async function ensureVerifiedPendingUser(user: User, _phone?: string) {
  // Identity comes from Firebase Auth; never write verification or membership from the client.
  if (user.emailVerified) await user.getIdToken(true);
}

export async function acceptPendingInvitationsForUser(user: User, _phone?: string): Promise<number> {
  if (!user.emailVerified) return 0;
  const invites = await requestAccessApi<{ id: string; businessId: string }[]>(user, 'listInvitations');
  let accepted = 0;
  for (const invite of invites) {
    await requestAccessApi(user, 'acceptInvitation', { invitationId: invite.id, businessId: invite.businessId });
    accepted++;
  }
  return accepted;
}

export async function resolveAdminProfile(user: User): Promise<AdminProfile | null> {
  return (await resolveAllAdminProfiles(user))[0] || null;
}

export function listenSupportChats(
  businessId: string,
  onData: (chats: SupportChat[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const chatsQuery = query(collection(firebaseDb, `businesses/${businessId}/supportChats`), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    chatsQuery,
    (snapshot) => {
      onData(snapshot.docs.map((chat) => mapChat(businessId, chat.id, chat.data())));
    },
    onError,
  );
}

export function listenBusinessChatAnalytics(
  businessId: string,
  onData: (analytics: ChatAnalytics) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firebaseDb, 'businesses', businessId),
    (snapshot) => {
      onData(snapshot.exists() ? mapChatAnalytics(snapshot.data()) : mapChatAnalytics({}));
    },
    onError,
  );
}

export function listenSupportChat(
  businessId: string,
  chatId: string,
  onData: (chat: SupportChat | null) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firebaseDb, `businesses/${businessId}/supportChats/${chatId}`),
    (snapshot) => {
      onData(snapshot.exists() ? mapChat(businessId, snapshot.id, snapshot.data()) : null);
    },
    onError,
  );
}

export async function sendSupportReply(businessId: string, chat: SupportChat, text: string, admin: AdminProfile) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return;
  }

  const message = {
    id: randomId(),
    role: 'support',
    text: trimmedText,
    createdAt: new Date(),
  };

  const timelineEvent = {
    id: randomId(),
    kind: 'support-message',
    sessionId: chat.sessionId || chat.id,
    widgetKey: chat.widgetKey || undefined,
    countryCode: chat.countryCode || undefined,
    createdAt: new Date(),
  };

  await updateDoc(doc(firebaseDb, `businesses/${businessId}/supportChats/${chat.id}`), {
    status: 'open',
    updatedAt: serverTimestamp(),
    supportTypingAt: null,
    messages: arrayUnion(message),
    messageCount: increment(1),
  });

  await updateDoc(doc(firebaseDb, 'businesses', businessId), {
    'chatAnalytics.timeline': arrayUnion(timelineEvent),
    'chatAnalytics.totalMessages': increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function setSupportTyping(businessId: string, chatId: string, isTyping: boolean) {
  await updateDoc(doc(firebaseDb, `businesses/${businessId}/supportChats/${chatId}`), {
    supportTypingAt: isTyping ? serverTimestamp() : null,
  });
}

export async function closeSupportChat(businessId: string, chat: SupportChat) {
  await deleteDoc(doc(firebaseDb, `businesses/${businessId}/supportChats/${chat.id}`));
}

export async function setSupportChatStatus(businessId: string, chat: SupportChat, status: 'open' | 'ai-active') {
  const isOpen = status === 'open';
  const message = {
    id: randomId(),
    role: 'system',
    text: isOpen ? 'Du har tatt over samtalen.' : 'Samtalen er gitt tilbake til AI.',
    createdAt: new Date(),
  };

  const timelineEvent = {
    id: randomId(),
    kind: isOpen ? 'support-open' : 'support-returned',
    sessionId: chat.sessionId || chat.id,
    widgetKey: chat.widgetKey || undefined,
    countryCode: chat.countryCode || undefined,
    createdAt: new Date(),
  };

  await updateDoc(doc(firebaseDb, `businesses/${businessId}/supportChats/${chat.id}`), {
    status,
    updatedAt: serverTimestamp(),
    messages: arrayUnion(message),
    messageCount: increment(1),
  });

  await updateDoc(doc(firebaseDb, 'businesses', businessId), {
    'chatAnalytics.timeline': arrayUnion(timelineEvent),
    updatedAt: serverTimestamp(),
  });
}
