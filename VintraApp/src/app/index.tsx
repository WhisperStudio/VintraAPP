import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  listenSupportChat,
  listenSupportChats,
  resolveAdminProfile,
  sendSupportReply,
  setSupportChatStatus,
  type AdminProfile,
  type SupportChat,
  type SupportMessage,
} from '@/lib/admin-chat';
import { firebaseAuth } from '@/lib/firebase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type AppSymbolName = NonNullable<ComponentProps<typeof SymbolView>['name']>;

function VintraMark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.logoMark}>
      <View style={[styles.logoBladeLeft, light && styles.logoBladeLight]} />
      <View style={[styles.logoBladeRight, light && styles.logoBladeSoft]} />
      <View style={[styles.logoDot, light && styles.logoDotLight]} />
    </View>
  );
}

function AnimatedBackdrop() {
  const drift = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.cubic) }), -1, true);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [drift, pulse]);

  const bandOne = useAnimatedStyle(() => ({
    transform: [
      { translateX: -80 + drift.value * 140 },
      { translateY: -30 + drift.value * 40 },
      { rotateZ: '-18deg' },
      { scale: pulse.value },
    ],
  }));

  const bandTwo = useAnimatedStyle(() => ({
    transform: [
      { translateX: 90 - drift.value * 120 },
      { translateY: 70 - drift.value * 50 },
      { rotateZ: '24deg' },
      { scale: 1.04 },
    ],
  }));

  const beam = useAnimatedStyle(() => ({
    opacity: 0.22 + drift.value * 0.18,
    transform: [{ translateX: -260 + drift.value * 520 }, { rotateZ: '16deg' }],
  }));

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Animated.View style={[styles.lightBand, bandOne]} />
      <Animated.View style={[styles.blueBand, bandTwo]} />
      <Animated.View style={[styles.scanBeam, beam]} />
      <View style={styles.noiseLayer} />
    </View>
  );
}

function AuthField({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
}: {
  icon: AppSymbolName;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoComplete?: 'email' | 'password' | 'name';
  returnKeyType?: 'next' | 'done' | 'send';
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.inputShell}>
      <SymbolView name={icon} size={18} tintColor="#6e85ad" />
      <TextInput
        autoCapitalize="none"
        autoComplete={autoComplete}
        placeholder={placeholder}
        placeholderTextColor="#8a98ad"
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

function AuthScreen({ compact }: { compact: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Mangler info', 'Fyll inn e-post og passord for å fortsette.');
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert('Mangler navn', 'Skriv inn navnet ditt før du oppretter konto.');
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        const credentials = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credentials.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke logge inn akkurat nå.';
      Alert.alert(isRegister ? 'Registrering feilet' : 'Innlogging feilet', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.authLayout, compact && styles.authLayoutCompact]}>
      <Animated.View entering={FadeInUp.delay(120).springify()} style={styles.authIntro}>
        <View style={styles.brand}>
          <VintraMark light />
          <View>
            <ThemedText style={styles.brandName}>VINTRA</ThemedText>
            <ThemedText style={styles.brandSubline}>Nordisk digitalstudio</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.authTitle, compact && styles.authTitleCompact]}>Admin kontroll for hele Vintra.</ThemedText>
        <ThemedText style={styles.authLead}>
          Logg inn for å styre chat-widgets, nettsider, oppgaver og support fra et panel laget for mobilen først.
        </ThemedText>
        <View style={styles.featureGrid}>
          {['Live widgets', 'Sikre brukere', 'Mobil admin'].map((item) => (
            <View key={item} style={styles.featurePill}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.featureText}>{item}</ThemedText>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.authCard}>
        <View style={styles.segment}>
          <Pressable onPress={() => setMode('login')} style={[styles.segmentButton, !isRegister && styles.segmentActive]}>
            <ThemedText style={[styles.segmentText, !isRegister && styles.segmentTextActive]}>Login</ThemedText>
          </Pressable>
          <Pressable onPress={() => setMode('register')} style={[styles.segmentButton, isRegister && styles.segmentActive]}>
            <ThemedText style={[styles.segmentText, isRegister && styles.segmentTextActive]}>Register</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.formTitle}>{isRegister ? 'Opprett adminbruker' : 'Velkommen tilbake'}</ThemedText>
        <ThemedText style={styles.formLead}>
          {isRegister ? 'Lag en konto koblet til Firebase Auth.' : 'Logg inn med Firebase-kontoen din.'}
        </ThemedText>

        <View style={styles.form}>
          {isRegister && (
            <AuthField
              icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              autoComplete="name"
              placeholder="Fullt navn"
              returnKeyType="next"
              value={name}
              onChangeText={setName}
            />
          )}
          <AuthField
            icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
            autoComplete="email"
            placeholder="E-post"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />
          <AuthField
            icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            autoComplete="password"
            placeholder="Passord"
            returnKeyType="done"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
        </View>

        <AnimatedPressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.submitButton, busy && styles.submitButtonBusy, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <ThemedText style={styles.submitText}>{isRegister ? 'Opprett konto' : 'Logg inn'}</ThemedText>
              <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={19} tintColor="#ffffff" />
            </>
          )}
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

function AdminScreen({ user, compact }: { user: User; compact: boolean }) {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const displayName = adminProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Admin';
  const activeChats = chats.filter((chat) => chat.status !== 'ai-active').length;
  const waitingChats = chats.filter((chat) => chat.status === 'needs-human').length;
  const unansweredChats = chats.filter((chat) => chat.status === 'needs-human');
  const servedChats = chats.filter((chat) => chat.status !== 'needs-human');
  const selectedChatFromList = chats.find((chat) => chat.id === selectedChatId);
  const activeChat = selectedChat || selectedChatFromList || null;
  const openChat = compact ? activeChat : (activeChat || chats[0] || null);

  function handleSelectChat(chatId: string) {
    setSelectedChatId(chatId);
    if (compact) {
      setChatOpen(true);
    }
  }

  function handleBackToList() {
    setChatOpen(false);
  }

  useEffect(() => {
    let mounted = true;

    setAdminReady(false);
    setAccessError('');
    setAdminProfile(null);

    resolveAdminProfile(user)
      .then((profile) => {
        if (!mounted) {
          return;
        }

        setAdminProfile(profile);
        setAdminReady(true);

        if (!profile) {
          setAccessError('Denne brukeren har ikke admin-tilgang til en Vintra-bedrift.');
        }
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setAccessError(error instanceof Error ? error.message : 'Kunne ikke sjekke admin-tilgang.');
        setAdminReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!adminProfile) {
      return undefined;
    }

    setChatsLoading(true);
    setAccessError('');

    return listenSupportChats(
      adminProfile.businessId,
      (nextChats) => {
        setChats(nextChats);
        setChatsLoading(false);
        setSelectedChatId((current) => current || nextChats[0]?.id || null);
      },
      (error) => {
        setAccessError(error.message);
        setChatsLoading(false);
      },
    );
  }, [adminProfile]);

  useEffect(() => {
    if (!adminProfile || !selectedChatId) {
      setSelectedChat(null);
      return undefined;
    }

    setChatLoading(true);

    return listenSupportChat(
      adminProfile.businessId,
      selectedChatId,
      (chat) => {
        setSelectedChat(chat);
        setChatLoading(false);
      },
      (error) => {
        setAccessError(error.message);
        setChatLoading(false);
      },
    );
  }, [adminProfile, selectedChatId]);

  async function handleSignOut() {
    await signOut(firebaseAuth);
  }

  async function handleSendReply() {
    if (!adminProfile || !openChat || sending || !reply.trim()) {
      return;
    }

    setSending(true);
    setAccessError('');

    try {
      await sendSupportReply(adminProfile.businessId, openChat, reply, adminProfile);
      setReply('');
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Kunne ikke sende svar.');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: 'open' | 'ai-active') {
    if (!adminProfile || !openChat) {
      return;
    }

    setSending(true);
    setAccessError('');

    try {
      await setSupportChatStatus(adminProfile.businessId, openChat, status);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Kunne ikke oppdatere status.');
    } finally {
      setSending(false);
    }
  }

  if (!adminReady) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color="#ffffff" size="large" />
        <ThemedText style={styles.loadingText}>Sjekker admin-tilgang...</ThemedText>
      </View>
    );
  }

  if (!adminProfile) {
    return (
      <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.noAccessCard}>
        <View style={styles.noAccessIcon}>
          <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={24} tintColor="#ffffff" />
        </View>
        <ThemedText style={styles.noAccessTitle}>Ingen tilgang</ThemedText>
        <ThemedText style={styles.noAccessText}>{accessError || 'Du må være admin for å åpne dette panelet.'}</ThemedText>
        <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.noAccessButton, pressed && styles.pressed]}>
          <ThemedText style={styles.noAccessButtonText}>Logg ut</ThemedText>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.dashboard}>
      {!(compact && chatOpen) && (
        <>
          <View style={styles.dashboardHeader}>
            <View style={styles.brandDark}>
              <VintraMark />
              <View>
                <ThemedText style={styles.brandNameDark}>VINTRA</ThemedText>
                <ThemedText style={styles.brandSublineDark}>Adminpanel</ThemedText>
              </View>
            </View>
            <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={17} tintColor="#142033" />
              {!compact && <ThemedText style={styles.logoutText}>Logg ut</ThemedText>}
            </Pressable>
          </View>

          <View style={styles.inboxHeader}>
            <View style={styles.inboxHeaderTop}>
              <View>
                <ThemedText style={styles.inboxKicker}>Support inbox</ThemedText>
                <ThemedText style={[styles.inboxTitle, compact && styles.inboxTitleCompact]}>Meldinger</ThemedText>
              </View>
              <View style={styles.inboxPresence}>
                <View style={styles.statusDotActive} />
                <ThemedText style={styles.inboxPresenceText}>Live</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.inboxLead}>Hei {displayName}. Her svarer du på kundehenvendelser direkte fra samme Firebase som web-admin.</ThemedText>
            <View style={styles.inboxMetrics}>
              <InboxMetric label="Ubesvart" value={String(waitingChats)} active />
              <InboxMetric label="Aktive" value={String(activeChats)} />
              <InboxMetric label="Totalt" value={String(chats.length)} />
            </View>
          </View>

          {accessError ? <ThemedText style={styles.inlineError}>{accessError}</ThemedText> : null}
        </>
      )}

      <View style={[styles.supportLayout, compact && styles.supportLayoutCompact]}>
        {(!compact || !chatOpen) && (
          <View style={[styles.conversationListPanel, compact && styles.conversationListPanelFull]}>
            <View style={styles.inboxTabs}>
              <View style={styles.inboxTabActive}>
                <ThemedText style={styles.inboxTabTextActive}>Active chats</ThemedText>
                {waitingChats ? (
                  <View style={styles.tabBadge}>
                    <ThemedText style={styles.tabBadgeText}>{waitingChats}</ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={styles.inboxTab}>
                <ThemedText style={styles.inboxTabText}>AI / closed</ThemedText>
              </View>
              {chatsLoading ? <ActivityIndicator color="#246cff" /> : null}
            </View>

            {!chatsLoading && !chats.length ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>Ingen samtaler ennå</ThemedText>
                <ThemedText style={styles.emptyText}>Når en kunde ber om menneskelig support, dukker den opp her.</ThemedText>
              </View>
            ) : (
              <View style={styles.conversationList}>
                {unansweredChats.length ? <ConversationSection title="Unanswered" count={unansweredChats.length} urgent /> : null}
                {unansweredChats.map((chat) => (
                  <ConversationRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === selectedChatId}
                    onPress={() => handleSelectChat(chat.id)}
                  />
                ))}
                {servedChats.length ? <ConversationSection title="Served" count={servedChats.length} /> : null}
                {servedChats.map((chat) => (
                  <ConversationRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === selectedChatId}
                    onPress={() => handleSelectChat(chat.id)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {(!compact || chatOpen) && (
          <View style={[styles.chatPanel, compact && styles.chatPanelFull]}>
            {openChat ? (
              <>
                <View style={styles.chatHeader}>
                  {compact && (
                    <Pressable onPress={handleBackToList} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor="#111a2c" />
                    </Pressable>
                  )}
                  <View style={styles.chatAvatar}>
                    <ThemedText style={styles.chatAvatarText}>{(openChat.visitorName || 'K').slice(0, 1).toUpperCase()}</ThemedText>
                  </View>
                  <View style={styles.chatHeaderCopy}>
                    <ThemedText style={styles.chatTitle}>{openChat.visitorName || 'Ukjent kunde'}</ThemedText>
                    <ThemedText numberOfLines={1} style={styles.chatMeta}>
                      {openChat.pageTitle || openChat.pageUrl || openChat.sessionId}
                    </ThemedText>
                  </View>
                  <StatusPill status={openChat.status} />
                </View>

                <View style={styles.chatActionRow}>
                  <Pressable
                    disabled={sending}
                    onPress={() => handleStatusChange('open')}
                    style={({ pressed }) => [styles.chatActionButton, openChat.status === 'open' && styles.chatActionButtonActive, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }} size={16} tintColor={openChat.status === 'open' ? '#ffffff' : '#1d4ed8'} />
                    <ThemedText style={[styles.chatActionText, openChat.status === 'open' && styles.chatActionTextActive]}>Ta over</ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={sending}
                    onPress={() => handleStatusChange('ai-active')}
                    style={({ pressed }) => [styles.chatActionButton, openChat.status === 'ai-active' && styles.chatActionButtonActive, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor={openChat.status === 'ai-active' ? '#ffffff' : '#1d4ed8'} />
                    <ThemedText style={[styles.chatActionText, openChat.status === 'ai-active' && styles.chatActionTextActive]}>AI</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.messageList}>
                  {chatLoading ? (
                    <ActivityIndicator color="#246cff" />
                  ) : (
                    openChat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
                  )}
                </View>

                <View style={styles.replyBar}>
                  <TextInput
                    multiline
                    placeholder="Skriv svar til kunden..."
                    placeholderTextColor="#7d8aa0"
                    returnKeyType="send"
                    style={styles.replyInput}
                    value={reply}
                    onChangeText={setReply}
                    onSubmitEditing={handleSendReply}
                  />
                  <Pressable
                    disabled={sending || !reply.trim()}
                    onPress={handleSendReply}
                    style={({ pressed }) => [styles.sendReplyButton, (sending || !reply.trim()) && styles.buttonDisabled, pressed && styles.pressed]}>
                    {sending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={20} tintColor="#ffffff" />
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>Velg en samtale</ThemedText>
                <ThemedText style={styles.emptyText}>Åpne en chat fra listen for å lese meldinger og svare.</ThemedText>
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function InboxMetric({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <View style={[styles.inboxMetric, active && styles.inboxMetricActive]}>
      <ThemedText style={[styles.inboxMetricValue, active && styles.inboxMetricValueActive]}>{value}</ThemedText>
      <ThemedText style={[styles.inboxMetricLabel, active && styles.inboxMetricLabelActive]}>{label}</ThemedText>
    </View>
  );
}

function ConversationSection({ title, count, urgent }: { title: string; count: number; urgent?: boolean }) {
  return (
    <View style={styles.conversationSection}>
      <ThemedText style={[styles.conversationSectionText, urgent && styles.conversationSectionUrgent]}>{title}</ThemedText>
      <View style={[styles.conversationSectionBadge, urgent && styles.conversationSectionBadgeUrgent]}>
        <ThemedText style={[styles.conversationSectionBadgeText, urgent && styles.conversationSectionBadgeTextUrgent]}>{count}</ThemedText>
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status === 'needs-human' ? 'Venter' : status === 'open' ? 'Åpen' : status === 'ai-active' ? 'AI' : status;

  return (
    <View style={[styles.chatStatusPill, status === 'needs-human' && styles.chatStatusWaiting]}>
      <View style={[styles.statusDot, status !== 'ai-active' && styles.statusDotActive]} />
      <ThemedText style={styles.chatStatusText}>{label}</ThemedText>
    </View>
  );
}

function avatarColor(name: string): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  return colors[(name.charCodeAt(0) + (name.length || 0)) % colors.length];
}

function statusLabel(status: string): string {
  if (status === 'needs-human') return 'New';
  if (status === 'open') return 'Returning';
  if (status === 'ai-active') return 'AI';
  return 'Active';
}

function ConversationRow({ chat, active, onPress }: { chat: SupportChat; active: boolean; onPress: () => void }) {
  const lastMessage = chat.messages.at(-1);
  const needsAnswer = chat.status === 'needs-human';
  const label = statusLabel(chat.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationRow,
        needsAnswer && styles.conversationRowUrgent,
        active && styles.conversationRowActive,
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.conversationAvatar,
          needsAnswer && styles.conversationAvatarUrgent,
          { backgroundColor: needsAnswer ? '#ef4444' : avatarColor(chat.visitorName || 'K') },
        ]}>
        {needsAnswer ? (
          <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={18} tintColor="#ffffff" />
        ) : (
          <ThemedText style={styles.conversationAvatarText}>{(chat.visitorName || 'K').slice(0, 1).toUpperCase()}</ThemedText>
        )}
      </View>
      <View style={styles.conversationCopy}>
        <View style={styles.conversationTop}>
          <ThemedText numberOfLines={1} style={styles.conversationName}>
            {chat.visitorName || 'Ukjent kunde'}
          </ThemedText>
          <ThemedText style={styles.conversationTime}>{formatTime(chat.updatedAt)}</ThemedText>
        </View>
        <View style={styles.conversationMiddle}>
          <SymbolView name={{ ios: 'globe', android: 'language', web: 'language' }} size={10} tintColor="#94a3b8" />
          <ThemedText numberOfLines={1} style={styles.conversationSource}>
            {chat.pageTitle || chat.countryCode || 'vintranordic.com'}
          </ThemedText>
        </View>
        <ThemedText numberOfLines={1} style={styles.conversationPreview}>
          {lastMessage?.text || chat.preview || 'Ingen melding ennå'}
        </ThemedText>
      </View>
      <View style={styles.conversationRight}>
        <ThemedText style={[styles.conversationStatusLabel, needsAnswer && styles.conversationStatusLabelUrgent]}>{label}</ThemedText>
        {needsAnswer ? <View style={styles.unreadBadge} /> : null}
      </View>
    </Pressable>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromAdmin = message.role === 'support';
  const fromSystem = message.role === 'system';

  return (
    <View style={[styles.messageRow, fromAdmin && styles.messageRowAdmin, fromSystem && styles.messageRowSystem]}>
      <View style={[styles.messageBubble, fromAdmin && styles.messageBubbleAdmin, fromSystem && styles.messageBubbleSystem]}>
        <ThemedText style={[styles.messageText, fromAdmin && styles.messageTextAdmin, fromSystem && styles.messageTextSystem]}>
          {message.text}
        </ThemedText>
        <ThemedText style={[styles.messageTime, fromAdmin && styles.messageTimeAdmin]}>{formatTime(message.createdAt)}</ThemedText>
      </View>
    </View>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  const contentPadding = useMemo(
    () => ({ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.five }),
    [insets.bottom, insets.top],
  );

  return (
    <ThemedView style={styles.container}>
      <AnimatedBackdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, compact && styles.contentCompact, contentPadding]}>
          {!authReady ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#ffffff" size="large" />
              <ThemedText style={styles.loadingText}>Klargjor Firebase...</ThemedText>
            </View>
          ) : user ? (
            <AdminScreen user={user} compact={compact} />
          ) : (
            <AuthScreen compact={compact} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111f',
  },
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lightBand: {
    position: 'absolute',
    top: 64,
    left: -130,
    width: 560,
    height: 190,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blueBand: {
    position: 'absolute',
    right: -210,
    bottom: 70,
    width: 680,
    height: 240,
    borderRadius: 54,
    backgroundColor: 'rgba(36,108,255,0.30)',
  },
  scanBeam: {
    position: 'absolute',
    top: -80,
    left: '50%',
    width: 130,
    height: 900,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  noiseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  contentCompact: {
    paddingHorizontal: Spacing.three,
  },
  loadingState: {
    flex: 1,
    minHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  loadingText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  authLayout: {
    flex: 1,
    minHeight: 650,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  authLayoutCompact: {
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  authIntro: {
    flex: 1,
    maxWidth: 560,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.four,
  },
  brandDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 38,
    height: 32,
  },
  logoBladeLeft: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 14,
    height: 31,
    borderRadius: 8,
    backgroundColor: '#0f6eff',
    transform: [{ rotateZ: '-29deg' }],
  },
  logoBladeRight: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 14,
    height: 31,
    borderRadius: 8,
    backgroundColor: '#10204e',
    transform: [{ rotateZ: '29deg' }],
  },
  logoDot: {
    position: 'absolute',
    right: 0,
    top: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#1f7bff',
  },
  logoBladeLight: {
    backgroundColor: '#ffffff',
  },
  logoBladeSoft: {
    backgroundColor: '#98bcff',
  },
  logoDotLight: {
    backgroundColor: '#ffffff',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandNameDark: {
    color: '#111a2c',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandSubline: {
    color: '#9fb4d9',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  brandSublineDark: {
    color: '#75839a',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  authTitle: {
    color: '#ffffff',
    fontSize: 60,
    lineHeight: 64,
    fontWeight: '900',
  },
  authTitleCompact: {
    fontSize: 42,
    lineHeight: 46,
  },
  authLead: {
    color: '#c3cee0',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: Spacing.three,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  featurePill: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7df7c4',
  },
  featureText: {
    color: '#edf4ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  authCard: {
    flex: 1,
    maxWidth: 430,
    borderRadius: 32,
    padding: Spacing.four,
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 28 },
  },
  segment: {
    height: 52,
    padding: 5,
    borderRadius: 26,
    flexDirection: 'row',
    backgroundColor: '#e8eef8',
    marginBottom: Spacing.four,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#03a84e',
    shadowColor: '#03a84e',
    shadowOpacity: 0.30,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  segmentText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  formTitle: {
    color: '#111a2c',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
  },
  formLead: {
    color: '#68768c',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  form: {
    gap: 12,
    marginTop: Spacing.four,
  },
  inputShell: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: '#111a2c',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 72,
    borderRadius: 28,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#03a84e',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#03a84e',
    shadowOpacity: 0.75,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  submitButtonBusy: {
    opacity: 0.82,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dashboard: {
    flex: 1,
    gap: Spacing.three,
  },
  dashboardHeader: {
    minHeight: 66,
    borderRadius: 28,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef3fb',
  },
  logoutText: {
    color: '#142033',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  adminHero: {
    borderRadius: 30,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    backgroundColor: '#eef5ff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  adminHeroCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  adminHeroCopy: {
    flex: 1,
  },
  livePill: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    marginBottom: Spacing.three,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a0aec0',
  },
  statusDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#18c68b',
  },
  livePillText: {
    color: '#142033',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  adminTitle: {
    color: '#101827',
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
  },
  adminTitleCompact: {
    fontSize: 34,
    lineHeight: 38,
  },
  adminLead: {
    color: '#5f6f86',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  inboxHeader: {
    borderRadius: 28,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  inboxHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  inboxKicker: {
    color: '#246cff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  inboxTitle: {
    color: '#111a2c',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    marginTop: 2,
  },
  inboxTitleCompact: {
    fontSize: 34,
    lineHeight: 38,
  },
  inboxLead: {
    color: '#65748d',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: Spacing.two,
  },
  inboxPresence: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#b7f7d7',
  },
  inboxPresenceText: {
    color: '#047857',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  inboxMetrics: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  inboxMetric: {
    flex: 1,
    minHeight: 64,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    backgroundColor: '#f3f7fc',
    borderWidth: 1,
    borderColor: '#e0e8f2',
  },
  inboxMetricActive: {
    backgroundColor: '#111a2c',
    borderColor: '#111a2c',
  },
  inboxMetricValue: {
    color: '#111a2c',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  inboxMetricValueActive: {
    color: '#ffffff',
  },
  inboxMetricLabel: {
    color: '#65748d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  inboxMetricLabelActive: {
    color: '#c9d7ef',
  },
  addButton: {
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111a2c',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 24,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f0ff',
    marginBottom: Spacing.two,
  },
  statValue: {
    color: '#111a2c',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
  },
  statLabel: {
    color: '#69778e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  panel: {
    borderRadius: 26,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  panelDark: {
    flex: 1,
    borderRadius: 26,
    padding: Spacing.three,
    backgroundColor: '#111a2c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  panelTitle: {
    color: '#111a2c',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  panelTitleLight: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  panelLead: {
    color: '#65748d',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  keyPill: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef4ff',
  },
  keyPillText: {
    color: '#246cff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  widgetInput: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    color: '#111a2c',
    fontSize: 15,
    fontWeight: '800',
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: '#dce5f2',
    marginBottom: Spacing.three,
  },
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  widgetPressable: {
    flexGrow: 1,
    minWidth: 230,
  },
  widgetCard: {
    minHeight: 154,
    borderRadius: 24,
    padding: Spacing.three,
    backgroundColor: '#f9fbff',
    borderWidth: 1,
    borderColor: '#dfe7f2',
  },
  widgetCardActive: {
    backgroundColor: '#edf4ff',
    borderColor: '#8db4ff',
  },
  widgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  widgetBadge: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#246cff',
  },
  widgetBadgeDark: {
    backgroundColor: '#111a2c',
  },
  widgetStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  widgetStatusText: {
    color: '#607087',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  widgetName: {
    color: '#111a2c',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  widgetKey: {
    color: '#62728a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  lowerGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  lowerGridCompact: {
    flexDirection: 'column',
  },
  taskList: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  taskRow: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#f5f8fd',
  },
  taskCheck: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7efff',
  },
  taskNumber: {
    color: '#246cff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  taskText: {
    flex: 1,
    color: '#263449',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  panelKey: {
    color: '#b7c7e7',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: Spacing.two,
  },
  embedBox: {
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: Spacing.three,
  },
  embedText: {
    color: '#e8f0ff',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  noAccessCard: {
    flex: 1,
    minHeight: 560,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    padding: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  noAccessIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111a2c',
    marginBottom: Spacing.three,
  },
  noAccessTitle: {
    color: '#111a2c',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  noAccessText: {
    color: '#65748d',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  noAccessButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#246cff',
    marginTop: Spacing.four,
  },
  noAccessButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  inlineError: {
    color: '#fee2e2',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    padding: Spacing.three,
    borderRadius: 18,
    backgroundColor: 'rgba(185,28,28,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.24)',
  },
  supportLayout: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  supportLayoutCompact: {
    flexDirection: 'column',
    flex: 1,
  },
  conversationListPanel: {
    flex: 0.8,
    minWidth: 300,
    borderRadius: 24,
    padding: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    overflow: 'hidden',
  },
  conversationListPanelFull: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
  },
  inboxTabs: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fbfdff',
  },
  inboxTabActive: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderBottomWidth: 3,
    borderBottomColor: '#246cff',
  },
  inboxTab: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  inboxTabTextActive: {
    color: '#111a2c',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  inboxTabText: {
    color: '#77849a',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  conversationList: {
    paddingBottom: Spacing.two,
  },
  conversationRow: {
    minHeight: 82,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  conversationRowUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  conversationRowActive: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#03a84e',
    paddingLeft: Spacing.three - 4,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111a2c',
  },
  conversationAvatarUrgent: {
    backgroundColor: '#ef4444',
  },
  conversationAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  conversationCopy: {
    flex: 1,
    minWidth: 0,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationName: {
    flex: 1,
    color: '#111a2c',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  conversationTime: {
    color: '#7b889b',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  conversationPreview: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 3,
  },
  conversationSource: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  conversationMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  conversationRight: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 52,
  },
  conversationStatusLabel: {
    color: '#047857',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  conversationStatusLabelUrgent: {
    color: '#ef4444',
  },
  conversationSection: {
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f4f6fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e6edf6',
  },
  conversationSectionText: {
    color: '#047857',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  conversationSectionUrgent: {
    color: '#ef4444',
  },
  conversationSectionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
  },
  conversationSectionBadgeUrgent: {
    backgroundColor: '#fee2e2',
  },
  conversationSectionBadgeText: {
    color: '#047857',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  conversationSectionBadgeTextUrgent: {
    color: '#ef4444',
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#246cff',
  },
  chatPanel: {
    flex: 1.2,
    minWidth: 320,
    borderRadius: 24,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  chatPanelFull: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    padding: Spacing.three,
  },
  chatHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#e6edf6',
  },
  chatActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#e6edf6',
  },
  chatActionButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eef5ff',
    borderWidth: 1,
    borderColor: '#d5e5ff',
  },
  chatActionButtonActive: {
    backgroundColor: '#246cff',
    borderColor: '#246cff',
  },
  chatActionText: {
    color: '#1d4ed8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  chatActionTextActive: {
    color: '#ffffff',
  },
  chatAvatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#246cff',
  },
  chatAvatarText: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  chatHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    color: '#111a2c',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  chatMeta: {
    color: '#65748d',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  chatStatusPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#eef3fb',
  },
  chatStatusWaiting: {
    backgroundColor: '#e8f0ff',
  },
  chatStatusText: {
    color: '#263449',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  messageList: {
    flex: 1,
    gap: 10,
    paddingVertical: Spacing.three,
  },
  messageRow: {
    alignItems: 'flex-start',
  },
  messageRowAdmin: {
    alignItems: 'flex-end',
  },
  messageRowSystem: {
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    backgroundColor: '#eef3fb',
  },
  messageBubbleAdmin: {
    backgroundColor: '#246cff',
  },
  messageBubbleSystem: {
    backgroundColor: '#fff7ed',
  },
  messageText: {
    color: '#172033',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  messageTextAdmin: {
    color: '#ffffff',
  },
  messageTextSystem: {
    color: '#9a3412',
    textAlign: 'center',
  },
  messageTime: {
    color: '#6b7890',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  messageTimeAdmin: {
    color: 'rgba(255,255,255,0.72)',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#e6edf6',
  },
  replyInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    color: '#111a2c',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  sendReplyButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#246cff',
  },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  emptyTitle: {
    color: '#111a2c',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#65748d',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    marginRight: 4,
  },
  pressed: {
    opacity: 0.72,
  },
});
