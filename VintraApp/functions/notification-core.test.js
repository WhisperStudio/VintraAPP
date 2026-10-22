import test from 'node:test';
import assert from 'node:assert/strict';
import {
  incomingMessages,
  deliveryStatus,
  validToken,
  isSuperAdmin,
  isMember,
  channelId,
} from './notification-core.js';
const msg = (id, role = 'user') => ({ id, role, text: 'Hello' });
test('notifies each visitor message even when an AI reply is last', () => {
  assert.deepEqual(
    incomingMessages(
      { messages: [msg('1')] },
      { messages: [msg('1'), msg('2'), msg('3'), msg('4', 'assistant')] },
    ).map((m) => m.id),
    ['2', '3'],
  );
});
test('typing updates, duplicate messages and staff replies do not alert', () => {
  assert.deepEqual(
    incomingMessages(
      { messages: [msg('1')] },
      { messages: [msg('1'), msg('2', 'support'), msg('3', 'system')] },
    ),
    [],
  );
  assert.equal(
    incomingMessages(null, { messages: [msg('1'), msg('1')] }).length,
    1,
  );
});
test('legacy messages without ids have stable identities', () => {
  const m = { text: 'Hello', createdAt: '2026-01-01' };
  assert.equal(
    incomingMessages({ messages: [m] }, { messages: [m] }).length,
    0,
  );
  assert.equal(incomingMessages(null, { messages: [m] }).length, 1);
});
test('no audience and failed sends never report success', () => {
  assert.equal(deliveryStatus(0, 0, 0), 'no-recipients');
  assert.equal(deliveryStatus(2, 0, 2), 'failed');
  assert.equal(deliveryStatus(2, 1, 1), 'partial');
  assert.equal(deliveryStatus(2, 2, 0), 'accepted');
});
test('verified admin identity and active membership required', () => {
  assert.equal(
    isSuperAdmin({ email: 'vintrastudio@gmail.com', email_verified: false }),
    false,
  );
  assert.equal(
    isSuperAdmin({ email: 'other@example.com', email_verified: true }),
    false,
  );
  assert.equal(isSuperAdmin({ superAdmin: true, email_verified: true }), true);
  assert.ok(isMember({ ownerId: 'u' }, null, 'u'));
  assert.equal(isMember({}, { role: 'admin', status: 'disabled' }, 'u'), false);
});
test('validates Expo tokens and all sound/vibration combinations', () => {
  assert.ok(validToken('ExponentPushToken[abc-123]'));
  assert.equal(validToken('not-a-token'), false);
  assert.equal(
    new Set([
      channelId(true, true),
      channelId(false, true),
      channelId(true, false),
      channelId(false, false),
    ]).size,
    4,
  );
});
