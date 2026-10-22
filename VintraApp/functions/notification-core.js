import { createHash } from 'node:crypto';

export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const validToken = (token) =>
  typeof token === 'string' &&
  /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token);
export const isSuperAdmin = (token) =>
  token?.email_verified === true &&
  (token.superAdmin === true ||
    token.email?.toLowerCase() === 'vintrastudio@gmail.com');
export const isMember = (business, membership, uid) =>
  business?.ownerId === uid ||
  (membership &&
    ['owner', 'admin', 'support'].includes(membership.role) &&
    (membership.status || 'active') === 'active');
export function messageKey(message) {
  return String(
    message.id ||
      hash(JSON.stringify([message.role, message.text, message.createdAt])),
  );
}
export function incomingMessages(before, after) {
  const seen = new Set((before?.messages || []).map(messageKey));
  return (after?.messages || []).filter((message) => {
    const key = messageKey(message);
    if (seen.has(key)) return false;
    seen.add(key);
    return (
      (!message.role || message.role === 'user') &&
      typeof message.text === 'string' &&
      message.text.trim()
    );
  });
}
export function channelId(sound = true, vibration = true) {
  return `messages-${sound ? 'sound' : 'silent'}-${vibration ? 'vibrate' : 'still'}`;
}
export function deliveryStatus(total, accepted, failed) {
  if (!total) return 'no-recipients';
  if (!failed) return 'accepted';
  return accepted ? 'partial' : 'failed';
}
