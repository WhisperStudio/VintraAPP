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
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
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
import { useTranslation } from '@/lib/i18n';

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

export function AuthScreen({ compact }: { compact: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Fill in email and password to continue.');
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert('Missing name', 'Please enter your name before creating an account.');
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
      const message = error instanceof Error ? error.message : 'Could not sign in at this moment.';
      Alert.alert(isRegister ? 'Registration failed' : 'Sign in failed', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.authLayout, compact && styles.authLayoutCompact]}>
      <View style={styles.authIntro}>
        <View style={styles.brand}>
          <VintraMark light />
          <View>
            <ThemedText style={styles.brandName}>VINTRA</ThemedText>
            <ThemedText style={styles.brandSubline}>Nordic digital studio</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.authTitle, compact && styles.authTitleCompact]}>Sign In</ThemedText>
        <ThemedText style={styles.authLead}>
          Respond to inquiries from your Vintra widget. Log in to view messages and assist visitors in real-time.
        </ThemedText>
        <View style={styles.featureGrid}>
          {['Live chat', 'Support', 'Vintra'].map((item) => (
            <View key={item} style={styles.featurePill}>
              <ThemedText style={styles.featureText}>{item}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.authCard}>
        <View style={styles.segment}>
          <Pressable onPress={() => setMode('login')} style={[styles.segmentButton, !isRegister && styles.segmentActive]}>
            <ThemedText style={[styles.segmentText, !isRegister && styles.segmentTextActive]}>Sign In</ThemedText>
          </Pressable>
          <Pressable onPress={() => setMode('register')} style={[styles.segmentButton, isRegister && styles.segmentActive]}>
            <ThemedText style={[styles.segmentText, isRegister && styles.segmentTextActive]}>Register</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.formTitle}>{isRegister ? 'Create Account' : 'Sign In'}</ThemedText>
        <ThemedText style={styles.formLead}>
          {isRegister ? 'Create an account to respond to inquiries.' : 'Enter your email and password to continue.'}
        </ThemedText>

        <View style={styles.form}>
          {isRegister && (
            <AuthField
              icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              autoComplete="name"
              placeholder="Full name"
              returnKeyType="next"
              value={name}
              onChangeText={setName}
            />
          )}
          <AuthField
            icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
            autoComplete="email"
            placeholder="Email"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />
          <AuthField
            icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            autoComplete="password"
            placeholder="Password"
            returnKeyType="done"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.submitButton, busy && styles.submitButtonBusy, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
              <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={19} tintColor="#ffffff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function AdminBackground() {
  const move = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    move.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.cubic) }), -1, true);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [move, pulse]);

  const aurora1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: -150 + move.value * 200 },
      { translateY: -50 + move.value * 80 },
      { rotateZ: '-12deg' },
      { scale: pulse.value },
    ],
    opacity: 0.4 + move.value * 0.2,
  }));

  const aurora2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: 100 - move.value * 180 },
      { translateY: 100 - move.value * 120 },
      { rotateZ: '18deg' },
      { scale: 1.1 - move.value * 0.1 },
    ],
    opacity: 0.3 + (1 - move.value) * 0.15,
  }));

  const aurora3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: -80 + move.value * 120 },
      { translateY: 200 - move.value * 150 },
      { rotateZ: '8deg' },
      { scale: 0.9 + move.value * 0.2 },
    ],
  }));

  return (
    <View pointerEvents="none" style={styles.adminBackground}>
      <View style={styles.auroraBase} />
      <Animated.View style={[styles.auroraTeal, aurora1]} />
      <Animated.View style={[styles.auroraPurple, aurora2]} />
      <Animated.View style={[styles.auroraBlue, aurora3]} />
      <View style={styles.meshGradientOverlay} />
    </View>
  );
}

function AdminScreen({ user, compact, chatOpen, setChatOpen, initialSelectedChatId, onChatSelect }: { user: User; compact: boolean; chatOpen: boolean; setChatOpen: (v: boolean) => void; initialSelectedChatId?: string | null; onChatSelect?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const { t: adminT } = useTranslation();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialSelectedChatId ?? null);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<ScrollView>(null);

  const displayName = adminProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Agent';
  const visibleChats = chats.filter((chat) => chat.status !== 'closed');
  
  // Dynamic filtering based on search query
  const filteredVisibleChats = visibleChats.filter((chat) => {
    const visitorName = chat.visitorName || 'Visitor';
    const lastMsg = chat.messages.at(-1)?.text || chat.preview || '';
    return visitorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeChats = visibleChats.filter((chat) => chat.status !== 'ai-active').length;
  const waitingChats = visibleChats.filter((chat) => chat.status === 'needs-human').length;
  const unansweredChats = filteredVisibleChats.filter((chat) => chat.status === 'needs-human');
  const servedChats = filteredVisibleChats.filter((chat) => chat.status !== 'needs-human');
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
          setAccessError('This account does not have access to live inquiries yet.');
        }
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setAccessError(error instanceof Error ? error.message : 'Could not check account access.');
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
      setAccessError(error instanceof Error ? error.message : 'Could not send reply.');
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
      setAccessError(error instanceof Error ? error.message : 'Could not update status.');
    } finally {
      setSending(false);
    }
  }

  function handleCloseChat() {
    if (!adminProfile || !openChat) return;
    Alert.alert(
      'Close Conversation',
      `Close the conversation with ${openChat.visitorName || 'visitor'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              await closeSupportChat(adminProfile.businessId, openChat);
              if (compact) setChatOpen(false);
              else setSelectedChatId(null);
            } catch (error) {
              setAccessError(error instanceof Error ? error.message : 'Could not close conversation.');
            }
          },
        },
      ],
    );
  }

  if (!adminReady) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color="#03a84e" size="large" />
        <ThemedText style={styles.loadingText}>Checking access...</ThemedText>
      </View>
    );
  }

  if (!adminProfile) {
    return (
      <View style={styles.noAccessCard}>
        <View style={styles.noAccessIcon}>
          <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={24} tintColor="#ffffff" />
        </View>
        <ThemedText style={styles.noAccessTitle}>Access Denied</ThemedText>
        <ThemedText style={styles.noAccessText}>{accessError || 'You do not have permission to view messages yet.'}</ThemedText>
        <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.noAccessButton, pressed && styles.pressed]}>
          <ThemedText style={styles.noAccessButtonText}>Sign Out</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <AdminBackground />
      <View style={[styles.dashboard, compact && chatOpen && styles.dashboardCompactOpen]}>

        {/* ── TOP BAR ─────────────────────────────────────── */}
        {!(compact && chatOpen) && (
          <>
            <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
              <View style={styles.topBarBrand}>
                <View style={styles.topBarLogo}>
                  <Text style={styles.topBarLogoV}>V</Text>
                </View>
                <View>
                  <Text style={styles.topBarName}>Vintra<Text style={styles.topBarNameAccent}>Nordic</Text></Text>
                  <View style={styles.topBarLive}>
                    <View style={styles.topBarLiveDot} />
                    <Text style={styles.topBarLiveText}>LIVE CONSOLE</Text>
                  </View>
                </View>
              </View>

              <View style={styles.topBarMetrics}>
                {waitingChats > 0 && (
                  <View style={styles.topBarMetricUrgent}>
                    <Text style={styles.topBarMetricUrgentNum}>{waitingChats}</Text>
                    <Text style={styles.topBarMetricUrgentLabel}>NEW</Text>
                  </View>
                )}
                <View style={styles.topBarMetricBlue}>
                  <Text style={styles.topBarMetricBlueNum}>{activeChats}</Text>
                  <Text style={styles.topBarMetricBlueLabel}>OPEN</Text>
                </View>
                <View style={styles.topBarMetricGray}>
                  <Text style={styles.topBarMetricGrayNum}>{chats.length}</Text>
                  <Text style={styles.topBarMetricGrayLabel}>TOTAL</Text>
                </View>
              </View>

              <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.topBarLogoutBtn, pressed && styles.pressed]}>
                <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={16} tintColor="#475569" />
              </Pressable>
            </View>
            {accessError ? <ThemedText style={styles.inlineError}>{accessError}</ThemedText> : null}
          </>
        )}

        {/* ── MAIN LAYOUT ─────────────────────────────────── */}
        <View style={[styles.mainLayout, compact && styles.mainLayoutCompact]}>

          {/* LEFT: Conversation list */}
          {(!compact || !chatOpen) && (
            <View style={[styles.sidePanel, compact && styles.sidePanelFull]}>

              {/* Search */}
              <View style={styles.sideSearch}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={14} tintColor="#334155" />
                <TextInput
                  placeholder="…"
                  placeholderTextColor="#334155"
                  style={styles.sideSearchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} size={14} tintColor="#334155" />
                  </Pressable>
                ) : null}
              </View>

              {/* Stats row */}
              <View style={styles.sideStats}>
                <View style={[styles.sideStatCard, waitingChats > 0 && styles.sideStatCardUrgent]}>
                  <Text style={[styles.sideStatNum, waitingChats > 0 && { color: '#f87171' }]}>{waitingChats}</Text>
                  <Text style={styles.sideStatLabel}>{adminT('admin_waiting')}</Text>
                </View>
                <View style={[styles.sideStatCard, { borderColor: 'rgba(15,110,255,0.2)' }]}>
                  <Text style={[styles.sideStatNum, { color: '#0f6eff' }]}>{activeChats}</Text>
                  <Text style={styles.sideStatLabel}>{adminT('admin_active')}</Text>
                </View>
                <View style={styles.sideStatCard}>
                  <Text style={styles.sideStatNum}>{chats.length}</Text>
                  <Text style={styles.sideStatLabel}>{adminT('admin_all')}</Text>
                </View>
              </View>

              {/* Chat list */}
              {chatsLoading ? (
                <View style={styles.sideLoading}>
                  <ActivityIndicator color="#0f6eff" />
                </View>
              ) : !filteredVisibleChats.length ? (
                <View style={styles.sideEmpty}>
                  <View style={styles.sideEmptyIcon}>
                    <SymbolView name={{ ios: 'tray', android: 'inbox', web: 'inbox' }} size={28} tintColor="#1e293b" />
                  </View>
                  <Text style={styles.sideEmptyTitle}>{adminT('admin_no_conversations')}</Text>
                  <Text style={styles.sideEmptyText}>{adminT('admin_no_conversations_sub')}</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.sideList}>
                  {unansweredChats.length > 0 && (
                    <View style={styles.sideSection}>
                      <View style={styles.sideSectionDot} />
                      <Text style={styles.sideSectionText}>NEEDS REPLY</Text>
                      <View style={styles.sideSectionBadge}>
                        <Text style={styles.sideSectionBadgeText}>{unansweredChats.length}</Text>
                      </View>
                    </View>
                  )}
                  {unansweredChats.map((chat) => (
                    <ConversationRow key={chat.id} chat={chat} active={chat.id === selectedChatId} onPress={() => handleSelectChat(chat.id)} />
                  ))}
                  {servedChats.length > 0 && (
                    <View style={styles.sideSection}>
                      <View style={[styles.sideSectionDot, { backgroundColor: '#3d5a80' }]} />
                      <Text style={styles.sideSectionText}>ACTIVE</Text>
                    </View>
                  )}
                  {servedChats.map((chat) => (
                    <ConversationRow key={chat.id} chat={chat} active={chat.id === selectedChatId} onPress={() => handleSelectChat(chat.id)} />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* RIGHT: Chat area */}
          {(!compact || chatOpen) && (
            <View style={[styles.chatArea, compact && styles.chatAreaFull]}>
              {openChat ? (
                <>
                  {/* Chat top bar */}
                  <View style={[styles.chatTopBar, compact && { paddingTop: insets.top + 8 }]}>
                    {compact && (
                      <Pressable onPress={handleBackToList} style={({ pressed }) => [styles.chatBackBtn, pressed && styles.pressed]}>
                        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#94a3b8" />
                      </Pressable>
                    )}
                    <View style={[styles.chatTopAvatar, { backgroundColor: avatarColor(openChat.visitorName || 'V') }]}>
                      <Text style={styles.chatTopAvatarText}>{(openChat.visitorName || 'V').slice(0, 1).toUpperCase()}</Text>
                      <View style={[styles.chatTopOnlineDot, openChat.status === 'needs-human' && { backgroundColor: '#ef4444' }]} />
                    </View>
                    <View style={styles.chatTopInfo}>
                      <Text style={styles.chatTopName}>{openChat.visitorName || 'Visitor'}</Text>
                      <Text style={styles.chatTopMeta} numberOfLines={1}>
                        {openChat.pageTitle || openChat.pageUrl || 'Website visitor'}
                      </Text>
                    </View>
                    <StatusPill status={openChat.status} />
                  </View>

                  {/* Action toolbar */}
                  <View style={styles.chatToolbar}>
                    <Pressable
                      disabled={sending}
                      onPress={() => handleStatusChange('open')}
                      style={({ pressed }) => [styles.toolBtn, openChat.status === 'open' && styles.toolBtnBlue, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }} size={13} tintColor={openChat.status === 'open' ? '#0f6eff' : '#475569'} />
                      <Text style={[styles.toolBtnText, openChat.status === 'open' && styles.toolBtnTextBlue]}>
                        {compact ? 'Take' : 'Assign to me'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={sending}
                      onPress={() => handleStatusChange('ai-active')}
                      style={({ pressed }) => [styles.toolBtn, openChat.status === 'ai-active' && styles.toolBtnPurple, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={13} tintColor={openChat.status === 'ai-active' ? '#a78bfa' : '#475569'} />
                      <Text style={[styles.toolBtnText, openChat.status === 'ai-active' && styles.toolBtnTextPurple]}>
                        {compact ? 'AI' : 'AI Mode'}
                      </Text>
                    </Pressable>
                    <View style={styles.toolBtnSpacer} />
                    <Pressable
                      disabled={sending}
                      onPress={handleCloseChat}
                      style={({ pressed }) => [styles.toolBtnResolve, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={13} tintColor="#22c55e" />
                      <Text style={styles.toolBtnResolveText}>Resolve</Text>
                    </Pressable>
                  </View>

                  {/* Messages */}
                  <ScrollView
                    ref={messageListRef}
                    style={styles.msgScroll}
                    contentContainerStyle={styles.msgScrollContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: false })}>
                    {chatLoading ? (
                      <View style={styles.msgLoading}>
                        <ActivityIndicator color="#0f6eff" />
                      </View>
                    ) : (
                      openChat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
                    )}
                  </ScrollView>

                  {/* Quick replies */}
                  <View style={styles.quickBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickBarScroll}>
                      {[
                        { label: '👋 Hello', value: 'Hello! How can I help you today?' },
                        { label: '🔍 Looking', value: 'Let me look into that for you. One moment, please.' },
                        { label: '✅ Resolved', value: 'I have resolved this. Let me know if there is anything else!' },
                        { label: '📧 Email?', value: 'Could you provide your email so I can follow up?' },
                        { label: '🙏 Thanks', value: 'Thank you for reaching out! Have an amazing day.' },
                      ].map((item, i) => (
                        <Pressable
                          key={i}
                          onPress={() => setReply(item.value)}
                          style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}>
                          <Text style={styles.quickChipText}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Input */}
                  <View style={styles.msgInputBar}>
                    <TextInput
                      multiline
                      placeholder="Write a reply..."
                      placeholderTextColor="#283447"
                      style={styles.msgInput}
                      value={reply}
                      onChangeText={setReply}
                      onSubmitEditing={handleSendReply}
                    />
                    <Pressable
                      disabled={sending || !reply.trim()}
                      onPress={handleSendReply}
                      style={({ pressed }) => [styles.msgSendBtn, (sending || !reply.trim()) && styles.msgSendBtnDisabled, pressed && styles.pressed]}>
                      {sending
                        ? <ActivityIndicator color="#ffffff" size="small" />
                        : <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={17} tintColor="#ffffff" />}
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.chatPlaceholder}>
                  <View style={styles.chatPlaceholderIcon}>
                    <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={30} tintColor="#0f6eff" />
                  </View>
                  <Text style={styles.chatPlaceholderTitle}>Select a conversation</Text>
                  <Text style={styles.chatPlaceholderText}>Pick a chat from the left panel to start responding to your visitors.</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

function InboxMetric({ label, value, active }: { label: string; value: string; active?: boolean }) {
  // Electric neon colors for different metrics
  const neonColor = 
    label === 'Waiting' ? '#ef4444' : 
    label === 'Active' ? '#3b82f6' : '#00c7db';

  return (
    <View style={[
      styles.inboxMetric, 
      active && styles.inboxMetricActive,
      { borderColor: active ? neonColor + '80' : 'rgba(255,255,255,0.08)' }
    ]}>
      {/* Soft inner glow overlay */}
      <View style={[styles.metricGlow, { backgroundColor: neonColor }]} />
      <Text style={[styles.inboxMetricValue, { color: active ? neonColor : '#ffffff' }]}>{value}</Text>
      <Text style={styles.inboxMetricLabel}>{label}</Text>
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
  const { t } = useTranslation();
  const label = status === 'needs-human' ? t('status_waiting') : status === 'open' ? t('status_active') : status === 'ai-active' ? t('status_ai') : status;

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
  const isAI = chat.status === 'ai-active';
  const accentColor = needsAnswer ? '#ef4444' : isAI ? '#8b5cf6' : '#0f6eff';
  const bg = avatarColor(chat.visitorName || 'V');
  const label = needsAnswer ? 'New' : isAI ? 'AI' : 'Open';

  return (
    <Animated.View entering={FadeInDown.duration(280)} layout={LinearTransition.springify().damping(18)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.chatRow, active && styles.chatRowActive, needsAnswer && styles.chatRowUrgent, pressed && styles.pressed]}>
        <View style={[styles.chatRowAccentBar, { backgroundColor: active || needsAnswer ? accentColor : 'transparent' }]} />
        <View style={[styles.chatRowAvatar, { backgroundColor: bg }]}>
          <Text style={styles.chatRowAvatarText}>{(chat.visitorName || 'V').slice(0, 1).toUpperCase()}</Text>
          <View style={[styles.chatRowStatusDot, { backgroundColor: accentColor }]} />
        </View>
        <View style={styles.chatRowBody}>
          <View style={styles.chatRowTop}>
            <Text style={[styles.chatRowName, active && styles.chatRowNameActive]} numberOfLines={1}>
              {chat.visitorName || 'Visitor'}
            </Text>
            <Text style={styles.chatRowTime}>{formatTime(chat.updatedAt)}</Text>
          </View>
          <Text style={styles.chatRowPreview} numberOfLines={1}>
            {lastMessage?.text || chat.preview || 'No messages yet'}
          </Text>
          <Text style={styles.chatRowSource} numberOfLines={1}>
            {chat.pageTitle || chat.countryCode || 'vintranordic.com'}
          </Text>
        </View>
        <View style={[styles.chatRowBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '45' }]}>
          <Text style={[styles.chatRowBadgeText, { color: accentColor }]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromAdmin = message.role === 'support';
  const fromSystem = message.role === 'system';

  if (fromSystem) {
    return (
      <View style={styles.sysMsgRow}>
        <Text style={styles.sysMsgText}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, fromAdmin && styles.bubbleRowAdmin]}>
      {!fromAdmin && (
        <View style={styles.bubbleVisitorAvatar}>
          <Text style={styles.bubbleVisitorAvatarText}>V</Text>
        </View>
      )}
      <View style={[styles.bubble, fromAdmin && styles.bubbleAdmin]}>
        <Text style={[styles.bubbleText, fromAdmin && styles.bubbleTextAdmin]}>{message.text}</Text>
        <Text style={[styles.bubbleTime, fromAdmin && styles.bubbleTimeAdmin]}>{formatTime(message.createdAt)}</Text>
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
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const [selectedChatIdForModal, setSelectedChatIdForModal] = useState<string | null>(null);

  const contentPadding = useMemo(
    () => ({ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.five }),
    [insets.bottom, insets.top],
  );

  if (!user) return null;

  return (
    <ThemedView style={styles.container}>
      <AnimatedBackdrop />
      {/* Normal admin list view - chat not open on mobile */}
      {!(compact && chatOpen) && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
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

      {/* Chat full-screen overlay */}
      {compact && chatOpen && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent={true}
          onRequestClose={() => setChatOpen(false)}>
          <ThemedView style={styles.container}>
            <AnimatedBackdrop />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
              <AdminScreen
                user={user}
                compact={compact}
                chatOpen={chatOpen}
                setChatOpen={setChatOpen}
                initialSelectedChatId={selectedChatIdForModal}
              />
            </KeyboardAvoidingView>
          </ThemedView>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141e2e',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blueBand: {
    position: 'absolute',
    right: -210,
    bottom: 70,
    width: 680,
    height: 240,
    borderRadius: 54,
    backgroundColor: 'rgba(15,110,255,0.12)',
  },
  scanBeam: {
    position: 'absolute',
    top: -80,
    left: '50%',
    width: 130,
    height: 900,
    backgroundColor: 'rgba(15,110,255,0.03)',
  },
  noiseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.005)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
  },
  contentCompact: {
    paddingHorizontal: 0,
  },
  contentChatOpen: {
    paddingHorizontal: 0,
  },
  loadingState: {
    flex: 1,
    minHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#0f6eff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    transform: [{ rotateZ: '-28deg' }],
  },
  logoBladeRight: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 14,
    height: 31,
    borderRadius: 8,
    backgroundColor: '#1b204c',
    transform: [{ rotateZ: '29deg' }],
  },
  logoDot: {
    position: 'absolute',
    right: 0,
    top: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0f6eff',
  },
  logoBladeLight: {
    backgroundColor: '#ffffff',
  },
  logoBladeSoft: {
    backgroundColor: '#0f6eff',
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
    color: '#0f6eff',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f6eff',
  },
  featureText: {
    color: '#edf4ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  authCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 32,
    padding: Spacing.four,
    backgroundColor: '#110d3d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  segment: {
    height: 52,
    padding: 5,
    borderRadius: 26,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  segmentButton: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#0f6eff',
    shadowColor: '#0f6eff',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  segmentText: {
    color: '#94a3b8',
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
    color: '#ffffff',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
  },
  formLead: {
    color: '#94a3b8',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 58,
    borderRadius: 16,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0f6eff',
    shadowColor: '#0f6eff',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitButtonBusy: {
    opacity: 0.6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  dashboard: {
    flex: 1,
    gap: 0,
    padding: 0,
  },
  dashboardCompactOpen: {
    padding: 0,
    gap: 0,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(15,110,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  miniLogoBlade: {
    width: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#0f6eff',
    transform: [{ rotateZ: '-28deg' }],
  },
  miniLogoDot: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0f6eff',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  brandTitleAccent: {
    color: '#0f6eff',
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0f6eff',
  },
  statusSub: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  capsuleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capsuleVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  capsuleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  capsuleDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  headerLogout: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#1b204c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: '#0f6eff',
  },
  livePillText: {
    color: '#142033',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  adminTitle: {
    color: '#ffffff',
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
  agentStatsMiniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  agentStatMiniCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentStatMiniText: {
    color: '#edf4ff',
    fontSize: 11,
    fontWeight: '800',
  },
  searchBarContainer: {
    height: 52,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchBarInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    height: '100%',
    letterSpacing: 0.3,
  },
  inboxHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  inboxKicker: {
    color: '#0f6eff',
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
    backgroundColor: '#1b204c',
    borderWidth: 1,
    borderColor: '#0f6eff',
  },
  inboxPresenceText: {
    color: '#0f6eff',
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
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  metricGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  inboxMetricActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  inboxMetricValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  inboxMetricValueActive: {
    color: '#0f6eff',
  },
  inboxMetricLabel: {
    color: '#9fb1ce',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    opacity: 0.85,
  },
  inboxMetricLabelActive: {
    color: '#0f6eff',
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
    color: '#0f6eff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  widgetInput: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#0f6eff',
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
    color: '#0f6eff',
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
    padding: Spacing.five,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  noAccessIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: Spacing.four,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  noAccessTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  noAccessText: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.three,
    maxWidth: 320,
  },
  noAccessButton: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.3)',
    marginTop: Spacing.five,
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  noAccessButtonText: {
    color: '#0f6eff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  inlineError: {
    color: '#fecaca',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginHorizontal: 12,
  },
  supportLayout: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  supportLayoutCompact: {
    flexDirection: 'column',
    flex: 1,
    gap: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  conversationListPanel: {
    flex: 0.75,
    minWidth: 300,
    maxWidth: 420,
    borderRadius: 24,
    padding: 0,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  conversationListPanelFull: {
    flex: 1,
    maxWidth: undefined,
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  inboxTabs: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 24,
    padding: 4,
    gap: 4,
    marginVertical: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inboxTabActive: {
    flex: 1,
    height: '100%',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.35)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  inboxTab: {
    flex: 1,
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  inboxTabTextActive: {
    color: '#0f6eff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  inboxTabText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  tabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  conversationList: {
    paddingBottom: Spacing.two,
  },
  conversationRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  conversationRowUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  conversationRowActive: {
    backgroundColor: 'rgba(15, 110, 255, 0.08)',
    borderColor: 'rgba(15, 110, 255, 0.25)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  conversationAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.15)',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#141e2e',
  },
  conversationAvatarUrgent: {
    backgroundColor: '#ef4444',
  },
  conversationAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  conversationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationName: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    fontWeight: '500',
  },
  conversationMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  conversationSource: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  conversationRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  conversationStatusLabel: {
    color: '#64748b',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  conversationStatusLabelUrgent: {
    color: '#f87171',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeUrgent: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  statusText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusTextUrgent: {
    color: '#f87171',
  },
  conversationSection: {
    minHeight: 42,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  conversationSectionText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  conversationSectionUrgent: {
    color: '#f87171',
  },
  conversationSectionBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.25)',
  },
  conversationSectionBadgeUrgent: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  conversationSectionBadgeText: {
    color: '#0f6eff',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  conversationSectionBadgeTextUrgent: {
    color: '#f87171',
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f6eff',
  },
  chatPanel: {
    flex: 1.25,
    minWidth: 380,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  chatPanelFull: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
    backgroundColor: '#141e2e',
    flexDirection: 'column',
    minHeight: '100%',
  },
  chatHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  chatActionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(15,23,42,0.7)',
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
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatActionButtonActive: {
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderColor: 'rgba(15,110,255,0.35)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  chatActionButtonClose: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  chatActionTextClose: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  chatActionText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  chatActionTextActive: {
    color: '#0f6eff',
    fontWeight: '900',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(15,110,255,0.3)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  chatAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  chatHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  chatMeta: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  chatStatusPill: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,110,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.25)',
  },
  chatStatusWaiting: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.35)',
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
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  messageBubbleAdmin: {
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderColor: 'rgba(15,110,255,0.35)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  messageBubbleSystem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'center',
  },
  messageText: {
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  messageTextAdmin: {
    color: '#ffffff',
    fontWeight: '700',
  },
  messageTextSystem: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  messageTime: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  messageTimeAdmin: {
    color: 'rgba(255,255,255,0.85)',
  },
  templatesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  templatesScroll: {
    gap: 10,
  },
  templatePill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  templatePillText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  replyInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendReplyButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,110,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(15,110,255,0.3)',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 280,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 4,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  adminBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#141e2e',
  },
  auroraBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141e2e',
  },
  auroraTeal: {
    position: 'absolute',
    top: -120,
    left: -180,
    width: 650,
    height: 650,
    borderRadius: 325,
    backgroundColor: 'rgba(15,110,255,0.14)',
  },
  auroraPurple: {
    position: 'absolute',
    top: '15%',
    right: -220,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  auroraBlue: {
    position: 'absolute',
    bottom: -180,
    left: '5%',
    width: 550,
    height: 550,
    borderRadius: 275,
    backgroundColor: 'rgba(15,110,255,0.12)',
  },
  meshGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,46,0.15)',
  },

  /* ── TOP BAR ──────────────────────────────────────── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(20,30,46,0.88)',
    gap: 10,
  },
  topBarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  topBarLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(15,110,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLogoV: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f6eff',
    letterSpacing: -0.5,
  },
  topBarName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  topBarNameAccent: {
    color: '#0f6eff',
  },
  topBarLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  topBarLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#03a84e',
  },
  topBarLiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  topBarMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarMetricUrgent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    minWidth: 36,
  },
  topBarMetricUrgentNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f87171',
    lineHeight: 16,
  },
  topBarMetricUrgentLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#f87171',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  topBarMetricBlue: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15,110,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.22)',
    alignItems: 'center',
    minWidth: 36,
  },
  topBarMetricBlueNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f6eff',
    lineHeight: 16,
  },
  topBarMetricBlueLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0f6eff',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  topBarMetricGray: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    minWidth: 36,
  },
  topBarMetricGrayNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    lineHeight: 16,
  },
  topBarMetricGrayLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  topBarLogoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  /* ── MAIN LAYOUT ──────────────────────────────────── */
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mainLayoutCompact: {
    flexDirection: 'column',
  },

  /* ── SIDE PANEL ───────────────────────────────────── */
  sidePanel: {
    width: 300,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  sidePanelFull: {
    width: '100%',
    flexDirection: 'column',
    borderRightWidth: 0,
    flex: 1,
  },
  sideSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sideSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  sideStats: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  sideStatCard: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    gap: 1,
  },
  sideStatCardUrgent: {
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  sideStatNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
    lineHeight: 20,
  },
  sideStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sideLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sideEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  sideEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sideEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
  },
  sideEmptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4a6080',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 220,
  },
  sideList: {
    flex: 1,
  },
  sideSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  sideSectionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  sideSectionText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1.2,
    flex: 1,
  },
  sideSectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  sideSectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f87171',
  },

  /* ── CHAT ROW ─────────────────────────────────────── */
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 0,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 12,
    gap: 10,
    overflow: 'hidden',
  },
  chatRowActive: {
    backgroundColor: 'rgba(15,110,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.2)',
  },
  chatRowUrgent: {
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  chatRowAccentBar: {
    width: 3,
    height: 44,
    borderRadius: 2,
    marginLeft: 4,
  },
  chatRowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chatRowAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  chatRowStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#141e2e',
  },
  chatRowBody: {
    flex: 1,
    gap: 2,
  },
  chatRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  chatRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    flex: 1,
  },
  chatRowNameActive: {
    color: '#e2e8f0',
  },
  chatRowTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3d6090',
  },
  chatRowPreview: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 16,
  },
  chatRowSource: {
    fontSize: 10,
    fontWeight: '500',
    color: '#3d6090',
  },
  chatRowBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  chatRowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── CHAT AREA ────────────────────────────────────── */
  chatArea: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  chatAreaFull: {
    width: '100%',
  },
  chatTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(20,30,46,0.85)',
  },
  chatBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  chatTopAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chatTopAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  chatTopOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#03a84e',
    borderWidth: 2,
    borderColor: '#141e2e',
  },
  chatTopInfo: {
    flex: 1,
    gap: 1,
  },
  chatTopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e2e8f0',
    letterSpacing: 0.1,
  },
  chatTopMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },

  /* ── TOOLBAR ──────────────────────────────────────── */
  chatToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(20,30,46,0.7)',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  toolBtnBlue: {
    backgroundColor: 'rgba(15,110,255,0.12)',
    borderColor: 'rgba(15,110,255,0.3)',
  },
  toolBtnPurple: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.3)',
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toolBtnTextBlue: {
    color: '#0f6eff',
  },
  toolBtnTextPurple: {
    color: '#a78bfa',
  },
  toolBtnSpacer: {
    flex: 1,
  },
  toolBtnResolve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  toolBtnResolveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },

  /* ── MESSAGES ─────────────────────────────────────── */
  msgScroll: {
    flex: 1,
  },
  msgScrollContent: {
    padding: 14,
    gap: 8,
    paddingBottom: 20,
  },
  msgLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sysMsgRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sysMsgText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a6080',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  bubbleRowAdmin: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubbleVisitorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  bubbleVisitorAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  bubble: {
    maxWidth: 280,
    padding: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  bubbleAdmin: {
    backgroundColor: 'rgba(15,110,255,0.18)',
    borderColor: 'rgba(15,110,255,0.3)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
    lineHeight: 20,
  },
  bubbleTextAdmin: {
    color: '#e2e8f0',
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a6080',
    textAlign: 'right',
  },
  bubbleTimeAdmin: {
    color: 'rgba(147,197,253,0.5)',
  },

  /* ── QUICK REPLIES ────────────────────────────────── */
  quickBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,30,46,0.7)',
  },
  quickBarScroll: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  /* ── INPUT BAR ────────────────────────────────────── */
  msgInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(20,30,46,0.92)',
  },
  msgInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  msgSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f6eff',
    shadowColor: '#0f6eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  msgSendBtnDisabled: {
    backgroundColor: 'rgba(15,110,255,0.2)',
    shadowOpacity: 0,
    elevation: 0,
  },

  /* ── CHAT PLACEHOLDER ─────────────────────────────── */
  chatPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  chatPlaceholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(15,110,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  chatPlaceholderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#94a3b8',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  chatPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4a6080',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 240,
  },
});
