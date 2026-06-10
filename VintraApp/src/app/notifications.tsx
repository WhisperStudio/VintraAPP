import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { fetchPushTokens, sendExpoPush } from '@/lib/push-sender';

/* ── Types ─────────────────────────────────────────────────── */
type Business = {
  id: string;
  name?: string;
  businessName?: string;
};

type NotifLog = {
  id: string;
  title: string;
  body: string;
  targetBusinessId: string;
  status: string;
  recipients?: number;
  sentCount?: number;
  failedCount?: number;
  createdAt?: any;
};

/* ── Component ─────────────────────────────────────────────── */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [user, setUser] = useState<User | null>(null);

  /* Send form */
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [targetBiz, setTargetBiz] = useState<string>('all');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  /* Businesses */
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(false);

  /* Log */
  const [notifLog, setNotifLog] = useState<NotifLog[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    loadBusinesses();

    const logUnsub = onSnapshot(
      query(collection(firebaseDb, 'notificationQueue'), orderBy('createdAt', 'desc')),
      (snap) => {
        setNotifLog(snap.docs.slice(0, 50).map((d) => ({ id: d.id, ...d.data() } as NotifLog)));
      },
      () => {},
    );
    return () => logUnsub();
  }, []);

  async function loadBusinesses() {
    setLoadingBiz(true);
    try {
      const snap = await getDocs(collection(firebaseDb, 'businesses'));
      setBusinesses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Business)));
    } catch (e) {
      console.error('notifications: failed to load businesses', e);
    } finally {
      setLoadingBiz(false);
    }
  }

  async function handleSend() {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSending(true);
    setSentOk(false);
    try {
      const tokens = await fetchPushTokens(targetBiz);
      const result = tokens.length
        ? await sendExpoPush(tokens, notifTitle.trim(), notifBody.trim())
        : { total: 0, sent: 0, failed: 0, errors: [] };

      const status =
        result.total === 0
          ? 'no-recipients'
          : result.failed === 0
            ? 'sent'
            : result.sent === 0
              ? 'failed'
              : 'partial';

      await addDoc(collection(firebaseDb, 'notificationQueue'), {
        title: notifTitle.trim(),
        body: notifBody.trim(),
        targetBusinessId: targetBiz,
        status,
        recipients: result.total,
        sentCount: result.sent,
        failedCount: result.failed,
        errors: result.errors,
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'unknown',
      });

      if (result.total === 0) {
        Alert.alert('No recipients', 'No registered devices were found for this target.');
      } else if (result.sent === 0) {
        Alert.alert(
          'Send failed',
          result.errors.length
            ? result.errors.join('\n')
            : 'All push notifications failed. Check APNs credentials in Expo (eas credentials).',
        );
      } else if (result.failed > 0) {
        Alert.alert('Partially sent', `${result.sent} sent, ${result.failed} failed.${result.errors.length ? `\n${result.errors.join('\n')}` : ''}`);
      }

      if (result.sent > 0 || result.total === 0) {
        setSentOk(true);
        setNotifTitle('');
        setNotifBody('');
        setTargetBiz('all');
        setTimeout(() => setSentOk(false), 3000);
      }
    } catch (e) {
      console.error('notifications: failed to send', e);
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Could not send the notification.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={st.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            st.content,
            { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
          ]}>
          {/* Header */}
          <View style={st.center}>
            <View style={st.iconBox}>
              <SymbolView name={{ ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }} size={28} tintColor="#ffffff" />
            </View>
            <ThemedText style={[st.title, compact && st.titleCompact]}>Notifications</ThemedText>
            <ThemedText style={st.lead}>Send push notifications to all registered users</ThemedText>
          </View>

          {/* Send Form */}
          <View style={st.card}>
            <Text style={st.fieldLabel}>Title</Text>
            <TextInput
              style={st.input}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="Notification title…"
              placeholderTextColor="#334155"
              maxLength={80}
            />

            <Text style={st.fieldLabel}>Message</Text>
            <TextInput
              style={[st.input, st.inputMulti]}
              value={notifBody}
              onChangeText={setNotifBody}
              placeholder="Notification body…"
              placeholderTextColor="#334155"
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <Text style={st.fieldLabel}>Target</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.targetRow}>
              <Pressable
                onPress={() => setTargetBiz('all')}
                style={[st.targetBtn, targetBiz === 'all' && st.targetBtnActive]}>
                <SymbolView
                  name={{ ios: 'globe', android: 'public', web: 'public' }}
                  size={11}
                  tintColor={targetBiz === 'all' ? '#0f6eff' : '#475569'}
                />
                <Text style={[st.targetBtnText, targetBiz === 'all' && st.targetBtnTextActive]}>All</Text>
              </Pressable>
              {businesses.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setTargetBiz(b.id)}
                  style={[st.targetBtn, targetBiz === b.id && st.targetBtnActive]}>
                  <Text
                    style={[st.targetBtnText, targetBiz === b.id && st.targetBtnTextActive]}
                    numberOfLines={1}>
                    {b.businessName || b.name || b.id.slice(0, 8)}
                  </Text>
                </Pressable>
              ))}
              {loadingBiz && <ActivityIndicator color="#0f6eff" style={{ marginLeft: 8 }} />}
            </ScrollView>

            <Pressable
              onPress={handleSend}
              disabled={sending || !notifTitle.trim() || !notifBody.trim()}
              style={({ pressed }) => [
                st.sendBtn,
                (!notifTitle.trim() || !notifBody.trim()) && st.sendBtnDisabled,
                pressed && st.pressed,
              ]}>
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : sentOk ? (
                <>
                  <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={16} tintColor="#fff" />
                  <Text style={st.sendBtnText}>Sent!</Text>
                </>
              ) : (
                <>
                  <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={14} tintColor="#fff" />
                  <Text style={st.sendBtnText}>Send Notification</Text>
                </>
              )}
            </Pressable>

            <Text style={st.hint}>
              Delivers via the <Text style={{ color: '#60a5fa' }}>Expo Push API</Text> to all registered devices.
            </Text>
          </View>

          {/* History */}
          <View style={st.card}>
            <View style={st.cardTitleRow}>
              <Text style={st.cardTitle}>Notification history</Text>
            </View>
            <View style={st.divider} />
            {notifLog.length === 0 ? (
              <Text style={st.emptyText}>No notifications sent yet</Text>
            ) : (
              notifLog.map((n, i) => (
                <View
                  key={n.id}
                  style={[st.logRow, i === notifLog.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={st.logLeft}>
                    <Text style={st.logTitle}>{n.title}</Text>
                    <Text style={st.logBody} numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text style={st.logMeta}>
                      {n.recipients !== undefined
                        ? `${n.sentCount ?? 0}/${n.recipients} sent · `
                        : ''}
                      {n.targetBusinessId === 'all' ? 'All businesses' : n.targetBusinessId}
                    </Text>
                  </View>
                  <View
                    style={[
                      st.logStatus,
                      n.status === 'sent' && st.logStatusSent,
                      n.status === 'failed' && st.logStatusFailed,
                      n.status === 'partial' && st.logStatusPartial,
                      n.status === 'no-recipients' && st.logStatusNoRecip,
                    ]}>
                    <Text
                      style={[
                        st.logStatusText,
                        n.status === 'sent' && st.logStatusTextSent,
                        n.status === 'failed' && st.logStatusTextFailed,
                        n.status === 'partial' && st.logStatusTextPartial,
                        n.status === 'no-recipients' && st.logStatusTextNoRecip,
                      ]}>
                      {n.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06111f' },
  content: { padding: 20, flexGrow: 1, gap: 14, paddingBottom: 40 },

  center: { alignItems: 'center', marginBottom: 8 },
  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '900', lineHeight: 34, textAlign: 'center' },
  titleCompact: { fontSize: 24, lineHeight: 29 },
  lead: { color: '#94a3b8', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 4, textAlign: 'center' },

  card: {
    borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  fieldLabel: {
    color: '#475569', fontSize: 10, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    color: '#f1f5f9', fontSize: 14, fontWeight: '500',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 11 },
  targetRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  targetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  targetBtnActive: {
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderColor: 'rgba(15,110,255,0.3)',
  },
  targetBtnText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  targetBtnTextActive: { color: '#0f6eff' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f97316', borderRadius: 13, paddingVertical: 13,
    marginTop: 4,
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  hint: { color: '#334155', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  pressed: { opacity: 0.7 },

  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  logRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logLeft: { flex: 1 },
  logTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  logBody: { color: '#64748b', fontSize: 12, marginTop: 2, lineHeight: 17 },
  logMeta: { color: '#334155', fontSize: 10, marginTop: 4 },
  logStatus: {
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    marginTop: 2,
  },
  logStatusSent: {
    backgroundColor: 'rgba(3,168,78,0.12)',
    borderColor: 'rgba(3,168,78,0.25)',
  },
  logStatusFailed: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  logStatusPartial: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.25)',
  },
  logStatusNoRecip: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.25)',
  },
  logStatusText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  logStatusTextSent: { color: '#03a84e' },
  logStatusTextFailed: { color: '#ef4444' },
  logStatusTextPartial: { color: '#fbbf24' },
  logStatusTextNoRecip: { color: '#94a3b8' },
});
