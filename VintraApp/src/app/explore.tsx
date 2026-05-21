import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { listenSupportChats, resolveAdminProfile, type AdminProfile, type SupportChat } from '@/lib/admin-chat';

import { BottomTabInset, Spacing } from '@/constants/theme';

function MovingBackground() {
  const move = useSharedValue(0);

  useEffect(() => {
    move.value = withRepeat(withTiming(1, { duration: 7600, easing: Easing.inOut(Easing.cubic) }), -1, true);
  }, [move]);

  const topBand = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + move.value * 160 }, { rotateZ: '-12deg' }],
  }));

  const bottomBand = useAnimatedStyle(() => ({
    transform: [{ translateX: 100 - move.value * 150 }, { rotateZ: '17deg' }],
  }));

  return (
    <View pointerEvents="none" style={styles.background}>
      <Animated.View style={[styles.topBand, topBand]} />
      <Animated.View style={[styles.bottomBand, bottomBand]} />
    </View>
  );
}

function StatusCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusIcon, { backgroundColor: color }]}>
        <SymbolView name={icon} size={20} tintColor="#ffffff" />
      </View>
      <View style={styles.statusCardContent}>
        <Text style={styles.statusValue}>{value}</Text>
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [chats, setChats] = useState<SupportChat[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(firebaseAuth, (u) => {
      if (u) {
        resolveAdminProfile(u).then(setAdminProfile).catch(() => setAdminProfile(null));
      } else {
        setAdminProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!adminProfile) return;
    const unsub = listenSupportChats(
      adminProfile.businessId,
      (c: SupportChat[]) => setChats(c),
      (err) => console.error('Error listening to chats:', err)
    );
    return () => unsub();
  }, [adminProfile]);

  const totalChats = chats.length;
  const waitingChats = chats.filter((c) => c.status === 'needs-human').length;
  const humanChats = chats.filter((c) => c.status === 'open').length;
  const aiChats = chats.filter((c) => c.status === 'ai-active').length;
  const totalMessages = chats.reduce((sum, c) => sum + c.messages.length, 0);

  return (
    <View style={styles.container}>
      <MovingBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <View style={styles.center}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'chart.bar.xaxis', android: 'insights', web: 'insights' }} size={26} tintColor="#ffffff" />
          </View>
          <Text style={[styles.title, compact && styles.titleCompact]}>Status</Text>
          <Text style={[styles.lead, compact && styles.leadCompact]}>
            Real-time overview of support activity, messages, and AI performance.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatusCard label="Total Chats" value={String(totalChats)} color="#03a84e" icon={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat_bubble', web: 'chat_bubble' } as any} />
          <StatusCard label="Waiting Response" value={String(waitingChats)} color="#ef4444" icon={{ ios: 'exclamationmark.bubble.fill', android: 'mark_chat_unread', web: 'mark_chat_unread' } as any} />
          <StatusCard label="Active Support" value={String(humanChats)} color="#3b82f6" icon={{ ios: 'person.fill', android: 'person', web: 'person' } as any} />
          <StatusCard label="AI Managed" value={String(aiChats)} color="#8b5cf6" icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIcon}>
              <SymbolView name={{ ios: 'message.fill', android: 'chat', web: 'chat' }} size={22} tintColor="#ffffff" />
            </View>
            <View>
              <Text style={styles.panelTitle}>Message Statistics</Text>
              <Text style={styles.panelMeta}>Total volume of messages exchanged</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.messageCount}>
            <Text style={styles.messageCountValue}>{totalMessages}</Text>
            <Text style={styles.messageCountLabel}>Messages Sent</Text>
          </View>
        </View>

        {chats.length > 0 && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIcon, { backgroundColor: '#1e3a5f' }]}>
                <SymbolView name={{ ios: 'clock.fill', android: 'history', web: 'history' }} size={20} tintColor="#ffffff" />
              </View>
              <View>
                <Text style={styles.panelTitle}>Recent Activity</Text>
                <Text style={styles.panelMeta}>{chats.length} active conversation{chats.length > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            {chats.slice(0, 5).map((chat, index) => {
              const lastMessage = chat.messages.at(-1);
              const statusColor = chat.status === 'needs-human' ? '#ef4444' : chat.status === 'ai-active' ? '#8b5cf6' : '#03a84e';
              const statusLabel = chat.status === 'needs-human' ? 'Waiting' : chat.status === 'ai-active' ? 'AI' : 'Support';
              return (
                <View key={chat.id} style={[styles.activityRow, index === Math.min(chats.length, 5) - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.activityAvatar}>
                    <Text style={styles.activityAvatarText}>{(chat.visitorName || 'V').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityName}>{chat.visitorName || 'Visitor'}</Text>
                    <Text style={styles.activityMessage} numberOfLines={1}>
                      {lastMessage?.text || chat.preview || 'No messages yet'}
                    </Text>
                  </View>
                  <View style={styles.activityRight}>
                    <View style={[styles.activityStatus, { backgroundColor: statusColor + '18', borderColor: statusColor + '30' }]}>
                      <Text style={[styles.activityStatusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.activityTime}>
                      {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111f',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topBand: {
    position: 'absolute',
    top: 110,
    left: -170,
    width: 620,
    height: 170,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bottomBand: {
    position: 'absolute',
    right: -220,
    bottom: 80,
    width: 680,
    height: 210,
    borderRadius: 52,
    backgroundColor: 'rgba(3,168,78,0.12)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  center: {
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(3,168,78,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(3,168,78,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#ffffff',
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 34,
    lineHeight: 38,
  },
  lead: {
    color: '#9fb1ce',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 420,
    marginTop: Spacing.two,
  },
  leadCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  statusCard: {
    width: '47.5%',
    borderRadius: 20,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardContent: {
    flex: 1,
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  statusLabel: {
    color: '#9fb1ce',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  panel: {
    borderRadius: 24,
    padding: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  panelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  panelMeta: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  messageCount: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  messageCountValue: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  messageCountLabel: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  activityAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  activityContent: {
    flex: 1,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  activityStatus: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  activityStatusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activityName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  activityMessage: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  activityTime: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: Spacing.one,
  },
});

