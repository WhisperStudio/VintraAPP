import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { firebaseDb } from '@/lib/firebase';

/* ── Constants ─────────────────────────────────────────────── */
export const SUPER_ADMIN_EMAIL = 'vintrastudio@gmail.com';

export function isSuperAdmin(email: string | null | undefined): boolean {
  return email?.toLowerCase() === SUPER_ADMIN_EMAIL;
}

/* ── Types ─────────────────────────────────────────────────── */
type Business = {
  id: string;
  name?: string;
  businessName?: string;
  email?: string;
  ownerId?: string;
  chatAnalytics?: { totalMessages?: number };
};

type NotifLog = {
  id: string;
  title: string;
  body: string;
  targetBusinessId: string;
  status: string;
  createdAt?: any;
};

/* ── Component ─────────────────────────────────────────────── */
export function SuperAdminPanel({
  visible,
  onClose,
  userEmail,
}: {
  visible: boolean;
  onClose: () => void;
  userEmail: string;
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'notify' | 'businesses' | 'log'>('notify');

  /* Notification form */
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [targetBiz, setTargetBiz] = useState<string>('all');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  /* Businesses */
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(false);

  /* Notification log */
  const [notifLog, setNotifLog] = useState<NotifLog[]>([]);

  useEffect(() => {
    if (!visible) return;
    loadBusinesses();

    const logUnsub = onSnapshot(
      query(collection(firebaseDb, 'notificationQueue'), orderBy('createdAt', 'desc')),
      snap => {
        setNotifLog(snap.docs.slice(0, 30).map(d => ({ id: d.id, ...d.data() } as NotifLog)));
      },
      () => {},
    );
    return () => logUnsub();
  }, [visible]);

  async function loadBusinesses() {
    setLoadingBiz(true);
    try {
      const snap = await getDocs(collection(firebaseDb, 'businesses'));
      setBusinesses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Business)));
    } catch (e) {
      console.error('super-admin: failed to load businesses', e);
    } finally {
      setLoadingBiz(false);
    }
  }

  async function sendNotification() {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSending(true);
    setSentOk(false);
    try {
      await addDoc(collection(firebaseDb, 'notificationQueue'), {
        title: notifTitle.trim(),
        body: notifBody.trim(),
        targetBusinessId: targetBiz,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: userEmail,
      });
      setSentOk(true);
      setNotifTitle('');
      setNotifBody('');
      setTargetBiz('all');
      setTimeout(() => setSentOk(false), 3000);
    } catch (e) {
      console.error('super-admin: failed to queue notification', e);
    } finally {
      setSending(false);
    }
  }

  const totalMsgs = businesses.reduce((s, b) => s + (b.chatAnalytics?.totalMessages ?? 0), 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[st.container, { paddingTop: Math.max(insets.top, 12) }]}>

          {/* ── Header ─────────────────────────────────────── */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <View style={st.headerBadge}>
                <Text style={st.headerBadgeText}>SA</Text>
              </View>
              <View>
                <Text style={st.headerTitle}>Super Admin</Text>
                <Text style={st.headerSub}>{userEmail}</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [st.closeBtn, pressed && st.pressed]}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={15}
                tintColor="#94a3b8"
              />
            </Pressable>
          </View>

          {/* ── Stats row ──────────────────────────────────── */}
          <View style={st.statsRow}>
            <View style={st.statCard}>
              <Text style={st.statNum}>{businesses.length}</Text>
              <Text style={st.statLabel}>Businesses</Text>
            </View>
            <View style={[st.statCard, { borderColor: 'rgba(15,110,255,0.28)' }]}>
              <Text style={[st.statNum, { color: '#0f6eff' }]}>{notifLog.length}</Text>
              <Text style={st.statLabel}>Notifications</Text>
            </View>
            <View style={[st.statCard, { borderColor: 'rgba(3,168,78,0.28)' }]}>
              <Text style={[st.statNum, { color: '#03a84e' }]}>{totalMsgs}</Text>
              <Text style={st.statLabel}>Total msgs</Text>
            </View>
          </View>

          {/* ── Tab bar ────────────────────────────────────── */}
          <View style={st.tabBar}>
            {([
              { key: 'notify',     label: 'Send',       icon: { ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' } },
              { key: 'businesses', label: 'Businesses',  icon: { ios: 'building.2.fill', android: 'business', web: 'business' } },
              { key: 'log',        label: 'Log',         icon: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' } },
            ] as const).map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[st.tabBtn, activeTab === tab.key && st.tabBtnActive]}>
                <SymbolView
                  name={tab.icon}
                  size={12}
                  tintColor={activeTab === tab.key ? '#f97316' : '#475569'}
                />
                <Text style={[st.tabBtnText, activeTab === tab.key && st.tabBtnTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Tab content ────────────────────────────────── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={st.content}>

            {/* SEND NOTIFICATION */}
            {activeTab === 'notify' && (
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
                    <Text style={[st.targetBtnText, targetBiz === 'all' && st.targetBtnTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  {businesses.map(b => (
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
                </ScrollView>

                <Pressable
                  onPress={sendNotification}
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
                      <SymbolView
                        name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                        size={16}
                        tintColor="#fff"
                      />
                      <Text style={st.sendBtnText}>Queued!</Text>
                    </>
                  ) : (
                    <>
                      <SymbolView
                        name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                        size={14}
                        tintColor="#fff"
                      />
                      <Text style={st.sendBtnText}>Send Notification</Text>
                    </>
                  )}
                </Pressable>

                <Text style={st.hint}>
                  Writes to{' '}
                  <Text style={{ color: '#60a5fa' }}>notificationQueue</Text> — a Cloud Function
                  will process and dispatch push notifications.
                </Text>
              </View>
            )}

            {/* BUSINESSES */}
            {activeTab === 'businesses' && (
              <View style={st.card}>
                <View style={st.cardTitleRow}>
                  <Text style={st.cardTitle}>{businesses.length} businesses</Text>
                  <Pressable onPress={loadBusinesses} style={st.refreshBtn}>
                    <SymbolView
                      name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                      size={13}
                      tintColor="#475569"
                    />
                  </Pressable>
                </View>
                <View style={st.divider} />
                {loadingBiz ? (
                  <ActivityIndicator color="#0f6eff" style={{ marginVertical: 20 }} />
                ) : businesses.length === 0 ? (
                  <Text style={st.emptyText}>No businesses found</Text>
                ) : (
                  businesses.map((b, i) => (
                    <View
                      key={b.id}
                      style={[st.bizRow, i === businesses.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={st.bizAvatar}>
                        <Text style={st.bizAvatarText}>
                          {(b.businessName || b.name || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.bizName}>{b.businessName || b.name || 'Unnamed'}</Text>
                        <Text style={st.bizMeta}>{b.email || b.id}</Text>
                      </View>
                      {(b.chatAnalytics?.totalMessages ?? 0) > 0 && (
                        <View style={st.bizBadge}>
                          <Text style={st.bizBadgeText}>{b.chatAnalytics!.totalMessages}</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* NOTIFICATION LOG */}
            {activeTab === 'log' && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Notification history</Text>
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
                        <Text style={st.logBody} numberOfLines={2}>{n.body}</Text>
                        <Text style={st.logMeta}>
                          → {n.targetBusinessId === 'all' ? 'All businesses' : n.targetBusinessId}
                        </Text>
                      </View>
                      <View
                        style={[
                          st.logStatus,
                          n.status === 'sent' && st.logStatusSent,
                          n.status === 'failed' && st.logStatusFailed,
                        ]}>
                        <Text
                          style={[
                            st.logStatusText,
                            n.status === 'sent' && st.logStatusTextSent,
                            n.status === 'failed' && st.logStatusTextFailed,
                          ]}>
                          {n.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c1520' },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { color: '#f97316', fontSize: 13, fontWeight: '900' },
  headerTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '900' },
  headerSub: { color: '#475569', fontSize: 11, fontWeight: '500', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  statCard: {
    flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  statNum: { color: '#f1f5f9', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { color: '#475569', fontSize: 10, fontWeight: '600', marginTop: 3 },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 3, gap: 2,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 9,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.25)',
  },
  tabBtnText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  tabBtnTextActive: { color: '#f97316' },

  /* Shared */
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  pressed: { opacity: 0.7 },
  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  /* Card */
  card: {
    borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' },
  refreshBtn: { padding: 6 },

  /* Notification form */
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

  /* Businesses */
  bizRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  bizAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(3,168,78,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  bizAvatarText: { color: '#03a84e', fontSize: 14, fontWeight: '900' },
  bizName: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  bizMeta: { color: '#475569', fontSize: 11, marginTop: 2 },
  bizBadge: {
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  bizBadgeText: { color: '#60a5fa', fontSize: 11, fontWeight: '700' },

  /* Log */
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
  logStatusText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  logStatusTextSent: { color: '#03a84e' },
  logStatusTextFailed: { color: '#ef4444' },
});
