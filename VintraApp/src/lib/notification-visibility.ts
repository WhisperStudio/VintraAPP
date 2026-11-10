type VisibleChat = { userId: string; businessId: string; chatId: string };

let visibleChat: VisibleChat | null = null;

/** Register only the conversation actually rendered on the focused screen. */
export function trackVisibleChat(chat: VisibleChat) {
  visibleChat = chat;
  return () => {
    if (visibleChat === chat) visibleChat = null;
  };
}

export function isViewingNotificationChat(
  data: Record<string, unknown>,
  foreground: boolean,
  userId: string | undefined,
) {
  return Boolean(
    foreground &&
      visibleChat &&
      userId === visibleChat.userId &&
      data.type === 'chat' &&
      data.businessId === visibleChat.businessId &&
      data.chatId === visibleChat.chatId,
  );
}
