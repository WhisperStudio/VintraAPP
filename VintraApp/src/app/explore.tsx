import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { listenSupportChats, type SupportChat } from '@/lib/admin-chat';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <Animated.View entering={FadeInUp} style={styles.statusCard}>
      <View style={[styles.statusIcon, { backgroundColor: color }]}>
        <SymbolView name={icon} size={20} tintColor="#ffffff" />
      </View>
      <ThemedText style={styles.statusValue}>{value}</ThemedText>
      <ThemedText style={styles.statusLabel}>{label}</ThemedText>
    </Animated.View>
  );
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<SupportChat[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenSupportChats(user.uid, (c: SupportChat[]) => setChats(c), () => {});
    return () => unsub();
  }, [user]);

  const totalChats = chats.length;
  const waitingChats = chats.filter((c) => c.status === 'needs-human').length;
  const activeChats = chats.filter((c) => c.status === 'open').length;
  const aiChats = chats.filter((c) => c.status === 'ai-active').length;
  const totalMessages = chats.reduce((sum, c) => sum + c.messages.length, 0);

  return (
    <ThemedView style={styles.container}>
      <MovingBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.center}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'chart.line.uptrend.xyaxis', android: 'insights', web: 'insights' }} size={28} tintColor="#ffffff" />
          </View>
          <ThemedText style={[styles.title, compact && styles.titleCompact]}>Status</ThemedText>
          <ThemedText style={styles.lead}>
            Sanntidsoversikt over support-aktivitet og meldinger.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.statsGrid}>
          <StatusCard label="Totale samtaler" value={String(totalChats)} color="#03a84e" icon={{ ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' } as any} />
          <StatusCard label="Venter på svar" value={String(waitingChats)} color="#ef4444" icon={{ ios: 'phone.fill', android: 'call', web: 'call' } as any} />
          <StatusCard label="Aktive samtaler" value={String(activeChats)} color="#3b82f6" icon={{ ios: 'person.2.fill', android: 'people', web: 'people' } as any} />
          <StatusCard label="AI-håndtert" value={String(aiChats)} color="#8b5cf6" icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIcon}>
              <SymbolView name={{ ios: 'message.fill', android: 'chat', web: 'chat' }} size={22} tintColor="#ffffff" />
            </View>
            <View>
              <ThemedText style={styles.panelTitle}>Meldingsstatistikk</ThemedText>
              <ThemedText style={styles.panelMeta}>Totalt antall meldinger sendt</ThemedText>
            </View>
          </View>
          <View style={styles.messageCount}>
            <ThemedText style={styles.messageCountValue}>{totalMessages}</ThemedText>
            <ThemedText style={styles.messageCountLabel}>meldinger</ThemedText>
          </View>
        </Animated.View>

        {chats.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Siste aktivitet</ThemedText>
            {chats.slice(0, 3).map((chat) => {
              const lastMessage = chat.messages.at(-1);
              return (
                <View key={chat.id} style={styles.activityRow}>
                  <View style={[styles.activityDot, { backgroundColor: chat.status === 'needs-human' ? '#ef4444' : '#03a84e' }]} />
                  <View style={styles.activityContent}>
                    <ThemedText style={styles.activityName}>{chat.visitorName || 'Ukjent'}</ThemedText>
                    <ThemedText style={styles.activityMessage} numberOfLines={1}>
                      {lastMessage?.text || chat.preview || 'Ingen melding'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.activityTime}>{new Date(chat.updatedAt).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</ThemedText>
                </View>
              );
            })}
          </Animated.View>
        ) : null}
      </ScrollView>
    </ThemedView>
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
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bottomBand: {
    position: 'absolute',
    right: -220,
    bottom: 80,
    width: 680,
    height: 210,
    borderRadius: 52,
    backgroundColor: 'rgba(3,168,78,0.25)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  center: {
    alignItems: 'center',
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(3,168,78,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(3,168,78,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#ffffff',
    fontSize: 52,
    lineHeight: 57,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 38,
    lineHeight: 42,
  },
  lead: {
    color: '#bdc9dc',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 560,
    marginTop: Spacing.three,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  statusCard: {
    width: '48%',
    minHeight: 120,
    borderRadius: 24,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
  },
  statusLabel: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  panel: {
    borderRadius: 28,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: Spacing.three,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  panelIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#246cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  panelMeta: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  messageCount: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  messageCountValue: {
    color: '#ffffff',
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '900',
  },
  messageCountLabel: {
    color: '#9fb1ce',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  activityMessage: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  activityTime: {
    color: '#7da8ff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});
