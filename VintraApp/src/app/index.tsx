import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
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
  closeSupportChat,
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
      await AsyncStorage.setItem('@vintra_creds', JSON.stringify({ email: email.trim(), password }));
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

function AdminBackground() {
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
    <View pointerEvents="none" style={styles.adminBackground}>
      <Animated.View style={[styles.adminTopBand, topBand]} />
      <Animated.View style={[styles.adminBottomBand, bottomBand]} />
    </View>
  );
}

function AdminScreen({ user, compact, chatOpen, setChatOpen, initialSelectedChatId, onChatSelect }: { user: User; compact: boolean; chatOpen: boolean; setChatOpen: (v: boolean) => void; initialSelectedChatId?: string | null; onChatSelect?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialSelectedChatId ?? null);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<ScrollView>(null);

  const displayName = adminProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Admin';
  const visibleChats = chats.filter((chat) => chat.status !== 'closed');
  const activeChats = visibleChats.filter((chat) => chat.status !== 'ai-active').length;
  const waitingChats = visibleChats.filter((chat) => chat.status === 'needs-human').length;
  const unansweredChats = visibleChats.filter((chat) => chat.status === 'needs-human');
  const servedChats = visibleChats.filter((chat) => chat.status !== 'needs-human');
  const selectedChatFromList = visibleChats.find((chat) => chat.id === selectedChatId);
  const activeChat = selectedChat || selectedChatFromList || null;
  const openChat = compact ? activeChat : (activeChat || visibleChats[0] || null);

  useEffect(() => {
    if (openChat && messageListRef.current) {
      setTimeout(() => messageListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [openChat?.id, openChat?.messages.length]);

  function handleSelectChat(chatId: string) {
    setSelectedChatId(chatId);
    if (compact) {
      onChatSelect?.(chatId);
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
    await AsyncStorage.removeItem('@vintra_creds');
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

  function handleCloseChat() {
    if (!adminProfile || !openChat) return;
    Alert.alert(
      'Lukk samtale',
      `Lukke samtalen med ${openChat.visitorName || 'ukjent'}? Dette kan ikke angres.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Lukk',
          style: 'destructive',
          onPress: async () => {
            try {
              await closeSupportChat(adminProfile.businessId, openChat);
              if (compact) setChatOpen(false);
              else setSelectedChatId(null);
            } catch (error) {
              setAccessError(error instanceof Error ? error.message : 'Kunne ikke lukke samtalen.');
            }
          },
        },
      ],
    );
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
    <>
      <AdminBackground />
      <Animated.View entering={FadeInUp.delay(80).springify()} style={[styles.dashboard, compact && chatOpen && styles.dashboardCompactOpen]}>
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
              <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={17} tintColor="#ffffff" />
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
          <Animated.View 
            entering={compact ? undefined : FadeInUp.duration(200)}
            exiting={compact ? undefined : FadeOut.duration(150)}
            style={[styles.chatPanel, compact && styles.chatPanelFull]}>
            {openChat ? (
              <>
                <View style={[styles.chatHeader, compact && { paddingTop: insets.top + 8 }]}>
                  {compact && (
                    <Pressable onPress={handleBackToList} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor="#ffffff" />
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
                    <SymbolView name={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }} size={16} tintColor="#ffffff" />
                    <ThemedText style={[styles.chatActionText, openChat.status === 'open' && styles.chatActionTextActive]}>Ta over</ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={sending}
                    onPress={() => handleStatusChange('ai-active')}
                    style={({ pressed }) => [styles.chatActionButton, openChat.status === 'ai-active' && styles.chatActionButtonActive, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor="#ffffff" />
                    <ThemedText style={[styles.chatActionText, openChat.status === 'ai-active' && styles.chatActionTextActive]}>AI</ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={sending}
                    onPress={handleCloseChat}
                    style={({ pressed }) => [styles.chatActionButton, styles.chatActionButtonClose, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={16} tintColor="#ef4444" />
                    <ThemedText style={styles.chatActionTextClose}>Lukk</ThemedText>
                  </Pressable>
                </View>

                <ScrollView 
                  ref={messageListRef}
                  style={styles.messageList} 
                  contentContainerStyle={[styles.messageListContent, { paddingBottom: 16 }]}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: false })}>
                  {chatLoading ? (
                    <ActivityIndicator color="#03a84e" />
                  ) : (
                    openChat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
                  )}
                </ScrollView>

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
          </Animated.View>
        )}
      </View>
    </Animated.View>
    </>
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
  const avatarBg = needsAnswer ? '#ef4444' : avatarColor(chat.visitorName || 'K');

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
          { backgroundColor: avatarBg },
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
        <ThemedText numberOfLines={1} style={styles.conversationPreview}>
          {lastMessage?.text || chat.preview || 'Ingen melding ennå'}
        </ThemedText>
        <View style={styles.conversationMiddle}>
          <SymbolView name={{ ios: 'globe', android: 'language', web: 'language' }} size={10} tintColor="#64748b" />
          <ThemedText numberOfLines={1} style={styles.conversationSource}>
            {chat.pageTitle || chat.countryCode || 'vintranordic.com'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.conversationRight}>
        <View style={[styles.statusBadge, needsAnswer && styles.statusBadgeUrgent]}>
          <ThemedText style={[styles.statusText, needsAnswer && styles.statusTextUrgent]}>{label}</ThemedText>
        </View>
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
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    AsyncStorage.getItem('@vintra_creds').then((raw) => {
      if (!raw) return;
      const { email, password } = JSON.parse(raw) as { email: string; password: string };
      if (!firebaseAuth.currentUser) {
        signInWithEmailAndPassword(firebaseAuth, email, password).catch(() =>
          AsyncStorage.removeItem('@vintra_creds'),
        );
      }
    }).catch(() => {});
    return unsubAuth;
  }, []);

  const [selectedChatIdForModal, setSelectedChatIdForModal] = useState<string | null>(null);

  const contentPadding = useMemo(
    () => ({ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.five }),
    [insets.bottom, insets.top],
  );

  return (
    <ThemedView style={styles.container}>
      <AnimatedBackdrop />
      {/* Normal admin list view - only when logged in and chat is not open on mobile */}
      {authReady && user && !(compact && chatOpen) && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, compact && styles.contentCompact, contentPadding]}>
            <AdminScreen
              user={user}
              compact={compact}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              onChatSelect={setSelectedChatIdForModal}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Auth / loading modal — covers native tab bar */}
      <Modal
        visible={!authReady || (authReady && !user)}
        animationType="none"
        presentationStyle="fullScreen"
        statusBarTranslucent>
        <ThemedView style={styles.container}>
          <AnimatedBackdrop />
          {!authReady ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#ffffff" size="large" />
              <ThemedText style={styles.loadingText}>Klargjor Firebase...</ThemedText>
            </View>
          ) : (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, compact && styles.contentCompact, contentPadding]}>
                <AuthScreen compact={compact} />
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </ThemedView>
      </Modal>

      {/* Chat full-screen modal — covers native tab bar */}
      <Modal
        visible={compact && chatOpen && !!user}
        animationType="none"
        presentationStyle="fullScreen"
        statusBarTranslucent>
        <ThemedView style={styles.container}>
          <AnimatedBackdrop />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
            {user && (
              <AdminScreen
                user={user}
                compact={compact}
                chatOpen={chatOpen}
                setChatOpen={setChatOpen}
                initialSelectedChatId={selectedChatIdForModal}
              />
            )}
          </KeyboardAvoidingView>
        </ThemedView>
      </Modal>
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
  contentChatOpen: {
    paddingHorizontal: 0,
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
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
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
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1,
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
    padding: Spacing.three,
  },
  dashboardCompactOpen: {
    padding: 0,
    gap: 0,
  },
  dashboardHeader: {
    minHeight: 66,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  logoutText: {
    color: '#ffffff',
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
    color: '#9fb1ce',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  inboxHeader: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  inboxHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  inboxKicker: {
    color: '#03a84e',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  inboxTitle: {
    color: '#ffffff',
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
    color: '#9fb1ce',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
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
    color: '#03a84e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  inboxMetrics: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  inboxMetric: {
    minHeight: 72,
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 4,
  },
  inboxMetricActive: {
    backgroundColor: 'rgba(3,168,78,0.15)',
    borderColor: 'rgba(3,168,78,0.30)',
  },
  inboxMetricValue: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  inboxMetricValueActive: {
    color: '#03a84e',
  },
  inboxMetricLabel: {
    color: '#9fb1ce',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  inboxMetricLabelActive: {
    color: '#03a84e',
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
    gap: 0,
  },
  conversationListPanel: {
    flex: 0.8,
    minWidth: 300,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  conversationListPanelFull: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  inboxTabs: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    borderBottomColor: '#03a84e',
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
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  inboxTabText: {
    color: '#64748b',
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
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  conversationRowUrgent: {
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  conversationRowActive: {
    backgroundColor: 'rgba(3,168,78,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#03a84e',
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#64748b',
  },
  conversationAvatarUrgent: {
    backgroundColor: '#ef4444',
  },
  conversationAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  conversationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  conversationTime: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  conversationPreview: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  conversationMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  conversationSource: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  conversationRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  conversationStatusLabel: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  conversationStatusLabelUrgent: {
    color: '#ef4444',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  statusBadgeUrgent: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  statusTextUrgent: {
    color: '#dc2626',
  },
  conversationSection: {
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  conversationSectionText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase' as const,
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
    minWidth: 400,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  chatPanelFull: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
    backgroundColor: '#06111f',
    flexDirection: 'column',
    minHeight: '100%',
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a1628',
  },
  chatActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0a1628',
  },
  messageList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messageListContent: {
    padding: 16,
    flexGrow: 1,
    gap: 10,
  },
  chatActionButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatActionButtonActive: {
    backgroundColor: '#03a84e',
    borderColor: '#03a84e',
  },
  chatActionButtonClose: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  chatActionTextClose: {
    color: '#ef4444',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  chatActionText: {
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  chatMeta: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  chatStatusPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chatStatusWaiting: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  chatStatusText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
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
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  messageBubbleAdmin: {
    backgroundColor: '#03a84e',
  },
  messageBubbleSystem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'center',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  messageTextAdmin: {
    color: '#ffffff',
  },
  messageTextSystem: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  messageTime: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  messageTimeAdmin: {
    color: 'rgba(255,255,255,0.80)',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0d1a2d',
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sendReplyButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03a84e',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginRight: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  adminBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  adminTopBand: {
    position: 'absolute',
    top: -50,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(3,168,78,0.12)',
  },
  adminBottomBand: {
    position: 'absolute',
    right: -150,
    bottom: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(36,108,255,0.10)',
  },
});
