import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraSky } from '@/components/aurora-sky';
import { BottomTabInset } from '@/constants/theme';
import { firebaseAuth } from '@/lib/firebase';
import {
  createRequestId,
  loadNotificationCenter,
  queueAnnouncement,
  type NotificationCenter,
} from '@/lib/push-sender';
import {
  requestNotificationAccess,
  saveNotificationPreferences,
  sendLocalNotification,
  syncNotificationDevice,
  useNotificationDevice,
} from '@/lib/notifications';
import { useThemePreference } from '@/lib/theme-preference';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
const icons = {
  bell: {
    ios: 'bell.badge.fill',
    android: 'notifications_active',
    web: 'notifications_active',
  },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
  phone: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  globe: { ios: 'globe', android: 'public', web: 'public' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
} satisfies Record<string, SymbolName>;
const templates = [
  {
    label: 'Service update',
    title: 'A quick service update',
    body: 'We have an update for your team. Open Vintra to see what’s new.',
  },
  {
    label: 'Team reminder',
    title: 'Your inbox needs a little attention',
    body: 'There are conversations waiting for a reply. Open your inbox to help your customers.',
  },
  {
    label: 'What’s new',
    title: 'Something new at Vintra',
    body: 'Your workspace just got better. Open Vintra to explore the latest improvements.',
  },
];
const emptyCenter: NotificationCenter = {
  businesses: [],
  devices: 0,
  history: [],
};
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= 940;
  const { colorScheme } = useThemePreference();
  const light = colorScheme === 'light';
  const colors = {
    text: light ? '#132e3b' : '#edf7f7',
    muted: light ? '#526c78' : '#97b0bd',
    card: light ? '#ffffff' : '#0d202c',
    border: light ? '#dbe7e9' : '#203743',
    input: light ? '#f4f8f9' : '#081923',
  };
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [allowed, setAllowed] = useState(false);
  const [center, setCenter] = useState(emptyCenter);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [draftReady, setDraftReady] = useState(false);
  const device = useNotificationDevice();
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const sendLock = useRef(false);
  const refreshLock = useRef(false);
  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    user
      ?.getIdTokenResult()
      .then((token) => {
        if (active)
          setAllowed(
            user.emailVerified &&
              (token.claims.superAdmin === true ||
                user.email?.toLowerCase() === 'vintrastudio@gmail.com'),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);
  const draftKey = `@vintra_notification_draft:${user?.uid || 'signed-out'}`;
  useEffect(() => {
    let active = true;
    setDraftReady(false);
    AsyncStorage.getItem(draftKey)
      .then((raw) => {
        if (!active) return;
        const draft = raw ? JSON.parse(raw) : {};
        setTitle(
          typeof draft.title === 'string' ? draft.title.slice(0, 80) : '',
        );
        setBody(typeof draft.body === 'string' ? draft.body.slice(0, 300) : '');
        setTarget(typeof draft.target === 'string' ? draft.target : 'all');
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady || !user) return;
    AsyncStorage.setItem(
      draftKey,
      JSON.stringify({ title, body, target }),
    ).catch(() => {});
  }, [title, body, target, draftReady, draftKey, user]);
  const refresh = useCallback(async () => {
    if (!allowed || refreshLock.current) return;
    refreshLock.current = true;
    setLoading(true);
    try {
      setCenter(await loadNotificationCenter());
      setError('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load notifications.',
      );
    } finally {
      setLoading(false);
      refreshLock.current = false;
    }
  }, [allowed]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const interval = setInterval(refresh, 15000);
      return () => clearInterval(interval);
    }, [refresh]),
  );
  const audience =
    target === 'all'
      ? 'All businesses'
      : center.businesses.find((business) => business.id === target)?.name ||
        'Select a business';
  const recipients =
    target === 'all'
      ? center.devices
      : center.businesses.find((business) => business.id === target)?.devices ||
        0;
  const valid = !!title.trim() && !!body.trim() && draftReady;
  async function send(test = false) {
    if (!valid || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setNotice('');
    setError('');
    try {
      const fingerprint = JSON.stringify([
        title.trim(),
        body.trim(),
        target,
        test,
      ]);
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, id: createRequestId() };
      let testToken: string | undefined;
      if (test) {
        testToken = (await syncNotificationDevice(true)) || undefined;
        if (!testToken)
          throw new Error(
            'Use a connected iOS or Android app for a remote test. Browser preview is available below.',
          );
      }
      await queueAnnouncement({
        title: title.trim(),
        body: body.trim(),
        targetBusinessId: target,
        requestId: request.current.id,
        ...(testToken ? { testToken } : {}),
      });
      setNotice(
        test
          ? 'Test queued for this device. Follow its progress in recent activity.'
          : 'Announcement queued. Delivery progress will appear below.',
      );
      request.current = null;
      if (!test) {
        setTitle('');
        setBody('');
        await AsyncStorage.removeItem(draftKey);
      }
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not queue this notification. Your draft is saved.',
      );
    } finally {
      setSending(false);
      sendLock.current = false;
    }
  }
  const history = center.history.filter(
    (item) =>
      (filter === 'all' ||
        ['failed', 'partial', 'retry', 'no-recipients'].includes(item.status) ||
        !!item.receiptFailedCount) &&
      `${item.title} ${item.body}`.toLowerCase().includes(search.toLowerCase()),
  );
  const card = [
    st.card,
    { backgroundColor: colors.card, borderColor: colors.border },
  ];
  const label = [st.label, { color: colors.muted }];
  const text = { color: colors.text };
  if (!allowed)
    return (
      <View style={[st.access, { backgroundColor: colors.input }]}>
        <SymbolView name={icons.bell} size={32} tintColor="#2dc6a1" />
        <Text style={[st.heading, text]}>Notification center</Text>
        <Text style={[st.description, { color: colors.muted }]}>
          Announcement tools are available to notification administrators.
          Manage your personal chat alerts in Settings.
        </Text>
      </View>
    );
  return (
    <View style={[st.root, { backgroundColor: light ? '#eff5f6' : '#06121d' }]}>
      <KeyboardAvoidingView
        style={st.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor="#38d7af"
            />
          }
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + BottomTabInset + 32,
          }}
        >
          <View style={st.page}>
            <View style={st.hero}>
              <AuroraSky />
              <LinearGradient
                colors={['rgba(5,19,30,0.1)', 'rgba(5,19,30,0.94)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={st.heroTop}>
                <View style={st.eyebrowPill}>
                  <View style={st.dot} />
                  <Text style={st.eyebrow}>VINTRA / COMMUNICATIONS</Text>
                </View>
                <SymbolView name={icons.bell} tintColor="#8ae7c8" size={24} />
              </View>
              <Text style={st.heroTitle}>
                A little closer.{'\n'}Always connected.
              </Text>
              <Text style={st.heroLead}>
                Keep your team in the loop, and every conversation moving.
              </Text>
              <View style={st.heroBottom}>
                <Text style={st.heroDetail}>NOTIFICATION CENTER</Text>
                <Text style={st.heroDetail}>
                  {center.devices} connected{' '}
                  {center.devices === 1 ? 'device' : 'devices'}
                </Text>
              </View>
            </View>
            <View style={st.stats}>
              {[
                {
                  value: String(center.devices),
                  label: 'Devices',
                  icon: icons.phone,
                },
                {
                  value: String(center.businesses.length),
                  label: 'Businesses',
                  icon: icons.globe,
                },
                {
                  value: String(center.history.length),
                  label: 'Updates',
                  icon: icons.send,
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    st.stat,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <SymbolView name={stat.icon} tintColor="#25b695" size={19} />
                  <Text style={[st.statValue, text]}>{stat.value}</Text>
                  <Text style={[st.statLabel, { color: colors.muted }]}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
            {!!error && (
              <View accessibilityRole="alert" style={[st.notice, st.error]}>
                <Text style={st.errorText}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={refresh}>
                  <Text style={st.errorText}>Retry connection</Text>
                </Pressable>
              </View>
            )}
            {!!notice && (
              <View accessibilityLiveRegion="polite" style={st.notice}>
                <Text style={st.noticeText}>{notice}</Text>
              </View>
            )}
            <View style={[st.columns, wide && st.columnsWide]}>
              <View style={[card, st.composer]}>
                <View style={st.sectionTop}>
                  <View>
                    <Text style={[st.heading, text]}>New announcement</Text>
                    <Text style={[st.description, { color: colors.muted }]}>
                      A timely message makes all the difference.
                    </Text>
                  </View>
                  <View style={st.draftBadge}>
                    <Text style={st.draftText}>DRAFT</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.chips}
                >
                  {templates.map((template) => (
                    <Pressable
                      key={template.label}
                      accessibilityRole="button"
                      disabled={sending}
                      onPress={() => {
                        setTitle(template.title);
                        setBody(template.body);
                      }}
                      style={[st.chip, { borderColor: colors.border }]}
                    >
                      <Text style={[st.chipText, { color: colors.muted }]}>
                        {template.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={st.fieldTop}>
                  <Text style={label}>TITLE</Text>
                  <Text style={label}>{title.length}/80</Text>
                </View>
                <TextInput
                  accessibilityLabel="Notification title"
                  editable={!sending && draftReady}
                  placeholder="Give your update a title"
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                  value={title}
                  onChangeText={setTitle}
                  style={[
                    st.input,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                    },
                  ]}
                />
                <View style={st.fieldTop}>
                  <Text style={label}>MESSAGE</Text>
                  <Text style={label}>{body.length}/300</Text>
                </View>
                <TextInput
                  accessibilityLabel="Notification message"
                  editable={!sending && draftReady}
                  placeholder="What would you like your team to know?"
                  placeholderTextColor={colors.muted}
                  maxLength={300}
                  multiline
                  value={body}
                  onChangeText={setBody}
                  style={[
                    st.input,
                    st.messageInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                    },
                  ]}
                />
                <Text style={label}>CHOOSE YOUR AUDIENCE</Text>
                <View style={st.audiences}>
                  {[
                    {
                      id: 'all',
                      name: 'All businesses',
                      devices: center.devices,
                    },
                    ...center.businesses,
                  ].map((business) => (
                    <Pressable
                      key={business.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: target === business.id }}
                      disabled={sending}
                      onPress={() => setTarget(business.id)}
                      style={[
                        st.audience,
                        {
                          borderColor:
                            target === business.id ? '#29bd98' : colors.border,
                          backgroundColor:
                            target === business.id
                              ? light
                                ? '#e2f5ee'
                                : '#10392f'
                              : colors.input,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          st.chipText,
                          {
                            color:
                              target === business.id
                                ? light
                                  ? '#137c61'
                                  : '#85e7c9'
                                : colors.muted,
                          },
                        ]}
                      >
                        {business.name}
                      </Text>
                      <Text style={[st.count, { color: colors.muted }]}>
                        {business.devices}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View
                  style={[st.divider, { backgroundColor: colors.border }]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!valid || sending || recipients === 0}
                  onPress={() => send()}
                  style={({ pressed }) => [
                    st.send,
                    (!valid || sending || recipients === 0) && st.disabled,
                    pressed && st.pressed,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#05251e" />
                  ) : (
                    <SymbolView
                      name={icons.send}
                      tintColor="#05251e"
                      size={18}
                    />
                  )}
                  <Text style={st.sendText}>
                    {sending
                      ? 'Queuing notification…'
                      : `Send to ${recipients} ${recipients === 1 ? 'device' : 'devices'}`}
                  </Text>
                </Pressable>
                <Text style={[st.footnote, { color: colors.muted }]}>
                  {recipients === 0
                    ? 'No devices connected for this audience yet.'
                    : `To ${audience} · Your draft saves automatically`}
                </Text>
              </View>
              <View style={[st.sidebar, wide && st.sidebarWide]}>
                <View style={card}>
                  <View style={st.fieldTop}>
                    <Text style={label}>LIVE PREVIEW</Text>
                    <Text style={[st.previewNow, { color: colors.muted }]}>
                      Lock screen
                    </Text>
                  </View>
                  <LinearGradient
                    colors={['#204d53', '#102733', '#142035']}
                    style={st.previewSky}
                  >
                    <Text style={st.previewTime}>9:41</Text>
                    <Text style={st.previewDate}>
                      Your next update, at a glance
                    </Text>
                    <View style={st.pushPreview}>
                      <View style={st.previewTop}>
                        <View style={st.previewAppIcon}>
                          <SymbolView
                            name={icons.bell}
                            size={12}
                            tintColor="#063c30"
                          />
                        </View>
                        <Text style={st.previewApp}>VINTRA</Text>
                        <Text style={st.previewNow}>now</Text>
                      </View>
                      <Text style={st.previewTitle}>
                        {title.trim() || 'Your message starts here'}
                      </Text>
                      <Text style={st.previewBody}>
                        {body.trim() ||
                          'Write an announcement to see how it will look on your team’s devices.'}
                      </Text>
                    </View>
                  </LinearGradient>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!valid || sending}
                    onPress={() =>
                      Platform.OS === 'web'
                        ? sendLocalNotification(title, body).catch((e) =>
                            setError(e.message),
                          )
                        : send(true)
                    }
                    style={[
                      st.secondary,
                      { borderColor: colors.border },
                      (!valid || sending) && st.disabled,
                    ]}
                  >
                    <Text style={[st.secondaryText, text]}>
                      {Platform.OS === 'web'
                        ? 'Preview browser alert'
                        : 'Send a test to my device'}
                    </Text>
                  </Pressable>
                </View>
                <View style={card}>
                  <View style={st.sectionTop}>
                    <View style={st.deviceIcon}>
                      <SymbolView
                        name={icons.phone}
                        size={22}
                        tintColor="#52d9b5"
                      />
                    </View>
                    <View
                      style={[
                        st.statusDot,
                        {
                          backgroundColor:
                            device.status === 'ready' ? '#38ce9e' : '#e5ad65',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[st.heading, text]}>Your device</Text>
                  <Text style={[st.description, { color: colors.muted }]}>
                    {device.message}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={device.status === 'registering'}
                    onPress={async () => {
                      try {
                        const permission = await requestNotificationAccess();
                        if (!permission.granted)
                          throw new Error(permission.message);
                        await saveNotificationPreferences({ enabled: true });
                        await refresh();
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : 'Connection failed.',
                        );
                      }
                    }}
                    style={[st.secondary, { borderColor: colors.border }]}
                  >
                    <Text style={[st.secondaryText, text]}>
                      {device.status === 'registering'
                        ? 'Connecting…'
                        : device.status === 'ready'
                          ? 'Refresh connection'
                          : 'Enable notifications'}
                    </Text>
                  </Pressable>
                  <View
                    style={[st.divider, { backgroundColor: colors.border }]}
                  />
                  <Text
                    style={[
                      st.footnote,
                      { color: colors.muted, textAlign: 'left' },
                    ]}
                  >
                    Chat alerts are automatic for connected devices. Tap an
                    alert to jump straight into the conversation.
                  </Text>
                </View>
              </View>
            </View>
            <View style={card}>
              <View style={st.sectionTop}>
                <View>
                  <Text style={[st.heading, text]}>Recent activity</Text>
                  <Text style={[st.description, { color: colors.muted }]}>
                    Follow each announcement from queue to push service.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh notification history"
                  onPress={refresh}
                >
                  <SymbolView
                    name={icons.clock}
                    size={22}
                    tintColor={colors.muted}
                  />
                </Pressable>
              </View>
              <View style={st.historyTools}>
                <TextInput
                  accessibilityLabel="Search notification history"
                  placeholder="Search announcements"
                  placeholderTextColor={colors.muted}
                  value={search}
                  onChangeText={setSearch}
                  style={[
                    st.input,
                    {
                      flex: 1,
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === 'attention' }}
                  onPress={() =>
                    setFilter(filter === 'all' ? 'attention' : 'all')
                  }
                  style={[
                    st.chip,
                    {
                      borderColor:
                        filter === 'attention' ? '#e1ae66' : colors.border,
                    },
                  ]}
                >
                  <Text style={[st.chipText, { color: colors.muted }]}>
                    Needs attention
                  </Text>
                </Pressable>
              </View>
              {!history.length ? (
                <View style={st.empty}>
                  <View style={st.deviceIcon}>
                    <SymbolView
                      name={icons.send}
                      size={22}
                      tintColor="#52d9b5"
                    />
                  </View>
                  <Text style={[st.emptyTitle, text]}>
                    {search || filter !== 'all'
                      ? 'No matching announcements'
                      : 'A fresh start for your updates'}
                  </Text>
                  <Text
                    style={[
                      st.description,
                      { color: colors.muted, textAlign: 'center' },
                    ]}
                  >
                    Your announcements and delivery progress will appear here.
                  </Text>
                </View>
              ) : (
                history.map((item) => {
                  const attention =
                    !!item.receiptFailedCount ||
                    ['failed', 'partial', 'no-recipients', 'retry'].includes(
                      item.status,
                    );
                  return (
                    <View
                      key={item.id}
                      style={[st.historyRow, { borderColor: colors.border }]}
                    >
                      <View style={st.historyIcon}>
                        <SymbolView
                          name={icons.bell}
                          tintColor="#52d9b5"
                          size={18}
                        />
                      </View>
                      <View style={st.historyContent}>
                        <View style={st.fieldTop}>
                          <Text style={[st.historyTitle, text]}>
                            {item.title}
                          </Text>
                          <View
                            style={[
                              st.status,
                              {
                                backgroundColor: attention
                                  ? '#493523'
                                  : '#153b34',
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: attention ? '#ffd193' : '#8ce8c8',
                                fontSize: 10,
                                fontWeight: '700',
                              }}
                            >
                              {item.receiptFailedCount
                                ? 'delivery issue'
                                : item.status}
                            </Text>
                          </View>
                        </View>
                        <Text
                          numberOfLines={2}
                          style={[st.historyBody, { color: colors.muted }]}
                        >
                          {item.body}
                        </Text>
                        <Text style={[st.historyMeta, { color: colors.muted }]}>
                          {item.testToken
                            ? 'Test device'
                            : item.targetBusinessId === 'all'
                              ? 'All businesses'
                              : center.businesses.find(
                                  (b) => b.id === item.targetBusinessId,
                                )?.name || item.targetBusinessId}{' '}
                          ·{' '}
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Just now'}
                        </Text>
                        <Text style={[st.historyMeta, { color: colors.muted }]}>
                          {item.sentCount || 0} accepted ·{' '}
                          {item.confirmedCount || 0} provider-confirmed ·{' '}
                          {(item.failedCount || 0) +
                            (item.receiptFailedCount || 0)}{' '}
                          failed
                        </Text>
                        {!!item.errors?.length && (
                          <Text style={st.deliveryError}>
                            {item.errors.join(' · ')}
                          </Text>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          disabled={sending}
                          onPress={() => {
                            setTitle(item.title);
                            setBody(item.body);
                            setTarget(item.targetBusinessId);
                            setNotice(
                              'Copied to your draft. Review the audience before sending.',
                            );
                          }}
                        >
                          <Text style={st.reuse}>Use as a new draft ↗</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
              <Text style={[st.footnote, { color: colors.muted }]}>
                Accepted means queued by the push service. Provider confirmation
                does not confirm that a notification was read.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1 },
  page: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 20,
  },
  access: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  hero: {
    borderRadius: 26,
    overflow: 'hidden',
    padding: 28,
    minHeight: 285,
    borderWidth: 1,
    borderColor: '#29413f',
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrowPill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#58e0b5' },
  eyebrow: {
    color: '#a4d8cb',
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#f1faf7',
    fontSize: 37,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -1.3,
    marginTop: 12,
  },
  heroLead: { color: '#b5cbd1', fontSize: 14, lineHeight: 22, maxWidth: 350 },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#29413f',
  },
  heroDetail: { color: '#91afa9', fontSize: 10, letterSpacing: 1 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  statValue: { fontSize: 28, fontWeight: '600', letterSpacing: -1 },
  statLabel: { fontSize: 11, lineHeight: 16 },
  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  composer: { flex: 1 },
  sidebar: { gap: 20 },
  sidebarWide: { width: 335 },
  card: { borderRadius: 22, borderWidth: 1, padding: 22, gap: 16 },
  sectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heading: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5 },
  description: { fontSize: 13, lineHeight: 21, marginTop: 5, flexShrink: 1 },
  draftBadge: {
    borderRadius: 6,
    backgroundColor: '#173d32',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  draftText: {
    color: '#82d4b4',
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  chips: { flexDirection: 'row', gap: 7 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  chipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  fieldTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 48,
  },
  messageInput: { minHeight: 130, textAlignVertical: 'top', lineHeight: 22 },
  audiences: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audience: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: '100%',
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 11,
  },
  count: { fontSize: 11 },
  divider: { height: 1, marginVertical: 2 },
  send: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    backgroundColor: '#57deb4',
  },
  sendText: { color: '#05251e', fontSize: 14, fontWeight: '700' },
  footnote: { fontSize: 11, lineHeight: 18, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  previewSky: {
    borderRadius: 17,
    padding: 17,
    minHeight: 260,
    justifyContent: 'center',
    gap: 8,
  },
  previewTime: {
    color: '#d9eceb',
    fontSize: 48,
    letterSpacing: -2,
    textAlign: 'center',
    fontWeight: '300',
  },
  previewDate: {
    color: '#a2bdc2',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 15,
  },
  pushPreview: {
    borderRadius: 16,
    backgroundColor: '#e1ecebe8',
    padding: 14,
    gap: 6,
  },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewAppIcon: { backgroundColor: '#6bdbb5', borderRadius: 5, padding: 4 },
  previewApp: {
    flex: 1,
    fontSize: 9,
    letterSpacing: 1,
    color: '#46616b',
    fontWeight: '700',
  },
  previewNow: { color: '#6b8189', fontSize: 10 },
  previewTitle: { color: '#132d36', fontSize: 13, fontWeight: '700' },
  previewBody: { color: '#3c555f', fontSize: 12, lineHeight: 18 },
  secondary: {
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 12, fontWeight: '600' },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#133a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  notice: {
    backgroundColor: '#133c31',
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  noticeText: { color: '#b5f1da', fontSize: 13, lineHeight: 20 },
  error: { backgroundColor: '#452e26' },
  errorText: { color: '#ffd1b6', fontSize: 13, lineHeight: 20 },
  historyTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { padding: 25, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    gap: 13,
    borderTopWidth: 1,
    paddingTop: 18,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#133a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: { flex: 1, gap: 6 },
  historyTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  historyBody: { fontSize: 12, lineHeight: 19 },
  historyMeta: { fontSize: 10, lineHeight: 16 },
  status: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 },
  deliveryError: { color: '#d59a69', fontSize: 11 },
  reuse: {
    color: '#24ad8b',
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
