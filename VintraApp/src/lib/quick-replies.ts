import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lang } from '@/lib/i18n';

export type QuickReply = {
  id: string;
  label: string;
  value: string;
};

const ENABLED_KEY = '@vintra_quick_replies_enabled';
const repliesKey = (lang: Lang) => `@vintra_quick_replies_${lang}`;

const DEFAULT_QUICK_REPLIES: Record<Lang, QuickReply[]> = {
  en: [
    { id: 'hello', label: 'Hello', value: 'Hello! How can I help you today?' },
    { id: 'looking', label: 'Looking', value: 'Let me look into that for you. One moment, please.' },
    { id: 'resolved', label: 'Resolved', value: 'I have resolved this. Let me know if there is anything else!' },
    { id: 'email', label: 'Email?', value: 'Could you provide your email so I can follow up?' },
    { id: 'thanks', label: 'Thanks', value: 'Thank you for reaching out! Have an amazing day.' },
  ],
  no: [
    { id: 'hello', label: 'Hei', value: 'Hei! Hvordan kan jeg hjelpe deg i dag?' },
    { id: 'looking', label: 'Sjekker', value: 'Jeg skal se nærmere på det for deg. Ett øyeblikk.' },
    { id: 'resolved', label: 'Løst', value: 'Dette er løst. Si fra hvis det er noe mer jeg kan hjelpe med!' },
    { id: 'email', label: 'E-post?', value: 'Kan du sende e-postadressen din, så kan jeg følge opp?' },
    { id: 'thanks', label: 'Takk', value: 'Takk for at du tok kontakt! Ha en fin dag.' },
  ],
};

export function getDefaultQuickReplies(lang: Lang) {
  return DEFAULT_QUICK_REPLIES[lang].map(reply => ({ ...reply }));
}

export async function loadQuickRepliesEnabled() {
  const saved = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
  return saved === null ? true : saved === 'true';
}

export async function saveQuickRepliesEnabled(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
}

export async function loadQuickReplies(lang: Lang) {
  const defaults = getDefaultQuickReplies(lang);
  const saved = await AsyncStorage.getItem(repliesKey(lang)).catch(() => null);
  if (!saved) return defaults;

  try {
    const parsed = JSON.parse(saved) as QuickReply[];
    const mergedDefaults = defaults.map(defaultReply => {
      const custom = parsed.find(reply => reply.id === defaultReply.id);
      return custom
        ? {
            ...defaultReply,
            label: custom.label || defaultReply.label,
            value: custom.value || defaultReply.value,
          }
        : defaultReply;
    });
    const customReplies = parsed.filter(reply => !defaults.some(defaultReply => defaultReply.id === reply.id));
    return [...mergedDefaults, ...customReplies];
  } catch {
    return defaults;
  }
}

export async function saveQuickReplies(lang: Lang, replies: QuickReply[]) {
  await AsyncStorage.setItem(repliesKey(lang), JSON.stringify(replies));
}
