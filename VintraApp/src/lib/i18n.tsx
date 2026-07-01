import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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
    theme_prompt_title: 'Choose appearance',
    theme_prompt_lead: 'Pick the mode you want to use in Vintra. You can change it later in settings.',

    /* Onboarding tutorial */
    onboard_skip: 'Skip',
    onboard_next: 'Next',
    onboard_back: 'Back',
    onboard_start: 'Get started',
    onboard_step: 'Step',
    onboard_of: 'of',
    onboard_welcome_eyebrow: 'Welcome aboard',
    onboard_welcome_title: 'Welcome, {name}',
    onboard_welcome_body: 'Vintra is your live support command center. Let\'s take a quick tour of everything you can do.',
    onboard_inbox_title: 'Live inbox',
    onboard_inbox_body: 'See every conversation in real time. Jump in to take over from the AI whenever a visitor needs a human touch.',
    onboard_analytics_title: 'Analytics',
    onboard_analytics_body: 'Track sessions, support transfers and visitor geography with beautiful live charts and insights.',
    onboard_settings_title: 'Make it yours',
    onboard_settings_body: 'Fine-tune notifications, sounds, quick replies, language and appearance so Vintra works exactly how you like.',
    onboard_ready_title: 'You\'re all set',
    onboard_ready_body: 'That\'s it! Your workspace is ready. Dive in and start delighting your customers.',

    /* Auth */
    auth_support_console: 'Support console',
    auth_register_banner_title: 'Coming soon',
    auth_register_banner_msg: 'Account creation via the app is coming soon. For now, please create your account at vintranordic.com',
    auth_sign_in: 'Sign In',
    auth_register: 'Register',
    auth_create_account: 'Create Account',
    auth_full_name: 'Full name',
    auth_email: 'Email',
    auth_phone_invite: 'Phone for invite verification',
    auth_password: 'Password',
    auth_missing_info_title: 'Missing info',
    auth_missing_info_msg: 'Fill in email and password to continue.',
    auth_missing_name_title: 'Missing name',
    auth_missing_name_msg: 'Please enter your name before creating an account.',
    auth_verify_title: 'Verify your email',
    auth_verify_msg: 'We sent a verification link to your email. Verify it, then sign in here to access your workspace.',
    auth_verify_needed_title: 'Email not verified',
    auth_verify_needed_msg: 'You need to verify your email before signing in. We just sent you a new verification link — check your inbox (and spam folder).',
    auth_access_activated_title: 'Access activated',
    auth_access_activated_msg: 'Your invitation was verified and connected to this account.',
    auth_registration_failed: 'Registration failed',
    auth_sign_in_failed: 'Sign in failed',
    auth_generic_error: 'Could not sign in at this moment.',

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
    settings_section_appearance: 'Appearance',
    settings_theme_light: 'Light mode',
    settings_theme_dark: 'Dark mode',
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
    settings_chatbot_title: 'Inbox chatbot',
    settings_chatbot_desc: 'Choose which chatbot the admin inbox should show.',
    settings_chatbot_all: 'All chatbots',
    settings_chatbot_active: 'Active',
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
    metric_from_firebase: 'Firebase total',
    metric_messages: 'messages',
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
    cached: 'Cached',

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
    admin_search_short: 'Search',
    admin_try_another: 'Try another search or inbox category.',
    admin_needs_reply: 'Needs reply',
    admin_active_section: 'Active',
    admin_visitor: 'Visitor',
    admin_no_messages: 'No messages yet',
    admin_message_one: 'message',
    admin_message_other: 'messages',
    admin_just_now: 'Just now',
    admin_minutes_ago: 'm ago',
    admin_hours_ago: 'h ago',
    admin_days_ago: 'd ago',
    admin_join_title: 'Join before replying',
    admin_join_sub: 'Tap join to take over the conversation. The customer will see that you have taken over.',
    admin_select_conversation: 'Select a conversation',
    admin_select_conversation_sub: 'Pick a chat from the left panel to start responding to your visitors.',
    admin_checking_access: 'Checking access...',
    admin_access_denied: 'Access denied',
    admin_no_permission: 'You do not have permission to view messages yet.',
    admin_switch_workspace: 'Switch workspace',
    admin_live_console: 'Live console',
    admin_new: 'New',
    admin_open: 'Open',
    admin_total: 'Total',
    admin_chats: 'Chats',
    admin_needs: 'Needs',
    admin_close_conversation: 'Close conversation',
    admin_close_conversation_msg: 'Close the conversation with {name}? This cannot be undone.',
    admin_close: 'Close',
    admin_join: 'Join',
    admin_you_have_joined: 'You have joined',
    admin_join_take_over: 'Join and take over',
    admin_give_to_ai: 'Give to AI',
    admin_resolve: 'Resolve',
    admin_take_over: 'Take over',
    admin_you_are_handling: 'You are handling',
    admin_assign_to_you: 'Assign to you',
    admin_ai_handling: 'AI is handling',
    admin_let_ai_answer: 'Let AI answer',
    admin_visitor_typing: 'Visitor is typing',
    status_waiting: 'Waiting',
    status_active: 'Active',
    status_ai: 'AI',
  },
  no: {
    /* Tabs */
    tab_home: 'Hjem',
    tab_analyse: 'Analyse',
    tab_settings: 'Innstillinger',
    theme_prompt_title: 'Velg utseende',
    theme_prompt_lead: 'Velg modusen du vil bruke i Vintra. Du kan endre det senere i innstillinger.',

    /* Onboarding tutorial */
    onboard_skip: 'Hopp over',
    onboard_next: 'Neste',
    onboard_back: 'Tilbake',
    onboard_start: 'Kom i gang',
    onboard_step: 'Steg',
    onboard_of: 'av',
    onboard_welcome_eyebrow: 'Velkommen om bord',
    onboard_welcome_title: 'Velkommen, {name}',
    onboard_welcome_body: 'Vintra er kommandosenteret ditt for live support. La oss ta en rask omvisning av alt du kan gjøre.',
    onboard_inbox_title: 'Live innboks',
    onboard_inbox_body: 'Se alle samtaler i sanntid. Hopp inn og ta over fra AI-en når en besøkende trenger en menneskelig hånd.',
    onboard_analytics_title: 'Analyse',
    onboard_analytics_body: 'Følg økter, supportoverføringer og besøkendes geografi med vakre live-grafer og innsikt.',
    onboard_settings_title: 'Gjør den til din',
    onboard_settings_body: 'Finjuster varsler, lyder, ferdigmeldinger, språk og utseende slik at Vintra fungerer akkurat som du vil.',
    onboard_ready_title: 'Alt er klart',
    onboard_ready_body: 'Det var det! Arbeidsområdet ditt er klart. Sett i gang og gjør kundene dine fornøyde.',

    /* Auth */
    auth_support_console: 'Supportkonsoll',
    auth_register_banner_title: 'Kommer snart',
    auth_register_banner_msg: 'Kontoopprettelse via appen kommer snart. Foreløpig, vennligst opprett kontoen din på vintranordic.com',
    auth_sign_in: 'Logg inn',
    auth_register: 'Registrer',
    auth_create_account: 'Opprett konto',
    auth_full_name: 'Fullt navn',
    auth_email: 'E-post',
    auth_phone_invite: 'Telefon for invitasjonsverifisering',
    auth_password: 'Passord',
    auth_missing_info_title: 'Mangler info',
    auth_missing_info_msg: 'Fyll inn e-post og passord for å fortsette.',
    auth_missing_name_title: 'Mangler navn',
    auth_missing_name_msg: 'Skriv inn navnet ditt før du oppretter konto.',
    auth_verify_title: 'Bekreft e-posten din',
    auth_verify_msg: 'Vi sendte en bekreftelseslenke til e-posten din. Bekreft den, og logg deretter inn her for å få tilgang til arbeidsområdet ditt.',
    auth_verify_needed_title: 'E-post ikke bekreftet',
    auth_verify_needed_msg: 'Du må bekrefte e-posten din før du logger inn. Vi har akkurat sendt deg en ny bekreftelseslenke — sjekk innboksen (og søppelpost).',
    auth_access_activated_title: 'Tilgang aktivert',
    auth_access_activated_msg: 'Invitasjonen din ble verifisert og koblet til denne kontoen.',
    auth_registration_failed: 'Registrering mislyktes',
    auth_sign_in_failed: 'Innlogging mislyktes',
    auth_generic_error: 'Kunne ikke logge inn akkurat nå.',

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
    settings_section_appearance: 'Utseende',
    settings_theme_light: 'Lys modus',
    settings_theme_dark: 'Mørk modus',
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
    settings_chatbot_title: 'Innboks-chatbot',
    settings_chatbot_desc: 'Velg hvilken chatbot admin-innboksen skal vise.',
    settings_chatbot_all: 'Alle chatboter',
    settings_chatbot_active: 'Aktiv',
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
    metric_from_firebase: 'Firebase-total',
    metric_messages: 'meldinger',
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
    cached: 'Mellomlagret',

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
    admin_search_short: 'Søk',
    admin_try_another: 'Prøv et annet søk eller en annen innbokskategori.',
    admin_needs_reply: 'Trenger svar',
    admin_active_section: 'Aktive',
    admin_visitor: 'Besøkende',
    admin_no_messages: 'Ingen meldinger ennå',
    admin_message_one: 'melding',
    admin_message_other: 'meldinger',
    admin_just_now: 'Akkurat nå',
    admin_minutes_ago: ' min siden',
    admin_hours_ago: ' t siden',
    admin_days_ago: ' d siden',
    admin_join_title: 'Bli med før du svarer',
    admin_join_sub: 'Trykk join for å ta over samtalen. Kunden ser at du har tatt over.',
    admin_select_conversation: 'Velg en samtale',
    admin_select_conversation_sub: 'Velg en chat fra venstre panel for å svare besøkende.',
    admin_checking_access: 'Sjekker tilgang...',
    admin_access_denied: 'Ingen tilgang',
    admin_no_permission: 'Du har ikke tilgang til å se meldinger ennå.',
    admin_switch_workspace: 'Bytt arbeidsområde',
    admin_live_console: 'Live-konsoll',
    admin_new: 'Ny',
    admin_open: 'Åpen',
    admin_total: 'Totalt',
    admin_chats: 'Chatter',
    admin_needs: 'Trenger',
    admin_close_conversation: 'Lukk samtale',
    admin_close_conversation_msg: 'Lukk samtalen med {name}? Dette kan ikke angres.',
    admin_close: 'Lukk',
    admin_join: 'Bli med',
    admin_you_have_joined: 'Du er med',
    admin_join_take_over: 'Bli med og ta over',
    admin_give_to_ai: 'Gi til AI',
    admin_resolve: 'Løs',
    admin_take_over: 'Ta over',
    admin_you_are_handling: 'Du håndterer',
    admin_assign_to_you: 'Tildel til deg',
    admin_ai_handling: 'AI håndterer',
    admin_let_ai_answer: 'La AI svare',
    admin_visitor_typing: 'Besøkende skriver',
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
    const normalized = locale.toLowerCase();
    if (normalized.startsWith('nb') || normalized.startsWith('nn') || normalized.startsWith('no')) return 'no';
  } catch {}
  return 'en';
}

/* ── Provider ──────────────────────────────────────────────────────── */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [deviceLang, setDeviceLang] = useState<Lang>(() => detectDeviceLang());
  const [savedLang, setSavedLangState] = useState<RawLang>('auto');

  useEffect(() => {
    setDeviceLang(detectDeviceLang());
  }, []);

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
