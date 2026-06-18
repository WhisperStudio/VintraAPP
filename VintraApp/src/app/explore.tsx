import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import {
  listenBusinessChatAnalytics,
  listenSupportChats,
  resolveAdminProfile,
  type AdminProfile,
  type ChatAnalytics,
  type ChatAnalyticsTimelineEvent,
  type SupportChat,
} from '@/lib/admin-chat';

import { BottomTabInset } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { useThemePreference } from '@/lib/theme-preference';

/* ─────────────────────────────────────────────────────────────
   Analytics Dashboard – matches the website Analyse page
   ───────────────────────────────────────────────────────────── */

type Period = '7d' | '30d' | 'all';
type Tab = 'oversikt' | 'tidslinje' | 'geografi';

const ANALYTICS_THEME = {
  dark: {
    bg: '#101826',
    bgBase: '#101826',
    text: '#e5edf8',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    card: '#151f2f',
    cardBorder: '#263346',
    control: '#172235',
    controlActive: 'rgba(15,110,255,0.16)',
    divider: '#263346',
    track: '#263346',
    empty: '#94a3b8',
    blobOne: 'rgba(15,110,255,0.10)',
    blobTwo: 'rgba(3,168,78,0.07)',
  },
  light: {
    bg: '#f4f7fb',
    bgBase: '#f4f7fb',
    text: '#0f172a',
    textMuted: '#475569',
    textSubtle: '#64748b',
    card: '#ffffff',
    cardBorder: '#dce7f3',
    control: '#ffffff',
    controlActive: '#e8f1ff',
    divider: '#dce7f3',
    track: '#e4edf7',
    empty: '#64748b',
    blobOne: 'rgba(15,110,255,0.08)',
    blobTwo: 'rgba(3,168,78,0.08)',
  },
} as const;

type AnalyticsTheme = (typeof ANALYTICS_THEME)[keyof typeof ANALYTICS_THEME];

const COUNTRY_FLAGS: Record<string, string> = {
  NO: '🇳🇴', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', SE: '🇸🇪', DK: '🇩🇰',
  FI: '🇫🇮', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PL: '🇵🇱', NL: '🇳🇱',
  BE: '🇧🇪', AU: '🇦🇺', CA: '🇨🇦', IN: '🇮🇳', BR: '🇧🇷', JP: '🇯🇵',
  CN: '🇨🇳', RU: '🇷🇺', MX: '🇲🇽', ZA: '🇿🇦',
};

function getFlag(code: string) {
  return COUNTRY_FLAGS[code?.toUpperCase() ?? ''] ?? '🌐';
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}, ${fmtTime(d)}`;
}

/* ── Animated background ──────────────────────────────────── */
function AnalyticsBg({ theme }: { theme: AnalyticsTheme }) {
  const move = useSharedValue(0);
  useEffect(() => {
    move.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.cubic) }), -1, true);
  }, [move]);
  const blob1 = useAnimatedStyle(() => ({
    transform: [{ translateX: -62 + move.value * 34 }, { translateY: -34 + move.value * 20 }],
  }));
  const blob2 = useAnimatedStyle(() => ({
    transform: [{ translateX: 46 - move.value * 28 }, { translateY: 32 - move.value * 16 }],
  }));
  return (
    <View pointerEvents="none" style={s.bgWrap}>
      <View style={[s.bgBase, { backgroundColor: theme.bgBase }]} />
      <Animated.View style={[s.bgBlob1, { backgroundColor: theme.blobOne }, blob1]} />
      <Animated.View style={[s.bgBlob2, { backgroundColor: theme.blobTwo }, blob2]} />
    </View>
  );
}

/* ── Metric card ──────────────────────────────────────────── */
function MetricCard({
  icon, iconBg, iconTint, title, value, sub, small, theme,
}: {
  icon: any; iconBg: string; iconTint: string;
  title: string; value: string; sub: string; small?: boolean; theme: AnalyticsTheme;
}) {
  return (
    <View style={[s.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={[s.metricIcon, { backgroundColor: iconBg }]}>
        <SymbolView name={icon} size={14} tintColor={iconTint} />
      </View>
      <Text style={[s.metricTitle, { color: theme.textMuted }]} numberOfLines={1}>{title}</Text>
      <Text style={[s.metricValue, { color: theme.text }, small && s.metricValueSm]}>{value}</Text>
      <Text style={[s.metricSub, { color: theme.textSubtle }]} numberOfLines={2}>{sub}</Text>
    </View>
  );
}

/* ── Segmented bar (conversation distribution) ───────────── */
function SegmentBar({ segments, theme }: { segments: { value: number; color: string; label: string }[]; theme: AnalyticsTheme }) {
  const { t } = useTranslation();
  const total = segments.reduce((a, sg) => a + sg.value, 0);
  if (!total) {
    return (
      <View style={s.emptyBox}>
        <Text style={[s.emptyText, { color: theme.empty }]}>{t('chart_no_data')}</Text>
      </View>
    );
  }
  return (
    <View style={s.segWrap}>
      <View style={s.segTotalRow}>
        <Text style={[s.segTotalNum, { color: theme.text }]}>{total}</Text>
        <Text style={[s.segTotalLabel, { color: theme.textSubtle }]}> {t('total_conversations')}</Text>
      </View>
      <View style={[s.segBar, { backgroundColor: theme.track }]}>
        {segments.filter(sg => sg.value > 0).map((sg, i, arr) => (
          <View
            key={i}
            style={[
              s.segSlice,
              { flex: sg.value / total, backgroundColor: sg.color },
              i === 0 && s.segSliceFirst,
              i === arr.length - 1 && s.segSliceLast,
            ]}
          />
        ))}
      </View>
      <View style={s.segLegend}>
        {segments.map((sg, i) => (
          <View key={i} style={s.segLegendItem}>
            <View style={[s.segLegendDot, { backgroundColor: sg.color }]} />
            <Text style={[s.segLegendLabel, { color: theme.textMuted }]}>{sg.label}</Text>
            <Text style={[s.segLegendCount, { color: theme.textSubtle }]}>{sg.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Timeline bar chart ───────────────────────────────────── */
function TimelineChart({
  chats,
  events,
  days,
  theme,
}: {
  chats: SupportChat[];
  events: ChatAnalyticsTimelineEvent[];
  days: number;
  theme: AnalyticsTheme;
}) {
  const { t } = useTranslation();
  const buckets = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const sessionIds = new Set<string>();
      chats.forEach(c => {
        const t = new Date(c.updatedAt).getTime();
        if (t >= d.getTime() && t < next.getTime()) sessionIds.add(c.sessionId || c.id);
      });
      events.forEach(event => {
        const t = new Date(event.createdAt).getTime();
        if (t >= d.getTime() && t < next.getTime()) sessionIds.add(event.sessionId || event.id);
      });
      const count = sessionIds.size;
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, count };
    });
  }, [chats, days, events]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <View>
      <View style={s.timelineChart}>
        {buckets.map((b, i) => (
          <View key={i} style={s.timelineCol}>
            <View
              style={[
                s.timelineBar,
                {
                  height: Math.max(4, Math.round((b.count / maxCount) * 100)),
                  backgroundColor: b.count > 0 ? '#0f6eff' : theme.track,
                },
              ]}
            />
            {days <= 10 && <Text style={[s.timelineLabel, { color: theme.textSubtle }]}>{b.label}</Text>}
          </View>
        ))}
      </View>
      {buckets.every(b => b.count === 0) && (
        <View style={s.emptyBox}>
          <Text style={[s.emptyText, { color: theme.empty }]}>{t('chart_no_activity')}</Text>
        </View>
      )}
    </View>
  );
}

/* ── Country row ──────────────────────────────────────────── */
function CountryRow({ rank, code, count, max, theme }: { rank?: number; code: string; count: number; max: number; theme: AnalyticsTheme }) {
  return (
    <View style={[s.countryRow, { borderBottomColor: theme.divider }]}>
      {rank !== undefined && <Text style={[s.countryRank, { color: theme.textSubtle }]}>#{rank}</Text>}
      <Text style={s.countryFlag}>{getFlag(code)}</Text>
      <Text style={[s.countryCode, { color: theme.text }]}>{code}</Text>
      <View style={[s.countryTrack, { backgroundColor: theme.track }]}>
        <View style={[s.countryFill, { flex: count / max }]} />
        <View style={{ flex: 1 - count / max }} />
      </View>
      <Text style={[s.countryCount, { color: theme.textSubtle }]}>{count}</Text>
    </View>
  );
}

/* ── Main screen ──────────────────────────────────────────── */
export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const { t } = useTranslation();
  const { colorScheme } = useThemePreference();
  const theme = ANALYTICS_THEME[colorScheme];

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [allChats, setAllChats] = useState<SupportChat[]>([]);
  const [chatAnalytics, setChatAnalytics] = useState<ChatAnalytics | null>(null);
  const [period, setPeriod] = useState<Period>('7d');
  const [tab, setTab] = useState<Tab>('oversikt');
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const liveLoaded = useRef(false);
  const now = useMemo(() => new Date(), []);
  const businessId = adminProfile?.businessId ?? '';

  // Lightweight shape stored in AsyncStorage (only fields analytics needs)
  type CachedChat = {
    id: string;
    sessionId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    countryCode?: string;
    messages: { role: string }[];
  };
  const cacheKey = (bId: string) => `@vintra_analytics_${bId}`;

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, u => {
      if (u) resolveAdminProfile(u).then(setAdminProfile).catch(() => setAdminProfile(null));
      else setAdminProfile(null);
    });
  }, []);

  // Restore cached analytics when a business profile loads
  useEffect(() => {
    if (!businessId) return;
    liveLoaded.current = false;
    AsyncStorage.getItem(cacheKey(businessId))
      .then(raw => {
        if (!raw || liveLoaded.current) return;
        const cached: CachedChat[] = JSON.parse(raw);
        setAllChats(cached.map(chat => ({
          ...chat,
          businessId,
          widgetKey: '',
          preview: '',
          messageCount: chat.messages.length,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((message, index) => ({
            id: String(index),
            role: message.role as SupportChat['messages'][number]['role'],
            text: '',
            createdAt: new Date(chat.updatedAt),
          })),
        })));
        // Pick the most recent updatedAt from cached chats as the "saved at" timestamp
        const latest = cached.reduce((max, c) => {
          const t = new Date(c.updatedAt).getTime();
          return t > max ? t : max;
        }, 0);
        setCachedAt(latest ? new Date(latest) : new Date());
      })
      .catch(() => {});
  }, [businessId]);

  // Live listener — saves a lite cache snapshot on every update
  useEffect(() => {
    if (!businessId) return;
    return listenSupportChats(businessId, (chats) => {
      liveLoaded.current = true;
      setCachedAt(null);
      setAllChats(chats);
      const lite: CachedChat[] = chats.map(c => ({
        id: c.id,
        sessionId: c.sessionId || c.id,
        status: c.status,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
        countryCode: c.countryCode,
        messages: c.messages.map(m => ({ role: m.role })),
      }));
      AsyncStorage.setItem(cacheKey(businessId), JSON.stringify(lite)).catch(() => {});
    }, console.error);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    setChatAnalytics(null);
    return listenBusinessChatAnalytics(businessId, setChatAnalytics, console.error);
  }, [businessId]);

  const periodStart = useMemo(() => {
    if (period === 'all') return null;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }, [now, period]);

  const chats = useMemo(() => {
    if (!periodStart) return allChats;
    return allChats.filter(c => new Date(c.updatedAt) >= periodStart);
  }, [allChats, periodStart]);

  const analyticsEvents = useMemo(() => chatAnalytics?.timeline ?? [], [chatAnalytics]);
  const periodEvents = useMemo(() => {
    if (!periodStart) return analyticsEvents;
    return analyticsEvents.filter(event => new Date(event.createdAt) >= periodStart);
  }, [analyticsEvents, periodStart]);

  const activeSessionIds = useMemo(() => new Set(chats.map(c => c.sessionId || c.id).filter(Boolean)), [chats]);
  const eventSessionIds = useMemo(() => new Set(periodEvents.map(event => event.sessionId || event.id).filter(Boolean)), [periodEvents]);
  const supportEventSessionIds = useMemo(() => new Set(
    periodEvents
      .filter(event => event.kind === 'support-open' || event.kind === 'support-message' || event.kind === 'support-request')
      .map(event => event.sessionId || event.id)
      .filter(Boolean),
  ), [periodEvents]);
  const savedEventSessionIds = useMemo(() => new Set(
    periodEvents
      .filter(event => event.kind === 'support-message')
      .map(event => event.sessionId || event.id)
      .filter(Boolean),
  ), [periodEvents]);

  const activeSupportRequests = chats.filter(c => c.status === 'needs-human' || c.status === 'open').length;
  const activeAiOnly = chats.filter(c => c.status === 'ai-active').length;
  const activeSavedChats = chats.filter(c => c.messages.some(m => m.role === 'support')).length;
  const totalSessions = period === 'all'
    ? Math.max(chatAnalytics?.totalConversations ?? 0, chatAnalytics?.totalSessions ?? 0, activeSessionIds.size, eventSessionIds.size)
    : Math.max(activeSessionIds.size, eventSessionIds.size);
  const supportRequests = period === 'all'
    ? Math.max(chatAnalytics?.supportRequests ?? 0, activeSupportRequests, supportEventSessionIds.size)
    : Math.max(activeSupportRequests, supportEventSessionIds.size);
  const savedChats = period === 'all'
    ? Math.max(chatAnalytics?.savedChats ?? 0, activeSavedChats, savedEventSessionIds.size)
    : Math.max(activeSavedChats, savedEventSessionIds.size);
  const aiOnly = period === 'all'
    ? Math.max(chatAnalytics?.aiOnly ?? 0, activeAiOnly, totalSessions - supportRequests)
    : Math.max(activeAiOnly, totalSessions - supportRequests);
  const supportPct = totalSessions ? Math.round((supportRequests / totalSessions) * 100) : 0;
  const aiPct = totalSessions ? Math.round((aiOnly / totalSessions) * 100) : 0;
  const savedPct = supportRequests ? Math.round((savedChats / supportRequests) * 100) : 0;
  const totalSessionsSub = period === 'all' && chatAnalytics
    ? `${t('metric_from_firebase')} · ${chatAnalytics.totalMessages} ${t('metric_messages')}`
    : t('metric_only_selected');

  const lastActive = useMemo(
    () => [...allChats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [allChats],
  );

  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    const seenSessions = new Set<string>();
    chats.forEach(c => {
      const cc = (c.countryCode || 'Unknown').toUpperCase();
      seenSessions.add(c.sessionId || c.id);
      map[cc] = (map[cc] || 0) + 1;
    });
    periodEvents.forEach(event => {
      if (!event.countryCode || seenSessions.has(event.sessionId || event.id)) return;
      const cc = event.countryCode.toUpperCase();
      seenSessions.add(event.sessionId || event.id);
      map[cc] = (map[cc] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [chats, periodEvents]);

  const topCountry = countryData[0];
  const timelineDays = period === '7d' ? 7 : period === '30d' ? 30 : 30;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <AnalyticsBg theme={theme} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + BottomTabInset + 40,
          paddingHorizontal: 16,
          gap: 14,
        }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.text }]}>{t('analyse_title')}</Text>
            <Text style={[s.headerSub, { color: theme.textSubtle }]}>{t('analyse_sub')}</Text>
          </View>
          {cachedAt ? (
            <View style={[s.cachedBadge, { backgroundColor: theme.control, borderColor: theme.cardBorder }]}>
              <SymbolView name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} size={11} tintColor="#64748b" />
              <Text style={[s.cachedBadgeText, { color: theme.textSubtle }]}>{t('cached')}{'\n'}{fmtDate(cachedAt)}</Text>
            </View>
          ) : (
            <Text style={[s.headerUpdated, { color: theme.textSubtle }]}>{t('analyse_updated')}{'\n'}{fmtDate(now)}</Text>
          )}
        </View>

        {/* ── 6 Metric cards ─────────────────────────────────── */}
        <View style={[s.metricGrid, !compact && s.metricGridWide]}>
          <MetricCard
            icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
            iconBg="rgba(15,110,255,0.18)" iconTint="#0f6eff"
            title={t('metric_total_sessions')} value={String(totalSessions)} sub={totalSessionsSub}
            theme={theme}
          />
          <MetricCard
            icon={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }}
            iconBg="rgba(3,168,78,0.18)" iconTint="#03a84e"
            title={t('metric_support_requests')} value={String(supportRequests)}
            sub={`${supportPct}% ${t('metric_pct_of_sessions')}`}
            theme={theme}
          />
          <MetricCard
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            iconBg="rgba(139,92,246,0.18)" iconTint="#a78bfa"
            title={t('metric_ai_only')} value={String(aiOnly)}
            sub={`${aiPct}% ${t('metric_ai_pct')}`}
            theme={theme}
          />
          <MetricCard
            icon={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat_bubble', web: 'chat_bubble' }}
            iconBg="rgba(249,115,22,0.18)" iconTint="#f97316"
            title={t('metric_saved_chats')} value={String(savedChats)}
            sub={`${savedPct}% ${t('metric_pct_of_support')}`}
            theme={theme}
          />
          <MetricCard
            icon={{ ios: 'globe', android: 'language', web: 'language' }}
            iconBg="rgba(20,184,166,0.18)" iconTint="#2dd4bf"
            title={t('metric_top_country')}
            value={topCountry ? `${getFlag(topCountry[0])} ${topCountry[0]}` : '—'}
            sub={t('metric_based_on_period')}
            theme={theme}
          />
          <MetricCard
            icon={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
            iconBg="rgba(15,110,255,0.12)" iconTint="#60a5fa"
            title={t('metric_last_activity')}
            value={lastActive ? fmtTime(new Date(lastActive.updatedAt)) : '—'}
            sub={lastActive ? fmtDate(new Date(lastActive.updatedAt)) : t('metric_no_activity')}
            small
            theme={theme}
          />
        </View>

        {/* ── Tab bar + period ───────────────────────────────── */}
        <View style={[s.controlRow, compact && s.controlRowCompact]}>
          <View style={[s.tabBar, compact && s.tabBarCompact, { backgroundColor: theme.control, borderColor: theme.cardBorder }]}>
            {(['oversikt', 'tidslinje', 'geografi'] as const).map(tabKey => (
              <Pressable
                key={tabKey}
                onPress={() => setTab(tabKey)}
                style={[s.tabBtn, compact && s.tabBtnCompact, tab === tabKey && [s.tabBtnActive, { backgroundColor: theme.controlActive }]]}>
                <SymbolView
                  name={
                    tabKey === 'oversikt'
                      ? { ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }
                      : tabKey === 'tidslinje'
                      ? { ios: 'chart.xyaxis.line', android: 'timeline', web: 'timeline' }
                      : { ios: 'globe', android: 'public', web: 'public' }
                  }
                  size={compact ? 14 : 13}
                  tintColor={tab === tabKey ? '#0f6eff' : theme.textSubtle}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[s.tabBtnText, compact && s.tabBtnTextCompact, { color: theme.textSubtle }, tab === tabKey && s.tabBtnTextActive]}>
                  {tabKey === 'oversikt' ? t('tab_overview') : tabKey === 'tidslinje' ? t('tab_timeline') : t('tab_geography')}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.periodBar, compact && s.periodBarCompact, { backgroundColor: theme.control, borderColor: theme.cardBorder }]}>
            {(['7d', '30d', 'all'] as const).map(p => (
              <Pressable key={p} onPress={() => setPeriod(p)} style={[s.periodBtn, compact && s.periodBtnCompact, period === p && [s.periodBtnActive, { backgroundColor: theme.controlActive }]]}>
                <Text numberOfLines={1} style={[s.periodBtnText, { color: theme.textSubtle }, period === p && s.periodBtnTextActive]}>
                  {p === '7d' ? '7d' : p === '30d' ? '30d' : t('period_all')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Oversikt ───────────────────────────────────────── */}
        {tab === 'oversikt' && (
          <View style={[s.chartRow, !compact && s.chartRowWide]}>
            <View style={[s.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[s.chartTitle, { color: theme.text }]}>{t('chart_seg_title')}</Text>
              <Text style={[s.chartSub, { color: theme.textSubtle }]}>{t('chart_seg_sub')}</Text>
              <SegmentBar
                segments={[
                  { value: supportRequests, color: '#03a84e', label: t('chart_support_live') },
                  { value: aiOnly, color: '#f97316', label: t('chart_ai_only') },
                  { value: savedChats, color: '#0f6eff', label: t('chart_saved') },
                ]}
                theme={theme}
              />
            </View>
            <View style={[s.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[s.chartTitle, { color: theme.text }]}>{t('chart_countries_title')}</Text>
              <Text style={[s.chartSub, { color: theme.textSubtle }]}>{t('chart_countries_sub')}</Text>
              {countryData.length === 0 ? (
                <View style={s.emptyBox}><Text style={[s.emptyText, { color: theme.empty }]}>{t('chart_no_geo')}</Text></View>
              ) : (
                countryData.slice(0, 7).map(([code, count]) => (
                  <CountryRow key={code} code={code} count={count} max={countryData[0][1]} theme={theme} />
                ))
              )}
            </View>
          </View>
        )}

        {/* ── Tidslinje ──────────────────────────────────────── */}
        {tab === 'tidslinje' && (
          <View style={[s.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[s.chartTitle, { color: theme.text }]}>{t('chart_timeline_title')}</Text>
            <Text style={[s.chartSub, { color: theme.textSubtle }]}>{t('chart_timeline_sub')}</Text>
            <TimelineChart chats={chats} events={periodEvents} days={timelineDays} theme={theme} />
          </View>
        )}

        {/* ── Geografi ───────────────────────────────────────── */}
        {tab === 'geografi' && (
          <View style={[s.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[s.chartTitle, { color: theme.text }]}>{t('chart_geo_title')}</Text>
            <Text style={[s.chartSub, { color: theme.textSubtle }]}>{t('chart_geo_sub')}</Text>
            {countryData.length === 0 ? (
              <View style={s.emptyBox}><Text style={[s.emptyText, { color: theme.empty }]}>{t('chart_no_geo')}</Text></View>
            ) : (
              countryData.map(([code, count], i) => (
                <CountryRow key={code} rank={i + 1} code={code} count={count} max={countryData[0][1]} theme={theme} />
              ))
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  /* Background */
  container: { flex: 1, backgroundColor: '#141e2e' },
  bgWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#141e2e' },
  bgBlob1: {
    position: 'absolute', top: -100, left: -150,
    width: 600, height: 600, borderRadius: 300,
    backgroundColor: 'rgba(15,110,255,0.10)',
  },
  bgBlob2: {
    position: 'absolute', bottom: -150, right: -100,
    width: 500, height: 500, borderRadius: 250,
    backgroundColor: 'rgba(3,168,78,0.07)',
  },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerTitle: { color: '#f1f5f9', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#64748b', fontSize: 12, fontWeight: '500', marginTop: 4, lineHeight: 17 },
  headerUpdated: { color: '#475569', fontSize: 10, fontWeight: '600', textAlign: 'right', lineHeight: 15 },
  cachedBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cachedBadgeText: { color: '#475569', fontSize: 10, fontWeight: '600', lineHeight: 15 },

  /* Metric grid */
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricGridWide: { gap: 12 },
  metricCard: {
    width: '47.5%', borderRadius: 16, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 5,
  },
  metricIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricTitle: { color: '#64748b', fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  metricValue: { color: '#f1f5f9', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, lineHeight: 28 },
  metricValueSm: { fontSize: 16, lineHeight: 20 },
  metricSub: { color: '#475569', fontSize: 10, fontWeight: '500', lineHeight: 14 },

  /* Controls */
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  controlRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  tabBar: {
    flex: 1, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 4, gap: 4,
  },
  tabBarCompact: { flex: 0, width: '100%' },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 42, gap: 6, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabBtnCompact: { minHeight: 56, flexDirection: 'column', gap: 4, paddingHorizontal: 4, paddingVertical: 8 },
  tabBtnActive: { backgroundColor: 'rgba(15,110,255,0.15)', borderColor: 'rgba(15,110,255,0.28)' },
  tabBtnText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  tabBtnTextCompact: { fontSize: 11, textAlign: 'center' },
  tabBtnTextActive: { color: '#0f6eff' },
  periodBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 4, gap: 4,
  },
  periodBarCompact: { width: '100%' },
  periodBtn: { minHeight: 42, minWidth: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  periodBtnCompact: { flex: 1, minWidth: 0 },
  periodBtnActive: { backgroundColor: 'rgba(15,110,255,0.18)' },
  periodBtnText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  periodBtnTextActive: { color: '#0f6eff' },

  /* Chart cards */
  chartRow: { gap: 12 },
  chartRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  chartCard: {
    flex: 1, borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  chartTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '800' },
  chartSub: { color: '#64748b', fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 12 },

  /* Segment bar */
  segWrap: { gap: 10 },
  segTotalRow: { flexDirection: 'row', alignItems: 'baseline' },
  segTotalNum: { color: '#f1f5f9', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  segTotalLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  segBar: {
    height: 20, borderRadius: 10, flexDirection: 'row',
    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  segSlice: { height: 20 },
  segSliceFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  segSliceLast: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  segLegend: { gap: 8, marginTop: 4 },
  segLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segLegendDot: { width: 9, height: 9, borderRadius: 5 },
  segLegendLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', flex: 1 },
  segLegendCount: { color: '#64748b', fontSize: 12, fontWeight: '700' },

  /* Timeline */
  timelineChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 120, gap: 4, marginTop: 8,
  },
  timelineCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: 120 },
  timelineBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  timelineLabel: { color: '#475569', fontSize: 8, fontWeight: '700' },

  /* Country rows */
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  countryRank: { color: '#475569', fontSize: 11, fontWeight: '700', width: 24 },
  countryFlag: { fontSize: 16 },
  countryCode: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', width: 36 },
  countryTrack: {
    flex: 1, height: 6, borderRadius: 3,
    flexDirection: 'row', overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  countryFill: { height: 6, backgroundColor: '#0f6eff', borderRadius: 3 },
  countryCount: { color: '#64748b', fontSize: 12, fontWeight: '700', width: 22, textAlign: 'right' },

  /* Empty states */
  emptyBox: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { color: '#475569', fontSize: 13, fontWeight: '600' },
});
