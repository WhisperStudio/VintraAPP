import { getIdTokenResult, type User } from 'firebase/auth';
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
  where,
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
  messageCount: number;
  messages: SupportMessage[];
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
    id: String(value.id || randomId()),
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
    messageCount: Number(data.messageCount || messages.length),
    messages,
  };
}

async function profileFromBusiness(user: User, businessId: string): Promise<AdminProfile | null> {
  const membershipRef = doc(firebaseDb, `businesses/${businessId}/users/${user.uid}`);
  const membership = await getDoc(membershipRef);

  if (!membership.exists()) {
    return null;
  }

  const data = membership.data();
  const role = String(data.role || '');
  const status = String(data.status || 'active');

  if (!ADMIN_ROLES.has(role) || status !== 'active') {
    return null;
  }

  return {
    businessId,
    role,
    email: String(data.email || user.email || ''),
    displayName: data.displayName ? String(data.displayName) : user.displayName || undefined,
  };
}

export async function resolveAllAdminProfiles(user: User): Promise<AdminProfile[]> {
  const results: AdminProfile[] = [];
  const seen = new Set<string>();

  function bizName(bizData: Record<string, unknown> | undefined, fallback: string): string {
    if (!bizData) return fallback;
    return String(bizData.name || bizData.businessName || bizData.widgetName || bizData.displayName || '') || fallback;
  }

  // Owned businesses — add as owner directly without subcollection check,
  // because the owner may not have a membership doc in their own business.
  async function addOwnedBusiness(businessId: string, bizData: Record<string, unknown>): Promise<void> {
    if (seen.has(businessId)) return;
    seen.add(businessId);
    results.push({
      businessId,
      role: 'owner',
      email: String(user.email || ''),
      displayName: user.displayName || undefined,
      businessName: bizName(bizData, businessId),
    });
  }

  // Non-owned businesses — verify via subcollection membership.
  async function tryMemberBusiness(businessId: string, bizData?: Record<string, unknown>): Promise<void> {
    if (seen.has(businessId)) return;
    seen.add(businessId);
    try {
      const memberSnap = await getDoc(doc(firebaseDb, `businesses/${businessId}/users/${user.uid}`));
      if (!memberSnap.exists()) return;
      const data = memberSnap.data();
      const role = String(data.role || '');
      const status = String(data.status || 'active');
      if (!ADMIN_ROLES.has(role) || status !== 'active') return;
      if (!bizData) {
        const bizDoc = await getDoc(doc(firebaseDb, 'businesses', businessId));
        if (bizDoc.exists()) bizData = bizDoc.data() as Record<string, unknown>;
      }
      results.push({
        businessId,
        role,
        email: String(data.email || user.email || ''),
        displayName: data.displayName ? String(data.displayName) : user.displayName || undefined,
        businessName: bizName(bizData, businessId),
      });
    } catch {
      // Permission denied or network error for this business — skip silently.
    }
  }

  // 1. JWT claim (may be a non-owned business the user is a member of)
  const token = await getIdTokenResult(user, true).catch(() => null);
  const claimedId = String(token?.claims.businessId || token?.claims.business_id || '');
  if (claimedId) await tryMemberBusiness(claimedId);

  // 2. All businesses owned by this user (bypasses subcollection)
  try {
    const ownedSnap = await getDocs(query(collection(firebaseDb, 'businesses'), where('ownerId', '==', user.uid)));
    for (const biz of ownedSnap.docs) {
      await addOwnedBusiness(biz.id, biz.data() as Record<string, unknown>);
    }
  } catch { /* ignore */ }

  // 3. All businesses — catch any remaining member access
  try {
    const allSnap = await getDocs(collection(firebaseDb, 'businesses'));
    for (const biz of allSnap.docs) {
      await tryMemberBusiness(biz.id, biz.data() as Record<string, unknown>);
    }
  } catch { /* ignore */ }

  return results;
}

export async function resolveAdminProfile(user: User): Promise<AdminProfile | null> {
  const token = await getIdTokenResult(user, true).catch(() => null);
  const claimedBusinessId = token?.claims.businessId || token?.claims.business_id;

  if (typeof claimedBusinessId === 'string') {
    const profile = await profileFromBusiness(user, claimedBusinessId);
    if (profile) {
      return profile;
    }
  }

  const ownedBusinesses = await getDocs(query(collection(firebaseDb, 'businesses'), where('ownerId', '==', user.uid)));

  for (const business of ownedBusinesses.docs) {
    const profile = await profileFromBusiness(user, business.id);
    if (profile) {
      return profile;
    }
  }

  const businesses = await getDocs(collection(firebaseDb, 'businesses'));

  for (const business of businesses.docs) {
    const profile = await profileFromBusiness(user, business.id);
    if (profile) {
      return profile;
    }
  }

  return null;
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
    messages: arrayUnion(message),
    messageCount: increment(1),
  });

  await updateDoc(doc(firebaseDb, 'businesses', businessId), {
    'chatAnalytics.timeline': arrayUnion(timelineEvent),
    'chatAnalytics.totalMessages': increment(1),
    updatedAt: serverTimestamp(),
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
    text: isOpen ? 'The chat has been handed over to human support.' : 'The chat has been returned to the AI assistant.',
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
