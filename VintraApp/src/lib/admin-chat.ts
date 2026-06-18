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
  setDoc,
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

function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8) return `47${digits}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function invitationMatchesUser(invite: Record<string, unknown>, email: string, phone: string) {
  const inviteEmail = normalizeEmail(String(invite.email || invite.normalizedEmail || ''));
  const invitePhones = [
    invite.phone,
    invite.telephone,
    invite.phoneNumber,
    invite.normalizedPhone,
  ].map((value) => normalizePhone(String(value || ''))).filter(Boolean);

  return Boolean(
    (email && inviteEmail === email) ||
    (phone && invitePhones.includes(phone))
  );
}

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

export async function ensureVerifiedPendingUser(user: User, phone?: string) {
  const email = normalizeEmail(user.email);
  const savedPhone = phone || user.phoneNumber || '';
  const savedNormalizedPhone = normalizePhone(savedPhone);
  const phonePayload = savedPhone || savedNormalizedPhone
    ? { phone: savedPhone, normalizedPhone: savedNormalizedPhone }
    : {};

  if (user.emailVerified) {
    const pendingUserRef = doc(firebaseDb, 'pending_users', user.uid);
    await setDoc(pendingUserRef, {
      email,
      normalizedEmail: email,
      displayName: user.displayName || '',
      ...phonePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }

  await setDoc(doc(firebaseDb, 'pending_auth', user.uid), {
    email,
    normalizedEmail: email,
    displayName: user.displayName || '',
    ...phonePayload,
    status: user.emailVerified ? 'email-verified' : 'pending-email',
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

export async function acceptPendingInvitationsForUser(user: User, phone?: string): Promise<number> {
  const email = normalizeEmail(user.email);
  let accepted = 0;

  const pendingUserSnap = await getDoc(doc(firebaseDb, 'pending_users', user.uid)).catch(() => null);
  const pendingAuthSnap = await getDoc(doc(firebaseDb, 'pending_auth', user.uid)).catch(() => null);
  const pendingPhone = String(pendingUserSnap?.data()?.phone || pendingAuthSnap?.data()?.phone || '');
  const normalizedPhone = normalizePhone(phone || user.phoneNumber || pendingPhone);

  if (!email && !normalizedPhone) {
    return 0;
  }

  const isVerified = Boolean(user.emailVerified || pendingUserSnap?.exists() || pendingAuthSnap?.data()?.status === 'email-verified');

  if (!isVerified) {
    return 0;
  }

  await ensureVerifiedPendingUser(user, phone || pendingPhone);

  const businessesSnap = await getDocs(collection(firebaseDb, 'businesses'));
  for (const businessDoc of businessesSnap.docs) {
    const invitesSnap = await getDocs(
      query(collection(firebaseDb, `businesses/${businessDoc.id}/invitations`), where('status', '==', 'pending')),
    ).catch(() => null);

    if (!invitesSnap) continue;

    for (const inviteDoc of invitesSnap.docs) {
      const invite = inviteDoc.data() as Record<string, unknown>;
      if (!invitationMatchesUser(invite, email, normalizedPhone)) continue;

      const role = String(invite.role || 'support');
      await setDoc(doc(firebaseDb, `businesses/${businessDoc.id}/users/${user.uid}`), {
        email,
        normalizedEmail: email,
        phone: phone || user.phoneNumber || pendingPhone || '',
        normalizedPhone,
        displayName: user.displayName || '',
        role: ADMIN_ROLES.has(role) ? role : 'support',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await updateDoc(inviteDoc.ref, {
        status: 'accepted',
        usedAt: serverTimestamp(),
        usedBy: user.uid,
      }).catch(() => {});

      accepted += 1;
    }
  }

  if (accepted > 0) {
    await deleteDoc(doc(firebaseDb, 'pending_users', user.uid)).catch(() => {});
  }

  return accepted;
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
