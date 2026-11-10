import test from 'node:test';
import assert from 'node:assert/strict';
import { trackVisibleChat, isViewingNotificationChat } from '../src/lib/notification-visibility.ts';

const chat = { userId: 'staff', businessId: 'business-a', chatId: 'chat-a' };
const message = { type: 'chat', businessId: chat.businessId, chatId: chat.chatId };

test('first message alerts; opening the chat silences follow-ups; leaving restores alerts', () => {
  assert.equal(isViewingNotificationChat(message, true, chat.userId), false);
  const leave = trackVisibleChat(chat);
  try {
    assert.equal(isViewingNotificationChat(message, true, chat.userId), true);
    assert.equal(isViewingNotificationChat(message, true, chat.userId), true);
  } finally { leave(); }
  assert.equal(isViewingNotificationChat(message, true, chat.userId), false);
});

test('background, locked phone or unfocused browser still alerts even with a chat selected', () => {
  const leave = trackVisibleChat(chat);
  try {
    assert.equal(isViewingNotificationChat(message, false, chat.userId), false);
    assert.equal(isViewingNotificationChat(message, true, chat.userId), true);
  } finally { leave(); }
});

test('other chats, businesses, accounts and announcements are never silenced by the open chat', () => {
  const leave = trackVisibleChat(chat);
  try {
    for (const data of [
      { ...message, chatId: 'chat-b' },
      { ...message, businessId: 'business-b' },
      { ...message, type: 'announcement' },
      {},
    ]) assert.equal(isViewingNotificationChat(data, true, chat.userId), false);
    assert.equal(isViewingNotificationChat(message, true, 'other-user'), false);
    assert.equal(isViewingNotificationChat(message, true, undefined), false);
  } finally { leave(); }
});

test('switching chats ignores late cleanup from the previous screen', () => {
  const leaveFirst = trackVisibleChat(chat);
  const leaveSecond = trackVisibleChat({ ...chat, chatId: 'chat-b' });
  try {
    leaveFirst();
    assert.equal(isViewingNotificationChat(message, true, chat.userId), false);
    assert.equal(isViewingNotificationChat({ ...message, chatId: 'chat-b' }, true, chat.userId), true);
  } finally { leaveSecond(); }
  assert.equal(isViewingNotificationChat({ ...message, chatId: 'chat-b' }, true, chat.userId), false);
});
