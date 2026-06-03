import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'no';
export type RawLang = 'auto' | Lang;

const STORAGE_KEY = '@vintra_language';

/* ── Translations ──────────────────────────────────────────────────── */
const T = {
  en: {
    /* Tabs */
    tab_home: 'Home',
    tab_analyse: 'Analytics',
    tab_settings: 'Settings',

    /* Settings */
    settings_title: 'Settings',
    settings_lead: 'Customize notifications, sounds, and account details.',
    settings_section_notif: 'Notifications & Sound',
    settings_notif_label: 'Push Notifications',
    settings_notif_desc: 'Alert when visitors request live agent assistance',
    settings_sound_label: 'Sound Effects',
    settings_sound_desc: 'Play sound for new incoming messages',
    settings_vib_label: 'Haptic Vibration',
    settings_vib_desc: 'Vibrate phone on newly received messages',
    settings_section_lang: 'Language',
    settings_lang_auto: 'Auto (device language)',
    settings_lang_en: 'English',
    settings_lang_no: 'Norwegian',
    settings_section_quick_replies: 'Quick Replies',
    settings_quick_replies_label: 'Show quick replies',
    settings_quick_replies_desc: 'Display reusable message chips in the chat.',
    settings_quick_replies_reset: 'Reset to defaults',
    settings_quick_replies_add: 'Add',
    settings_quick_replies_remove: 'Remove',
    settings_quick_replies_new_label: 'New reply',
    settings_quick_replies_new_message: 'Write your message here.',
    settings_quick_replies_chip_label: 'Button text',
    settings_quick_replies_message_label: 'Message',
    settings_section_account: 'Account',
    settings_agent_name: 'Vintra Agent',
    settings_sign_out: 'Sign Out',
    settings_sign_out_desc: 'Securely sign out of this device',
    settings_sign_out_title: 'Sign Out',
    settings_sign_out_msg: 'Are you sure you want to log out of your Vintra account?',
    settings_cancel: 'Cancel',
    settings_log_out: 'Log Out',

    /* Analytics */
    analyse_title: 'Analytics',
    analyse_sub: 'Live widget activity, support transfers and geography.',
    analyse_updated: 'Updated',
    metric_total_sessions: 'Total sessions',
    metric_only_selected: 'Selected period only',
    metric_support_requests: 'Support requests',
    metric_pct_of_sessions: 'of sessions in period',
    metric_ai_only: 'AI-only sessions',
    metric_ai_pct: 'handled by AI',
    metric_saved_chats: 'Saved support chats',
    metric_pct_of_support: 'of support requests',
    metric_top_country: 'Top country',
    metric_based_on_period: 'Based on selected period',
    metric_last_activity: 'Last activity',
    metric_no_activity: 'No activity',
    tab_overview: 'Overview',
    tab_timeline: 'Timeline',
    tab_geography: 'Geography',
    period_all: 'All',
    chart_seg_title: 'Conversation distribution',
    chart_seg_sub: 'How chats are distributed between AI-only, support requests and saved follow-ups.',
    chart_support_live: 'Live support',
    chart_ai_only: 'AI only',
    chart_saved: 'Saved',
    chart_countries_title: 'Top countries',
    chart_countries_sub: 'Country codes captured from the widget.',
    chart_no_geo: 'No geography data yet',
    chart_timeline_title: 'Activity timeline',
    chart_timeline_sub: 'Number of chats per day in the period.',
    chart_geo_title: 'Geographic distribution',
    chart_geo_sub: 'All countries that have started chats in the selected period.',
    chart_no_activity: 'No activity in the period',
    chart_no_data: 'No data for the period',
    total_conversations: 'conversations total',

    /* Admin panel */
    admin_inbox: 'Inbox',
    admin_search: 'Search conversations…',
    admin_all: 'All',
    admin_waiting: 'Waiting',
    admin_active: 'Active',
    admin_no_conversations: 'No conversations yet',
    admin_no_conversations_sub: 'New support requests will appear here.',
    admin_sign_out: 'Sign out',
    admin_reply_placeholder: 'Write a reply...',
    status_waiting: 'Waiting',
    status_active: 'Active',
    status_ai: 'AI',
  },
  no: {
    /* Tabs */
    tab_home: 'Hjem',
    tab_analyse: 'Analyse',
    tab_settings: 'Innstillinger',

    /* Settings */
    settings_title: 'Innstillinger',
    settings_lead: 'Tilpass varsler, lyder og kontodetaljer.',
    settings_section_notif: 'Varsler og lyd',
    settings_notif_label: 'Push-varsler',
    settings_notif_desc: 'Varsle når besøkende ber om hjelp fra en agent',
    settings_sound_label: 'Lydeffekter',
    settings_sound_desc: 'Spill av lyd for nye innkommende meldinger',
    settings_vib_label: 'Haptisk vibrasjon',
    settings_vib_desc: 'Vibrer telefonen ved nye meldinger',
    settings_section_lang: 'Språk',
    settings_lang_auto: 'Auto (enhetsspråk)',
    settings_lang_en: 'Engelsk',
    settings_lang_no: 'Norsk',
    settings_section_quick_replies: 'Ferdigmeldinger',
    settings_quick_replies_label: 'Vis ferdigmeldinger',
    settings_quick_replies_desc: 'Vis gjenbrukbare meldingsknapper i chatten.',
    settings_quick_replies_reset: 'Tilbakestill',
    settings_quick_replies_add: 'Legg til',
    settings_quick_replies_remove: 'Fjern',
    settings_quick_replies_new_label: 'Ny melding',
    settings_quick_replies_new_message: 'Skriv meldingen din her.',
    settings_quick_replies_chip_label: 'Knappetekst',
    settings_quick_replies_message_label: 'Melding',
    settings_section_account: 'Konto',
    settings_agent_name: 'Vintra Agent',
    settings_sign_out: 'Logg ut',
    settings_sign_out_desc: 'Logg sikkert ut av denne enheten',
    settings_sign_out_title: 'Logg ut',
    settings_sign_out_msg: 'Er du sikker på at du vil logge ut av Vintra-kontoen din?',
    settings_cancel: 'Avbryt',
    settings_log_out: 'Logg ut',

    /* Analytics */
    analyse_title: 'Analyse',
    analyse_sub: 'Live widgetaktivitet, supportoverføringer og geografi.',
    analyse_updated: 'Oppdatert',
    metric_total_sessions: 'Totalt antall økter',
    metric_only_selected: 'Kun valgt periode',
    metric_support_requests: 'Supportforespørsler',
    metric_pct_of_sessions: 'av økter i perioden',
    metric_ai_only: 'Kun AI-økter',
    metric_ai_pct: 'håndtert av AI',
    metric_saved_chats: 'Lagrede supportchatter',
    metric_pct_of_support: 'av supportforespørsler',
    metric_top_country: 'Topp land',
    metric_based_on_period: 'Basert på valgt periode',
    metric_last_activity: 'Siste aktivitet',
    metric_no_activity: 'Ingen aktivitet',
    tab_overview: 'Oversikt',
    tab_timeline: 'Tidslinje',
    tab_geography: 'Geografi',
    period_all: 'Alt',
    chart_seg_title: 'Samtalefordeling',
    chart_seg_sub: 'Hvordan chatter fordeles mellom kun AI, supportforespørsler og lagrede oppfølginger.',
    chart_support_live: 'Support live',
    chart_ai_only: 'Kun AI',
    chart_saved: 'Lagrede',
    chart_countries_title: 'Topp land',
    chart_countries_sub: 'Landkoder fanget opp fra widgeten.',
    chart_no_geo: 'Ingen geografidata enda',
    chart_timeline_title: 'Aktivitetstidslinje',
    chart_timeline_sub: 'Antall chatter per dag i perioden.',
    chart_geo_title: 'Geografisk fordeling',
    chart_geo_sub: 'Alle land som har startet chatter i valgt periode.',
    chart_no_activity: 'Ingen aktivitet i perioden',
    chart_no_data: 'Ingen data for perioden',
    total_conversations: 'samtaler totalt',

    /* Admin panel */
    admin_inbox: 'Innboks',
    admin_search: 'Søk i samtaler…',
    admin_all: 'Alle',
    admin_waiting: 'Venter',
    admin_active: 'Aktiv',
    admin_no_conversations: 'Ingen samtaler ennå',
    admin_no_conversations_sub: 'Nye supportforespørsler vil vises her.',
    admin_sign_out: 'Logg ut',
    admin_reply_placeholder: 'Skriv et svar...',
    status_waiting: 'Venter',
    status_active: 'Aktiv',
    status_ai: 'AI',
  },
} as const;

export type TranslationKey = keyof typeof T.en;

/* ── Context ───────────────────────────────────────────────────────── */
type LangCtx = {
  lang: Lang;
  savedLang: RawLang;
  setLang: (l: RawLang) => void;
  t: (key: TranslationKey) => string;
};

const LangContext = createContext<LangCtx>({
  lang: 'en',
  savedLang: 'auto',
  setLang: () => {},
  t: k => k,
});

function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale.startsWith('nb') || locale.startsWith('nn') || locale.startsWith('no')) return 'no';
  } catch {}
  return 'en';
}

/* ── Provider ──────────────────────────────────────────────────────── */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const deviceLang = useMemo(detectDeviceLang, []);
  const [savedLang, setSavedLangState] = useState<RawLang>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => {
        if (val === 'en' || val === 'no' || val === 'auto') setSavedLangState(val);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback(
    (l: RawLang) => {
      setSavedLangState(l);
      AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
    },
    [],
  );

  const lang: Lang = savedLang === 'auto' ? deviceLang : savedLang;

  const t = useCallback(
    (key: TranslationKey): string => (T[lang] as Record<string, string>)[key] ?? (T.en as Record<string, string>)[key] ?? key,
    [lang],
  );

  return (
    <LangContext.Provider value={{ lang, savedLang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LangContext);
}
