import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationCenter,
  queueAnnouncement,
  registerNotificationDevice,
  unregisterNotificationDevice,
} from './index.js';
const verifiedStaff = {
  uid: 'staff',
  token: { email_verified: true, email: 'staff@example.com' },
};
const admin = {
  uid: 'admin',
  token: { email_verified: true, superAdmin: true },
};
test('all callables reject anonymous and unverified requests before accessing data', async () => {
  for (const fn of [
    notificationCenter,
    queueAnnouncement,
    registerNotificationDevice,
    unregisterNotificationDevice,
  ]) {
    await assert.rejects(fn.run({ data: {} }), { code: 'unauthenticated' });
    await assert.rejects(
      fn.run({
        auth: { uid: 'u', token: { email_verified: false } },
        data: {},
      }),
      { code: 'unauthenticated' },
    );
  }
});
test('ordinary staff cannot inspect history or broadcast', async () => {
  for (const fn of [notificationCenter, queueAnnouncement])
    await assert.rejects(fn.run({ auth: verifiedStaff, data: {} }), {
      code: 'permission-denied',
    });
});
test('announcement endpoint validates content, target and idempotency key', async () => {
  const good = {
    title: 'Hello',
    body: 'A message',
    targetBusinessId: 'all',
    requestId: 'request-1234567890',
  };
  for (const patch of [
    { title: '' },
    { body: ' ' },
    { title: 'x'.repeat(81) },
    { body: 'x'.repeat(301) },
    { targetBusinessId: 'a/b' },
    { requestId: 'short' },
  ]) {
    await assert.rejects(
      queueAnnouncement.run({ auth: admin, data: { ...good, ...patch } }),
      { code: 'invalid-argument' },
    );
  }
});
test('device endpoint rejects malformed tokens and platforms before data access', async () => {
  for (const data of [
    { token: 'not-expo', businessIds: [], platform: 'ios' },
    { token: 'ExpoPushToken[abc]', businessIds: [], platform: 'web' },
    { token: 'ExpoPushToken[abc]', businessIds: ['a/b'], platform: 'ios' },
  ]) {
    await assert.rejects(
      registerNotificationDevice.run({ auth: verifiedStaff, data }),
      { code: 'invalid-argument' },
    );
  }
});
