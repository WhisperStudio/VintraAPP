import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  onDocumentWritten,
  onDocumentCreated,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  hash,
  validToken,
  isSuperAdmin,
  isMember,
  incomingMessages,
  messageKey,
  channelId,
  deliveryStatus,
} from './notification-core.js';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const db = getFirestore();
const devices = db.collection('notificationDevices');
const jobs = db.collection('notificationJobs');
const receipts = db.collection('notificationReceipts');

function requireUser(request) {
  if (!request.auth || request.auth.token.email_verified !== true)
    throw new HttpsError('unauthenticated', 'Sign in with a verified account.');
  return request.auth;
}
function requireAdmin(request) {
  const auth = requireUser(request);
  if (!isSuperAdmin(auth.token))
    throw new HttpsError(
      'permission-denied',
      'Only a notification administrator can send announcements.',
    );
  return auth;
}
async function hasAccess(uid, businessId) {
  const [business, member] = await Promise.all([
    db.doc(`businesses/${businessId}`).get(),
    db.doc(`businesses/${businessId}/users/${uid}`).get(),
  ]);
  return business.exists && isMember(business.data(), member.data(), uid);
}

export const registerNotificationDevice = onCall(async (request) => {
  const auth = requireUser(request);
  const { token, businessIds, enabled, sound, vibration, platform } =
    request.data || {};
  if (
    !validToken(token) ||
    !Array.isArray(businessIds) ||
    businessIds.length > 100 ||
    !['ios', 'android'].includes(platform)
  ) {
    throw new HttpsError('invalid-argument', 'Invalid device registration.');
  }
  const allowed = [];
  for (const id of new Set(businessIds)) {
    if (typeof id !== 'string' || !id || id.includes('/'))
      throw new HttpsError('invalid-argument', 'Invalid business.');
    if (await hasAccess(auth.uid, id)) allowed.push(id);
  }
  // One record per physical token: multiple phones never overwrite each other.
  // Reassignment on login prevents the previous account receiving private messages.
  await devices.doc(hash(token)).set({
    token,
    userId: auth.uid,
    businessIds: allowed,
    enabled: enabled !== false,
    sound: sound !== false,
    vibration: vibration !== false,
    platform,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { registered: true, businesses: allowed.length };
});

export const unregisterNotificationDevice = onCall(async (request) => {
  const auth = requireUser(request);
  if (!validToken(request.data?.token))
    throw new HttpsError('invalid-argument', 'Invalid token.');
  const ref = devices.doc(hash(request.data.token));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.userId === auth.uid) tx.delete(ref);
  });
  return { removed: true };
});

export const notificationCenter = onCall(async (request) => {
  requireAdmin(request);
  const [businesses, registered, history] = await Promise.all([
    db.collection('businesses').get(),
    devices.where('enabled', '==', true).get(),
    db
      .collection('notificationAnnouncements')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
  ]);
  return {
    businesses: businesses.docs.map((d) => ({
      id: d.id,
      name: d.data().businessName || d.data().name || d.id,
      devices: registered.docs.filter((device) =>
        device.data().businessIds?.includes(d.id),
      ).length,
    })),
    devices: registered.size,
    history: (await Promise.all(history.docs.map((d) => jobs.doc(d.id).get())))
      .filter((d) => d.exists)
      .map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toMillis() || 0,
      })),
  };
});

export const queueAnnouncement = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { title, body, targetBusinessId, requestId, testToken } =
    request.data || {};
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 80 ||
    typeof body !== 'string' ||
    !body.trim() ||
    body.length > 300 ||
    typeof targetBusinessId !== 'string' ||
    !targetBusinessId ||
    targetBusinessId.includes('/') ||
    typeof requestId !== 'string' ||
    !/^[\w-]{12,100}$/.test(requestId)
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Choose an audience and enter a title (80 characters) and message (300 characters).',
    );
  }
  if (testToken) {
    if (!validToken(testToken))
      throw new HttpsError('invalid-argument', 'Register this device first.');
    const device = await devices.doc(hash(testToken)).get();
    if (device.data()?.userId !== auth.uid || !device.data()?.enabled)
      throw new HttpsError(
        'permission-denied',
        'Enable notifications on this device first.',
      );
  } else if (
    targetBusinessId !== 'all' &&
    !(await db.doc(`businesses/${targetBusinessId}`).get()).exists
  ) {
    throw new HttpsError('not-found', 'This business no longer exists.');
  }
  const id = hash(`${auth.uid}:${requestId}`);
  await db.runTransaction(async (tx) => {
    const ref = jobs.doc(id);
    if ((await tx.get(ref)).exists) return;
    tx.create(db.collection('notificationAnnouncements').doc(id), {
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(ref, {
      kind: 'announcement',
      title: title.trim(),
      body: body.trim(),
      targetBusinessId,
      ...(testToken ? { testToken } : {}),
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      status: 'queued',
      data: { type: 'announcement' },
    });
  });
  return { id, status: 'queued' };
});

// Listen to the schema used by the website and mobile app: messages embedded in supportChats.
// Diff every message, not only the last one, so visitor + AI writes cannot hide an alert.
export const notifyIncomingChat = onDocumentWritten(
  { document: 'businesses/{businessId}/supportChats/{chatId}', retry: true },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;
    const before = event.data.before.data();
    for (const message of incomingMessages(before, after)) {
      const { businessId, chatId } = event.params;
      const id = hash(`${businessId}:${chatId}:${messageKey(message)}`);
      await db.runTransaction(async (tx) => {
        const ref = jobs.doc(id);
        if ((await tx.get(ref)).exists) return;
        tx.create(ref, {
          kind: 'chat',
          title: after.visitorName || after.pageTitle || 'New customer message',
          body: message.text.slice(0, 300),
          targetBusinessId: businessId,
          data: {
            type: 'chat',
            businessId,
            chatId,
            widgetKey: after.widgetKey || '',
          },
          status: 'queued',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
    }
  },
);

async function expo(path, payload) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Push service returned ${response.status}`);
  const json = await response.json();
  if (!json.data)
    throw new Error(
      json.errors?.[0]?.message || 'Invalid push service response',
    );
  return json.data;
}

async function deliver(ref) {
  const job = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (
      !data ||
      !['queued', 'retry', 'sending'].includes(data.status) ||
      data.leaseUntil?.toMillis() > Date.now()
    )
      return null;
    tx.update(ref, {
      status: 'sending',
      leaseUntil: Timestamp.fromMillis(Date.now() + 180000),
      attempts: FieldValue.increment(1),
    });
    return data;
  });
  if (!job) return;
  try {
    // Single-field queries keep setup independent of composite Firestore indexes.
    let target = devices.where('enabled', '==', true);
    if (job.testToken) target = devices.where('token', '==', job.testToken);
    else if (job.targetBusinessId !== 'all')
      target = devices.where(
        'businessIds',
        'array-contains',
        job.targetBusinessId,
      );
    const snapshot = await target.get();
    let accepted = job.sentCount || 0;
    let failed = job.failedCount || 0;
    const errors = new Set(job.errors || []);
    for (const device of snapshot.docs) {
      const attemptRef = ref.collection('attempts').doc(device.id);
      if ((await attemptRef.get()).exists) continue;
      const current = await device.ref.get();
      const d = current.data();
      if (!d?.enabled || !validToken(d.token)) continue;
      if (job.testToken && d.userId !== job.createdBy) continue;
      if (
        job.targetBusinessId !== 'all' &&
        !job.testToken &&
        !(await hasAccess(d.userId, job.targetBusinessId))
      )
        continue;
      // Persist the result before moving to the next device. Retries skip accepted tickets.
      const tickets = await expo('send', [
        {
          to: d.token,
          title: job.title,
          body: job.body,
          data: { ...job.data, notificationId: ref.id },
          sound: d.sound ? 'default' : null,
          channelId: channelId(d.sound, d.vibration),
          priority: 'high',
          ttl: 86400,
        },
      ]);
      const ticket = tickets[0];
      if (!ticket || !['ok', 'error'].includes(ticket.status))
        throw new Error('Missing push ticket');
      const batch = db.batch();
      if (ticket.status === 'ok') {
        accepted++;
        if (ticket.id)
          batch.set(receipts.doc(ticket.id), {
            jobId: ref.id,
            deviceId: device.id,
            createdAt: FieldValue.serverTimestamp(),
            status: 'pending',
          });
      } else {
        const reason =
          ticket.details?.error || ticket.message || 'Push rejected';
        if (reason === 'MessageRateExceeded') throw new Error(reason);
        failed++;
        errors.add(reason);
        if (reason === 'DeviceNotRegistered')
          batch.update(device.ref, { enabled: false });
      }
      batch.set(attemptRef, {
        status: ticket.status,
        ticketId: ticket.id || null,
      });
      batch.update(ref, {
        sentCount: accepted,
        failedCount: failed,
        errors: [...errors].slice(0, 5),
        leaseUntil: Timestamp.fromMillis(Date.now() + 180000),
      });
      await batch.commit();
    }
    await ref.update({
      status: deliveryStatus(accepted + failed, accepted, failed),
      recipients: accepted + failed,
      sentCount: accepted,
      failedCount: failed,
      leaseUntil: null,
      completedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    const exhausted = (job.attempts || 0) >= 4;
    await ref.update({
      status: exhausted ? 'failed' : 'retry',
      leaseUntil: Timestamp.fromMillis(Date.now() + 60000),
      errors: [String(error.message || error)],
      ...(exhausted ? { completedAt: FieldValue.serverTimestamp() } : {}),
    });
  }
}
export const deliverNotification = onDocumentCreated(
  { document: 'notificationJobs/{jobId}', timeoutSeconds: 540, retry: true },
  (event) => deliver(event.data.ref),
);
export const retryNotifications = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 540 },
  async () => {
    const pending = await jobs
      .where('status', 'in', ['queued', 'retry', 'sending'])
      .limit(50)
      .get();
    for (const job of pending.docs) await deliver(job.ref);
  },
);
export const checkNotificationReceipts = onSchedule(
  'every 15 minutes',
  async () => {
    const pending = await receipts
      .where('status', '==', 'pending')
      .limit(100)
      .get();
    const ready = pending.docs.filter(
      (d) => d.data().createdAt?.toMillis() < Date.now() - 60000,
    );
    if (!ready.length) return;
    const results = await expo('getReceipts', { ids: ready.map((d) => d.id) });
    for (const receipt of ready) {
      const result = results[receipt.id];
      if (
        !result &&
        receipt.data().createdAt.toMillis() > Date.now() - 86400000
      )
        continue;
      const batch = db.batch();
      batch.update(receipt.ref, {
        status: result?.status || 'expired',
        checkedAt: FieldValue.serverTimestamp(),
      });
      const job = jobs.doc(receipt.data().jobId);
      if (result?.status === 'ok')
        batch.update(job, { confirmedCount: FieldValue.increment(1) });
      else {
        batch.update(job, {
          receiptFailedCount: FieldValue.increment(1),
          errors: FieldValue.arrayUnion(
            result?.details?.error || 'Receipt unavailable',
          ),
        });
        if (result?.details?.error === 'DeviceNotRegistered')
          batch.set(
            devices.doc(receipt.data().deviceId),
            { enabled: false },
            { merge: true },
          );
      }
      await batch.commit();
    }
  },
);
