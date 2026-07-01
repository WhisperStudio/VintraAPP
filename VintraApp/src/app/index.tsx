import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
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
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { AuroraSky } from '@/components/aurora-sky';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  fetchWidgets,
  acceptPendingInvitationsForUser,
  ensureVerifiedPendingUser,
  listenSupportChat,
  closeSupportChat,
  listenSupportChats,
  resolveAllAdminProfiles,
  sendSupportReply,
  setSupportTyping,
  setSupportChatStatus,
  type AdminProfile,
  type SupportChat,
  type SupportMessage,
  type Widget,
} from '@/lib/admin-chat';
import { firebaseAuth } from '@/lib/firebase';
import { useTranslation } from '@/lib/i18n';
import { registerPushToken, sendLocalNotification } from '@/lib/notifications';
import { getDefaultQuickReplies, loadQuickReplies, loadQuickRepliesEnabled, type QuickReply } from '@/lib/quick-replies';
import { setTabsHidden } from '@/lib/tab-visibility';
import { useThemePreference } from '@/lib/theme-preference';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type AppSymbolName = NonNullable<ComponentProps<typeof SymbolView>['name']>;

function VintraMark() {
  return (
    <Image
      source={require('@/images/logo.png')}
      style={styles.logoMark}
      contentFit="contain"
    />
  );
}

function AnimatedBackdrop() {
  const drift = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.cubic) }), -1, true);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.012, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [drift, pulse]);

  const bandOne = useAnimatedStyle(() => ({
    transform: [
      { translateX: -42 + drift.value * 38 },
      { translateY: -18 + drift.value * 12 },
      { rotateZ: '-18deg' },
      { scale: pulse.value },
    ],
  }));

  const bandTwo = useAnimatedStyle(() => ({
    transform: [
      { translateX: 52 - drift.value * 34 },
      { translateY: 42 - drift.value * 14 },
      { rotateZ: '24deg' },
      { scale: 1.01 },
    ],
  }));

  const beam = useAnimatedStyle(() => ({
    opacity: 0.18 + drift.value * 0.08,
    transform: [{ translateX: -120 + drift.value * 240 }, { rotateZ: '16deg' }],
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

export function AuthAuroraBackdrop() {
  return (
    <View pointerEvents="none" style={styles.authAurora}>
      <AuroraSky />
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
  keyboardType,
  returnKeyType,
  onSubmitEditing,
}: {
  icon: AppSymbolName;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoComplete?: 'email' | 'password' | 'name';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  returnKeyType?: 'next' | 'done' | 'send';
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.inputShell}>
      <SymbolView name={icon} size={18} tintColor="#6e85ad" />
      <TextInput
        autoCapitalize="none"
        autoComplete={autoComplete}
        keyboardType={keyboardType || 'default'}
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
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert(t('auth_missing_info_title'), t('auth_missing_info_msg'));
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert(t('auth_missing_name_title'), t('auth_missing_name_msg'));
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        const credentials = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credentials.user, { displayName: name.trim() }).catch(() => {});
        await ensureVerifiedPendingUser(credentials.user).catch(() => {});
        await sendEmailVerification(credentials.user).catch(() => {});
        // New accounts are unverified: sign out so we never drop the user into a
        // broken, access-less dashboard, and never persist unverified credentials.
        await signOut(firebaseAuth).catch(() => {});
        await AsyncStorage.removeItem('@vintra_creds').catch(() => {});
        setMode('login');
        setPassword('');
        Alert.alert(t('auth_verify_title'), t('auth_verify_msg'));
      } else {
        const credentials = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await reload(credentials.user).catch(() => {});
        if (!firebaseAuth.currentUser?.emailVerified) {
          // Mirror the website: block unverified sign-ins. Resend the link and
          // sign back out so the app stays on the auth screen.
          await sendEmailVerification(credentials.user).catch(() => {});
          await signOut(firebaseAuth).catch(() => {});
          await AsyncStorage.removeItem('@vintra_creds').catch(() => {});
          Alert.alert(t('auth_verify_needed_title'), t('auth_verify_needed_msg'));
          return;
        }
        const accepted = await acceptPendingInvitationsForUser(credentials.user).catch(() => 0);
        if (accepted > 0) {
          Alert.alert(t('auth_access_activated_title'), t('auth_access_activated_msg'));
        }
        await AsyncStorage.setItem('@vintra_creds', JSON.stringify({ email: email.trim(), password }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth_generic_error');
      Alert.alert(isRegister ? t('auth_registration_failed') : t('auth_sign_in_failed'), message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.authLayout, compact && styles.authLayoutCompact]}>
      <View style={styles.authFormGroup}>
        <View style={styles.brand}>
          <VintraMark />
          <ThemedText style={styles.brandName}>VINTRA</ThemedText>
          <ThemedText style={styles.brandSubline}>{t('auth_support_console')}</ThemedText>
        </View>
        <View style={styles.authCard}>
          {isRegister && (
            <View style={styles.registerBanner}>
              <ThemedText style={styles.registerBannerTitle}>{t('auth_register_banner_title')}</ThemedText>
              <ThemedText style={styles.registerBannerMsg}>{t('auth_register_banner_msg')}</ThemedText>
            </View>
          )}
          <View style={styles.segment}>
            <Pressable onPress={() => setMode('login')} style={[styles.segmentButton, !isRegister && styles.segmentActive]}>
              <ThemedText style={[styles.segmentText, !isRegister && styles.segmentTextActive]}>{t('auth_sign_in')}</ThemedText>
            </Pressable>
            <Pressable onPress={() => setMode('register')} style={[styles.segmentButton, isRegister && styles.segmentActive]}>
              <ThemedText style={[styles.segmentText, isRegister && styles.segmentTextActive]}>{t('auth_register')}</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.formTitle}>{isRegister ? t('auth_create_account') : t('auth_sign_in')}</ThemedText>

          <View style={styles.form}>
            {isRegister && (
              <AuthField
                icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
                autoComplete="name"
                placeholder={t('auth_full_name')}
                returnKeyType="next"
                value={name}
                onChangeText={setName}
              />
            )}
            <AuthField
              icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t('auth_email')}
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
            <AuthField
              icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              autoComplete="password"
              placeholder={t('auth_password')}
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
                <Text style={styles.submitText}>{isRegister ? t('auth_create_account') : t('auth_sign_in')}</Text>
                <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={19} tintColor="#ffffff" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AdminBackground({ isLight }: { isLight?: boolean }) {
  const move = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    move.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.cubic) }), -1, true);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.018, { duration: 6200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 6200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [move, pulse]);

  const aurora1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: -76 + move.value * 44 },
      { translateY: -28 + move.value * 18 },
      { rotateZ: '-12deg' },
      { scale: pulse.value },
    ],
    opacity: 0.32 + move.value * 0.06,
  }));

  const aurora2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: 60 - move.value * 42 },
      { translateY: 62 - move.value * 28 },
      { rotateZ: '18deg' },
      { scale: 1.02 - move.value * 0.02 },
    ],
    opacity: 0.24 + (1 - move.value) * 0.06,
  }));

  const aurora3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: -44 + move.value * 28 },
      { translateY: 130 - move.value * 34 },
      { rotateZ: '8deg' },
      { scale: 0.98 + move.value * 0.03 },
    ],
  }));

  return (
    <View pointerEvents="none" style={styles.adminBackground}>
      <View style={[styles.auroraBase, isLight && styles.auroraBaseLight]} />
      <Animated.View style={[styles.auroraTeal, isLight && styles.auroraTealLight, aurora1]} />
      <Animated.View style={[styles.auroraPurple, isLight && styles.auroraPurpleLight, aurora2]} />
      <Animated.View style={[styles.auroraBlue, isLight && styles.auroraBlueLight, aurora3]} />
      <View style={[styles.meshGradientOverlay, isLight && styles.meshGradientOverlayLight]} />
    </View>
  );
}

function AdminScreen({ user, compact, chatOpen, setChatOpen, initialSelectedChatId, onChatSelect }: { user: User; compact: boolean; chatOpen: boolean; setChatOpen: (v: boolean) => void; initialSelectedChatId?: string | null; onChatSelect?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const { t: adminT, lang } = useTranslation();
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';
  const [bizPickerOpen, setBizPickerOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<AdminProfile[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialSelectedChatId ?? null);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [readLatestMessageIds, setReadLatestMessageIds] = useState<Record<string, string>>({});
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [replyInputHeight, setReplyInputHeight] = useState(0);
  const [sending, setSending] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'needs-human' | 'open' | 'ai-active'>('all');
  const [compactSearchFocused, setCompactSearchFocused] = useState(false);
  const [quickRepliesEnabled, setQuickRepliesEnabled] = useState(true);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => getDefaultQuickReplies(lang));
  const [fetchedWidgets, setFetchedWidgets] = useState<Widget[]>([]);
  const [selectedWidgetKey, setSelectedWidgetKey] = useState<string>('all');
  const messageListRef = useRef<ScrollView>(null);
  const knownLatestMessageIds = useRef<Record<string, string>>({});
  const chatNotificationsReady = useRef(false);
  const supportTypingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportTypingChatId = useRef<string | null>(null);
  const supportTypingLastSentAt = useRef(0);

  const loadQuickReplySettings = useCallback(() => {
    let mounted = true;
    Promise.all([loadQuickRepliesEnabled(), loadQuickReplies(lang)])
      .then(([enabled, replies]) => {
        if (!mounted) return;
        setQuickRepliesEnabled(enabled);
        setQuickReplies(replies);
      })
      .catch(() => {
        if (mounted) setQuickReplies(getDefaultQuickReplies(lang));
      });
    return () => {
      mounted = false;
    };
  }, [lang]);

  useEffect(loadQuickReplySettings, [loadQuickReplySettings]);
  useFocusEffect(loadQuickReplySettings);

  // Fetch named widgets from chatWidgets subcollection whenever the active business changes
  useEffect(() => {
    if (!adminProfile) { setFetchedWidgets([]); setSelectedWidgetKey('all'); return; }
    setSelectedWidgetKey('all');
    fetchWidgets(adminProfile.businessId).then(async (ws: Widget[]) => {
      setFetchedWidgets(ws);
      // Apply the saved default widget key if it matches one of the fetched widgets
      if (ws.length > 1) {
        const saved = await AsyncStorage.getItem('@vintra_default_widget').catch(() => null);
        if (saved && ws.some(w => w.key === saved)) {
          setSelectedWidgetKey(saved);
        }
      }
    });
  }, [adminProfile?.businessId]);

  const displayName = adminProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Agent';
  const visibleChats = chats.filter((chat) => chat.status !== 'closed');

  // Full widget list: start from Firestore, append any widgetKeys seen in chats that aren't listed there
  const uniqueWidgets: Widget[] = useMemo(() => {
    const result: Widget[] = [...fetchedWidgets];
    const knownKeys = new Set(fetchedWidgets.map(w => w.key));
    for (const chat of visibleChats) {
      if (chat.widgetKey && !knownKeys.has(chat.widgetKey)) {
        knownKeys.add(chat.widgetKey);
        result.push({ key: chat.widgetKey, name: chat.widgetKey });
      }
    }
    return result;
  }, [fetchedWidgets, visibleChats]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      AsyncStorage.getItem('@vintra_default_widget')
        .then((saved) => {
          if (!mounted) return;
          const nextWidgetKey = saved && uniqueWidgets.some((widget) => widget.key === saved) ? saved : 'all';
          setSelectedWidgetKey((current) => {
            if (current !== nextWidgetKey) {
              setSelectedChatId(null);
              setSelectedChat(null);
            }
            return nextWidgetKey;
          });
        })
        .catch(() => {
          if (!mounted) return;
          setSelectedWidgetKey((current) => {
            if (current !== 'all') {
              setSelectedChatId(null);
              setSelectedChat(null);
            }
            return 'all';
          });
        });

      return () => {
        mounted = false;
      };
    }, [uniqueWidgets]),
  );

  // Filter chats by selected widget, then by search query
  const widgetChats = selectedWidgetKey === 'all'
    ? visibleChats
    : visibleChats.filter(c => c.widgetKey === selectedWidgetKey);

  const filteredVisibleChats = widgetChats.filter((chat) => {
    const visitorName = chat.visitorName || 'Visitor';
    const lastMsg = chat.messages.at(-1)?.text || chat.preview || '';
    return visitorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const statusFilteredChats = filteredVisibleChats.filter((chat) => {
    if (inboxFilter === 'all') return true;
    return chat.status === inboxFilter;
  });

  const activeChats = widgetChats.filter((chat) => chat.status !== 'ai-active').length;
  const waitingChats = widgetChats.filter((chat) => chat.status === 'needs-human').length;
  const unreadWaitingChats = widgetChats.filter((chat) => {
    const latestMessageId = chat.messages.at(-1)?.id || '';
    return chat.status === 'needs-human' && latestMessageId && readLatestMessageIds[chat.id] !== latestMessageId;
  }).length;
  const unansweredChats = statusFilteredChats.filter((chat) => chat.status === 'needs-human');
  const servedChats = statusFilteredChats.filter((chat) => chat.status !== 'needs-human');
  const selectedChatFromList = widgetChats.find((chat) => chat.id === selectedChatId);
  const activeChat = selectedChat || selectedChatFromList || null;
  const openChat = activeChat || widgetChats[0] || null;
  const hasJoinedOpenChat = openChat?.status === 'open';
  const replyExpanded = replyFocused || reply.trim().length > 0;
  const replyHeight = replyExpanded
    ? Math.min(Math.max(replyInputHeight || (compact ? 54 : 46), compact ? 54 : 46), compact ? 136 : 132)
    : compact ? 44 : 40;
  const visitorIsTyping = Boolean(
    openChat?.visitorTypingAt &&
    (openChat.status === 'needs-human' || openChat.status === 'open') &&
    Date.now() - new Date(openChat.visitorTypingAt).getTime() < 4500,
  );

  useEffect(() => {
    if (initialSelectedChatId) {
      setSelectedChatId(initialSelectedChatId);
    }
  }, [initialSelectedChatId]);

  useEffect(() => {
    if (chatOpen && !selectedChatId && widgetChats.length > 0) {
      setSelectedChatId(widgetChats[0].id);
    }
  }, [chatOpen, selectedChatId, widgetChats]);

  useEffect(() => {
    if (openChat && messageListRef.current) {
      setTimeout(() => messageListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [openChat?.id, openChat?.messages.length]);

  useEffect(() => {
    if (!openChat || (compact && !chatOpen)) return;
    const latestMessageId = openChat.messages.at(-1)?.id;
    if (!latestMessageId) return;
    setReadLatestMessageIds((current) => (
      current[openChat.id] === latestMessageId ? current : { ...current, [openChat.id]: latestMessageId }
    ));
  }, [chatOpen, compact, openChat]);

  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(eventName, () => {
      setTimeout(() => messageListRef.current?.scrollToEnd({ animated: true }), 120);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!replyExpanded) return;
    const timer = setTimeout(() => messageListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [replyExpanded, replyHeight]);

  useEffect(() => {
    return () => {
      if (supportTypingStopTimer.current) {
        clearTimeout(supportTypingStopTimer.current);
      }
      if (adminProfile?.businessId && supportTypingChatId.current) {
        setSupportTyping(adminProfile.businessId, supportTypingChatId.current, false).catch(() => {});
      }
    };
  }, [adminProfile?.businessId]);

  function handleSelectChat(chatId: string) {
    setSelectedChatId(chatId);
    const nextChat = widgetChats.find((chat) => chat.id === chatId);
    if (nextChat) {
      setSelectedChat(nextChat);
      setChatLoading(false);
      const latestMessageId = nextChat.messages.at(-1)?.id;
      if (latestMessageId) {
        setReadLatestMessageIds((current) => ({ ...current, [nextChat.id]: latestMessageId }));
      }
    }
    if (compact) {
      onChatSelect?.(chatId);
      setChatOpen(true);
    }
  }

  function handleBackToList() {
    setChatOpen(false);
  }

  function handleMobileSearchPress() {
    setCompactSearchFocused((current) => {
      const next = !current;
      if (!next) setSearchQuery('');
      return next;
    });
  }

  function showMobileChatMenu() {
    if (!openChat) return;

    Alert.alert(openChat.visitorName || adminT('admin_visitor'), undefined, [
      { text: openChat.status === 'open' ? adminT('admin_you_have_joined') : adminT('admin_join_take_over'), onPress: () => handleStatusChange('open') },
      { text: adminT('admin_give_to_ai'), onPress: () => handleStatusChange('ai-active') },
      { text: adminT('admin_resolve'), style: 'destructive', onPress: handleCloseChat },
      { text: adminT('settings_cancel'), style: 'cancel' },
    ]);
  }

  useEffect(() => {
    let mounted = true;

    setAdminReady(false);
    setAccessError('');
    setAdminProfile(null);

    reload(user)
      .catch(() => {})
      .then(() => acceptPendingInvitationsForUser(user).catch(() => 0))
      .then(() => resolveAllAdminProfiles(user))
      .then((profiles) => {
        if (!mounted) return;
        setAllProfiles(profiles);
        setAdminProfile(profiles[0] ?? null);
        setAdminReady(true);
        if (profiles.length === 0) {
          setAccessError(
            user.emailVerified
              ? 'This account does not have access to live inquiries yet. Ask an admin to invite this email or phone number.'
              : 'Verify your email first. Then sign in again and the app will connect matching invitations by email or phone.',
          );
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAccessError(error instanceof Error ? error.message : 'Could not check account access.');
        setAdminReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const notifyNewChatMessage = useCallback(async (chat: SupportChat, message: SupportMessage) => {
    if (AppState.currentState === 'active') {
      return;
    }

    const [notificationsSetting, soundSetting, vibrationSetting] = await Promise.all([
      AsyncStorage.getItem('@vintra_settings_notif').catch(() => null),
      AsyncStorage.getItem('@vintra_settings_sound').catch(() => null),
      AsyncStorage.getItem('@vintra_settings_vib').catch(() => null),
    ]);

    const notificationsEnabled = notificationsSetting === null ? true : notificationsSetting === 'true';
    const soundEnabled = soundSetting === null ? true : soundSetting === 'true';
    const vibrationEnabled = vibrationSetting === null ? true : vibrationSetting === 'true';

    if (vibrationEnabled && Platform.OS !== 'web') {
      Vibration.vibrate([0, 250, 120, 250]);
    }

    if (!notificationsEnabled) {
      return;
    }

    const title = chat.visitorName || chat.pageTitle || 'New customer message';
    const body = message.text || chat.preview || 'A customer sent a new message.';
    await sendLocalNotification(title, body, soundEnabled);
  }, []);

  useEffect(() => {
    if (!adminProfile) {
      return undefined;
    }

    AsyncStorage.getItem('@vintra_settings_notif')
      .then((setting) => {
        const enabled = setting === null ? true : setting === 'true';
        if (enabled) {
          registerPushToken(user.uid, adminProfile.businessId).catch(() => {});
        }
      })
      .catch(() => {});

    knownLatestMessageIds.current = {};
    chatNotificationsReady.current = false;
    setChatsLoading(true);
    setAccessError('');

    return listenSupportChats(
      adminProfile.businessId,
      (nextChats) => {
        const previousLatest = knownLatestMessageIds.current;
        const nextLatest: Record<string, string> = {};

        nextChats.forEach((chat) => {
          const latestMessage = chat.messages.at(-1);
          if (!latestMessage) return;

          nextLatest[chat.id] = latestMessage.id;

          const isNewLatest = previousLatest[chat.id] !== latestMessage.id;
          if (chatNotificationsReady.current && isNewLatest && latestMessage.role === 'user') {
            notifyNewChatMessage(chat, latestMessage).catch(() => {});
          }
        });

        knownLatestMessageIds.current = nextLatest;
        chatNotificationsReady.current = true;
        setChats(nextChats);
        setChatsLoading(false);
        setSelectedChatId((current) => current || nextChats[0]?.id || null);
      },
      (error) => {
        setAccessError(error.message);
        setChatsLoading(false);
      },
    );
  }, [adminProfile, notifyNewChatMessage, user.uid]);

  useEffect(() => {
    if (!adminProfile || !selectedChatId) {
      setSelectedChat(null);
      return undefined;
    }

    setChatLoading(selectedChat?.id !== selectedChatId);

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
  }, [adminProfile, selectedChatId, selectedChat?.id]);

  async function handleSignOut() {
    await signOut(firebaseAuth);
    await AsyncStorage.removeItem('@vintra_creds');
  }

  async function handleSendReply() {
    if (!adminProfile || !openChat || openChat.status !== 'open' || sending || !reply.trim()) {
      return;
    }

    setSending(true);
    setAccessError('');

    try {
      if (supportTypingStopTimer.current) {
        clearTimeout(supportTypingStopTimer.current);
        supportTypingStopTimer.current = null;
      }
      await setSupportTyping(adminProfile.businessId, openChat.id, false).catch(() => {});
      await sendSupportReply(adminProfile.businessId, openChat, reply, adminProfile);
      setReply('');
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Could not send reply.');
    } finally {
      setSending(false);
    }
  }

  function handleReplyChange(text: string) {
    setReply(text);

    if (!adminProfile || !openChat || openChat.status !== 'open') {
      return;
    }

    if (supportTypingStopTimer.current) {
      clearTimeout(supportTypingStopTimer.current);
      supportTypingStopTimer.current = null;
    }

    if (!text.trim()) {
      setSupportTyping(adminProfile.businessId, openChat.id, false).catch(() => {});
      supportTypingChatId.current = null;
      return;
    }

    supportTypingChatId.current = openChat.id;
    const now = Date.now();
    if (now - supportTypingLastSentAt.current > 1200) {
      supportTypingLastSentAt.current = now;
      setSupportTyping(adminProfile.businessId, openChat.id, true).catch(() => {});
    }
    supportTypingStopTimer.current = setTimeout(() => {
      if (!adminProfile?.businessId || supportTypingChatId.current !== openChat.id) return;
      setSupportTyping(adminProfile.businessId, openChat.id, false).catch(() => {});
      supportTypingChatId.current = null;
    }, 3200);
  }

  function handleReplyBlur() {
    setReplyFocused(false);
    setReplyInputHeight(0);

    if (adminProfile?.businessId && openChat?.id) {
      setSupportTyping(adminProfile.businessId, openChat.id, false).catch(() => {});
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
      adminT('admin_close_conversation'),
      adminT('admin_close_conversation_msg').replace('{name}', openChat.visitorName || adminT('admin_visitor').toLowerCase()),
      [
        { text: adminT('settings_cancel'), style: 'cancel' },
        {
          text: adminT('admin_close'),
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
        <ThemedText style={styles.loadingText}>{adminT('admin_checking_access')}</ThemedText>
      </View>
    );
  }

  if (!adminProfile) {
    return (
      <View style={styles.noAccessCard}>
        <View style={styles.noAccessIcon}>
          <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={24} tintColor="#ffffff" />
        </View>
        <ThemedText style={styles.noAccessTitle}>{adminT('admin_access_denied')}</ThemedText>
        <ThemedText style={styles.noAccessText}>{accessError || adminT('admin_no_permission')}</ThemedText>
        <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.noAccessButton, pressed && styles.pressed]}>
          <ThemedText style={styles.noAccessButtonText}>{adminT('admin_sign_out')}</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <AdminBackground isLight={isLight} />
      <View style={[styles.dashboard, isLight && styles.dashboardLight, compact && styles.dashboardMobile, compact && isLight && styles.dashboardMobileLight, compact && chatOpen && styles.dashboardCompactOpen]}>

        {/* ── TOP BAR ─────────────────────────────────────── */}
        {!(compact && chatOpen) && (
          <>
            <View style={[styles.topBar, isLight && styles.topBarLight, compact && styles.mobileTopBar, compact && isLight && styles.mobileTopBarLight, { paddingTop: insets.top + 4 }]}>
              <View style={styles.topBarBrand}>
                <View style={styles.topBarLogo}>
                  <Text style={styles.topBarLogoV}>
                    {compact ? (adminProfile.businessName || 'V').slice(0, 1).toUpperCase() : 'V'}
                  </Text>
                </View>
                {allProfiles.length > 1 ? (
                  <Pressable
                    onPress={() => setBizPickerOpen(true)}
                    style={({ pressed }) => [styles.bizSwitchBtn, pressed && styles.pressed]}>
                    <Text style={styles.bizSwitchName} numberOfLines={1}>
                      {adminProfile?.businessName || 'Workspace'}
                    </Text>
                    <SymbolView
                      name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                      size={11}
                      tintColor="#64748b"
                    />
                  </Pressable>
                ) : compact ? (
                  <Text style={[styles.mobileWorkspaceName, isLight && styles.mobileWorkspaceNameLight]} numberOfLines={1}>
                    {adminProfile.businessName || 'VintraNordic'}
                  </Text>
                ) : (
                  <View>
                    <Text style={[styles.topBarName, isLight && styles.topBarNameLight]}>Vintra<Text style={styles.topBarNameAccent}>Nordic</Text></Text>
                    <View style={styles.topBarLive}>
                      <View style={styles.topBarLiveDot} />
                      <Text style={styles.topBarLiveText}>{adminT('admin_live_console').toUpperCase()}</Text>
                    </View>
                  </View>
                )}
              </View>

              {compact ? (
                <View style={styles.mobileTopActions}>
                  <Pressable
                    onPress={handleMobileSearchPress}
                    style={({ pressed }) => [styles.mobileIconButton, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={23} tintColor={compactSearchFocused || searchQuery ? '#159750' : isLight ? '#555555' : '#cbd5e1'} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.topBarMetrics}>
                    {unreadWaitingChats > 0 && (
                      <View style={styles.topBarMetricUrgent}>
                        <Text style={styles.topBarMetricUrgentNum}>{unreadWaitingChats}</Text>
                        <Text style={styles.topBarMetricUrgentLabel}>{adminT('admin_new').toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.topBarMetricBlue}>
                      <Text style={styles.topBarMetricBlueNum}>{activeChats}</Text>
                      <Text style={styles.topBarMetricBlueLabel}>{adminT('admin_open').toUpperCase()}</Text>
                    </View>
                    <View style={styles.topBarMetricGray}>
                      <Text style={styles.topBarMetricGrayNum}>{chats.length}</Text>
                      <Text style={styles.topBarMetricGrayLabel}>{adminT('admin_total').toUpperCase()}</Text>
                    </View>
                  </View>

                  <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.topBarLogoutBtn, pressed && styles.pressed]}>
                    <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={16} tintColor="#475569" />
                  </Pressable>
                </>
              )}
            </View>
            {compact && (
              <View style={[styles.mobileInboxTabs, isLight && styles.mobileInboxTabsLight]}>
                <MobileInboxTab
                  icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
                  label={adminT('admin_all')}
                  active={inboxFilter === 'all'}
                  badge={chats.length}
                  showBadge={false}
                  onPress={() => setInboxFilter('all')}
                />
                <MobileInboxTab
                  icon={{ ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble' }}
                  label={adminT('admin_chats')}
                  active={inboxFilter === 'open'}
                  badge={activeChats}
                  showBadge={false}
                  onPress={() => setInboxFilter('open')}
                />
                <MobileInboxTab
                  icon={{ ios: 'exclamationmark.bubble', android: 'priority_high', web: 'priority_high' }}
                  label={adminT('admin_needs')}
                  active={inboxFilter === 'needs-human'}
                  badge={unreadWaitingChats}
                  onPress={() => setInboxFilter('needs-human')}
                />
                <MobileInboxTab
                  icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  label={adminT('status_ai')}
                  active={inboxFilter === 'ai-active'}
                  badge={filteredVisibleChats.filter((chat) => chat.status === 'ai-active').length}
                  showBadge={false}
                  onPress={() => setInboxFilter('ai-active')}
                />
              </View>
            )}
            {accessError ? <ThemedText style={styles.inlineError}>{accessError}</ThemedText> : null}
          </>
        )}

        {/* ── BUSINESS PICKER ──────────────────────────────── */}
        {allProfiles.length > 1 && (
          <Modal
            visible={bizPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setBizPickerOpen(false)}>
            <Pressable
              style={styles.bizPickerOverlay}
              onPress={() => setBizPickerOpen(false)}>
              <View
                style={[styles.bizPickerCard, { marginTop: insets.top + 56 }]}
                onStartShouldSetResponder={() => true}>
                <Text style={styles.bizPickerTitle}>{adminT('admin_switch_workspace')}</Text>
                <View style={styles.bizPickerDivider} />
                {allProfiles.map((p) => {
                  const isActive = adminProfile?.businessId === p.businessId;
                  return (
                    <Pressable
                      key={p.businessId}
                      onPress={() => {
                        setAdminProfile(p);
                        setChats([]);
                        setSelectedChatId(null);
                        setBizPickerOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.bizPickerRow,
                        isActive && styles.bizPickerRowActive,
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.bizPickerAvatar, isActive && styles.bizPickerAvatarActive]}>
                        <Text style={[styles.bizPickerAvatarText, isActive && styles.bizPickerAvatarTextActive]}>
                          {(p.businessName || p.businessId).slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bizPickerName, isActive && styles.bizPickerNameActive]}>
                          {p.businessName || p.businessId}
                        </Text>
                        <Text style={styles.bizPickerRole}>{p.role}</Text>
                      </View>
                      {isActive && (
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          size={16}
                          tintColor="#03a84e"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Modal>
        )}

        {/* ── MAIN LAYOUT ─────────────────────────────────── */}
        <View style={[styles.mainLayout, compact && styles.mainLayoutCompact]}>

          {/* LEFT: Conversation list */}
          {(!compact || !chatOpen) && (
            <View style={[styles.sidePanel, isLight && styles.sidePanelLight, compact && styles.sidePanelFull, compact && isLight && styles.sidePanelFullLight]}>

              {(!compact || compactSearchFocused || searchQuery) && <View style={[styles.sideSearch, isLight && styles.sideSearchLight, compact && styles.sideSearchCompact, compact && isLight && styles.sideSearchCompactLight]}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={compact ? 21 : 14} tintColor={compact ? (isLight ? '#8e8e93' : '#94a3b8') : '#334155'} />
                <TextInput
                  placeholder={adminT('admin_search_short')}
                  placeholderTextColor={compact ? (isLight ? '#5f6368' : '#94a3b8') : '#334155'}
                  style={[styles.sideSearchInput, isLight && styles.sideSearchInputLight, compact && styles.sideSearchInputCompact, compact && isLight && styles.sideSearchInputCompactLight]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} size={14} tintColor="#334155" />
                  </Pressable>
                ) : null}
              </View>}

              {/* Stats row */}
              {!compact && <View style={styles.sideStats}>
                <View style={[styles.sideStatCard, isLight && styles.sideStatCardLight, waitingChats > 0 && styles.sideStatCardUrgent]}>
                  <Text style={[styles.sideStatNum, isLight && styles.sideStatNumLight, waitingChats > 0 && { color: '#dc2626' }]}>{waitingChats}</Text>
                  <Text style={[styles.sideStatLabel, isLight && styles.sideStatLabelLight]}>{adminT('admin_waiting')}</Text>
                </View>
                <View style={[styles.sideStatCard, isLight && styles.sideStatCardLight, { borderColor: 'rgba(15,110,255,0.2)' }]}>
                  <Text style={[styles.sideStatNum, { color: '#0f6eff' }]}>{activeChats}</Text>
                  <Text style={[styles.sideStatLabel, isLight && styles.sideStatLabelLight]}>{adminT('admin_active')}</Text>
                </View>
                <View style={[styles.sideStatCard, isLight && styles.sideStatCardLight]}>
                  <Text style={[styles.sideStatNum, isLight && styles.sideStatNumLight]}>{chats.length}</Text>
                  <Text style={[styles.sideStatLabel, isLight && styles.sideStatLabelLight]}>{adminT('admin_all')}</Text>
                </View>
              </View>}

              {/* Chat list */}
              {chatsLoading ? (
                <View style={styles.sideLoading}>
                  <ActivityIndicator color="#0f6eff" />
                </View>
              ) : !statusFilteredChats.length ? (
                <View style={styles.sideEmpty}>
                  <View style={styles.sideEmptyIcon}>
                    <SymbolView name={{ ios: 'tray', android: 'inbox', web: 'inbox' }} size={28} tintColor="#1e293b" />
                  </View>
                  <Text style={[styles.sideEmptyTitle, isLight && styles.sideEmptyTitleLight]}>{adminT('admin_no_conversations')}</Text>
                  <Text style={[styles.sideEmptyText, isLight && styles.sideEmptyTextLight]}>
                    {searchQuery || inboxFilter !== 'all' ? adminT('admin_try_another') : adminT('admin_no_conversations_sub')}
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.sideList}>
                  {inboxFilter === 'all' && unansweredChats.length > 0 && (
                    <View style={styles.sideSection}>
                      <View style={styles.sideSectionDot} />
                      <Text style={[styles.sideSectionText, isLight && styles.sideSectionTextLight]}>{adminT('admin_needs_reply').toUpperCase()}</Text>
                      <View style={styles.sideSectionBadge}>
                        <Text style={styles.sideSectionBadgeText}>{unansweredChats.length}</Text>
                      </View>
                    </View>
                  )}
                  {unansweredChats.map((chat) => (
                    <ConversationRow key={chat.id} chat={chat} active={chat.id === selectedChatId} compact={compact} onPress={() => handleSelectChat(chat.id)} />
                  ))}
                  {servedChats.map((chat) => (
                    <ConversationRow key={chat.id} chat={chat} active={chat.id === selectedChatId} compact={compact} onPress={() => handleSelectChat(chat.id)} />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* RIGHT: Chat area */}
          {(!compact || chatOpen) && (
            <View style={[styles.chatArea, isLight && styles.chatAreaLight, compact && styles.chatAreaFull, compact && isLight && styles.chatAreaFullLight]}>
              {openChat ? (
                <>
                  {/* Chat top bar */}
                  <View style={[styles.chatTopBar, isLight && styles.chatTopBarLight, compact && styles.mobileChatTopBar, compact && isLight && styles.mobileChatTopBarLight, compact && { paddingTop: insets.top + 8 }]}>
                    {compact && (
                      <Pressable onPress={handleBackToList} style={({ pressed }) => [styles.chatBackBtn, compact && styles.mobileChatCloseBtn, pressed && styles.pressed]}>
                        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={22} tintColor={isLight ? '#555555' : '#cbd5e1'} />
                      </Pressable>
                    )}
                    <View style={[styles.chatTopAvatar, compact && styles.mobileChatTopAvatar, { backgroundColor: avatarColor(openChat.visitorName || 'V') }]}>
                      <Text style={styles.chatTopAvatarText}>{(openChat.visitorName || 'V').slice(0, 1).toUpperCase()}</Text>
                      <View style={[styles.chatTopOnlineDot, openChat.status === 'needs-human' && { backgroundColor: '#ef4444' }]} />
                    </View>
                    <View style={styles.chatTopInfo}>
                      <Text style={[styles.chatTopName, isLight && styles.chatTopNameLight, compact && styles.mobileChatTopName, compact && isLight && styles.mobileChatTopNameLight]} numberOfLines={1}>{openChat.visitorName || adminT('admin_visitor')}</Text>
                      <Text style={[styles.chatTopMeta, isLight && styles.chatTopMetaLight, compact && styles.mobileChatTopMeta, compact && isLight && styles.mobileChatTopMetaLight]} numberOfLines={1}>
                        {`${formatDateShort(openChat.updatedAt)} ${openChat.preview || openChat.messages.at(-1)?.text || adminT('admin_no_messages')} • ${openChat.messageCount} ${openChat.messageCount === 1 ? adminT('admin_message_one') : adminT('admin_message_other')}`}
                      </Text>
                    </View>
                    {compact ? (
                      <Pressable onPress={showMobileChatMenu} style={({ pressed }) => [styles.mobileChatMenuBtn, pressed && styles.pressed]}>
                        <SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={26} tintColor={isLight ? '#555555' : '#cbd5e1'} />
                      </Pressable>
                    ) : (
                      <StatusPill status={openChat.status} />
                    )}
                  </View>

                  {/* Action toolbar */}
                  {!compact && <View style={[styles.chatToolbar, isLight && styles.chatToolbarLight]}>
                    <View style={styles.handoffControl}>
                      <Pressable
                        disabled={sending}
                        onPress={() => handleStatusChange('open')}
                        style={({ pressed }) => [
                          styles.handoffButton,
                          isLight && styles.handoffButtonLight,
                          compact && styles.handoffButtonCompact,
                          openChat.status === 'open' && styles.handoffButtonHumanActive,
                          openChat.status === 'needs-human' && styles.handoffButtonWaiting,
                          sending && styles.buttonDisabled,
                          pressed && styles.pressed,
                        ]}>
                        <View style={styles.handoffButtonTop}>
                          <SymbolView
                            name={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }}
                            size={14}
                            tintColor={openChat.status === 'open' ? '#ffffff' : openChat.status === 'needs-human' ? (isLight ? '#dc2626' : '#fca5a5') : '#64748b'}
                          />
                          <Text style={[styles.handoffTitle, isLight && styles.handoffTitleLight, openChat.status === 'open' && styles.handoffTitleActive, openChat.status === 'needs-human' && styles.handoffTitleWaiting, openChat.status === 'needs-human' && isLight && styles.handoffTitleWaitingLight]}>
                            {compact ? adminT('status_active') : adminT('admin_take_over')}
                          </Text>
                        </View>
                        <Text style={[styles.handoffSub, isLight && styles.handoffSubLight, openChat.status === 'open' && styles.handoffSubActive, openChat.status === 'needs-human' && styles.handoffSubWaiting, openChat.status === 'needs-human' && isLight && styles.handoffSubWaitingLight]} numberOfLines={1}>
                          {openChat.status === 'open' ? adminT('admin_you_are_handling') : openChat.status === 'needs-human' ? adminT('admin_needs_reply') : adminT('admin_assign_to_you')}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={sending}
                        onPress={() => handleStatusChange('ai-active')}
                        style={({ pressed }) => [
                          styles.handoffButton,
                          isLight && styles.handoffButtonLight,
                          compact && styles.handoffButtonCompact,
                          openChat.status === 'ai-active' && styles.handoffButtonAiActive,
                          sending && styles.buttonDisabled,
                          pressed && styles.pressed,
                        ]}>
                        <View style={styles.handoffButtonTop}>
                          <SymbolView
                            name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                            size={14}
                            tintColor={openChat.status === 'ai-active' ? '#ffffff' : '#64748b'}
                          />
                          <Text style={[styles.handoffTitle, isLight && styles.handoffTitleLight, openChat.status === 'ai-active' && styles.handoffTitleActive]}>
                            {compact ? adminT('status_ai') : adminT('admin_give_to_ai')}
                          </Text>
                        </View>
                        <Text style={[styles.handoffSub, isLight && styles.handoffSubLight, openChat.status === 'ai-active' && styles.handoffSubActive]} numberOfLines={1}>
                          {openChat.status === 'ai-active' ? adminT('admin_ai_handling') : adminT('admin_let_ai_answer')}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.toolBtnSpacer} />
                    <Pressable
                      disabled={sending}
                      onPress={handleCloseChat}
                      style={({ pressed }) => [styles.toolBtnResolve, compact && styles.toolBtnResolveCompact, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={13} tintColor="#22c55e" />
                      <Text style={styles.toolBtnResolveText}>{adminT('admin_resolve')}</Text>
                    </Pressable>
                  </View>}

                  {/* Messages */}
                  <ScrollView
                    ref={messageListRef}
                    style={[styles.msgScroll, isLight && styles.msgScrollLight, compact && styles.msgScrollCompact, compact && isLight && styles.msgScrollCompactLight]}
                    contentContainerStyle={[styles.msgScrollContent, compact && styles.msgScrollContentCompact]}
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: false })}>
                    {chatLoading ? (
                      <View style={styles.msgLoading}>
                        <ActivityIndicator color="#0f6eff" />
                      </View>
                    ) : (
                      <>
                        {openChat.messages.map((message) => <MessageBubble key={message.id} message={message} compact={compact} />)}
                        {visitorIsTyping ? <TypingBubble label={adminT('admin_visitor_typing')} compact={compact} /> : null}
                      </>
                    )}
                  </ScrollView>

                  {hasJoinedOpenChat ? (
                    <>
                      {/* Quick replies */}
                      {quickRepliesEnabled && quickReplies.length > 0 && (
                        <View style={[styles.quickBar, isLight && styles.quickBarLight, compact && styles.quickBarCompact, compact && isLight && styles.quickBarCompactLight]}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickBarScroll}>
                            {quickReplies.map((item) => (
                              <Pressable
                                key={item.id}
                                onPress={() => setReply(item.value)}
                                style={({ pressed }) => [styles.quickChip, isLight && styles.quickChipLight, pressed && styles.pressed]}>
                                <Text style={[styles.quickChipText, isLight && styles.quickChipTextLight]}>{item.label}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* Input */}
                      <View
                        style={[
                          styles.msgInputBar,
                          isLight && styles.msgInputBarLight,
                          compact && styles.msgInputBarCompact,
                          replyExpanded && styles.msgInputBarExpanded,
                          replyExpanded && compact && styles.msgInputBarExpandedCompact,
                          isLight && styles.msgInputBarLight,
                          compact && isLight && styles.msgInputBarCompactLight,
                          replyExpanded && isLight && styles.msgInputBarExpandedLight,
                          compact && { paddingBottom: Math.max(insets.bottom + 10, 28) },
                        ]}>
                        <TextInput
                          multiline
                          scrollEnabled
                          placeholder={adminT('admin_reply_placeholder')}
                          placeholderTextColor={isLight ? '#64748b' : '#94a3b8'}
                          textAlignVertical="top"
                          style={[
                            styles.msgInput,
                            isLight && styles.msgInputLight,
                            compact && styles.msgInputCompact,
                            replyExpanded && styles.msgInputExpanded,
                            replyExpanded && compact && styles.msgInputExpandedCompact,
                            isLight && styles.msgInputLight,
                            compact && isLight && styles.msgInputCompactLight,
                            replyExpanded && isLight && styles.msgInputExpandedLight,
                            replyExpanded && compact && isLight && styles.msgInputExpandedCompactLight,
                            { height: replyHeight },
                          ]}
                          value={reply}
                          onChangeText={handleReplyChange}
                          onFocus={() => setReplyFocused(true)}
                          onBlur={handleReplyBlur}
                          onContentSizeChange={(event) => setReplyInputHeight(event.nativeEvent.contentSize.height + 18)}
                          onSubmitEditing={handleSendReply}
                        />
                        <Pressable
                          disabled={sending || !reply.trim()}
                          onPress={handleSendReply}
                          style={({ pressed }) => [styles.msgSendBtn, compact && styles.msgSendBtnCompact, (sending || !reply.trim()) && styles.msgSendBtnDisabled, pressed && styles.pressed]}>
                          {sending
                            ? <ActivityIndicator color="#ffffff" size="small" />
                            : <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={17} tintColor="#ffffff" />}
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <View
                      style={[
                        styles.joinBar,
                        isLight && styles.joinBarLight,
                        compact && styles.joinBarCompact,
                        compact && { paddingBottom: Math.max(insets.bottom + 12, 30) },
                      ]}>
                      <View style={styles.joinCopy}>
                        <Text style={[styles.joinTitle, isLight && styles.joinTitleLight]}>
                          {adminT('admin_join_title')}
                        </Text>
                        <Text style={[styles.joinSub, isLight && styles.joinSubLight]} numberOfLines={2}>
                          {adminT('admin_join_sub')}
                        </Text>
                      </View>
                      <Pressable
                        disabled={sending}
                        onPress={() => handleStatusChange('open')}
                        style={({ pressed }) => [styles.joinButton, sending && styles.buttonDisabled, pressed && styles.pressed]}>
                        {sending ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <SymbolView name={{ ios: 'person.wave.2.fill', android: 'support_agent', web: 'support_agent' }} size={16} tintColor="#ffffff" />
                            <Text style={styles.joinButtonText}>{adminT('admin_join')}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.chatPlaceholder}>
                  <View style={styles.chatPlaceholderIcon}>
                    <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={30} tintColor="#0f6eff" />
                  </View>
                  <Text style={[styles.chatPlaceholderTitle, isLight && styles.chatPlaceholderTitleLight]}>{adminT('admin_select_conversation')}</Text>
                  <Text style={[styles.chatPlaceholderText, isLight && styles.chatPlaceholderTextLight]}>{adminT('admin_select_conversation_sub')}</Text>
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

function MobileInboxTab({ icon, label, active, badge, showBadge = true, onPress }: { icon: AppSymbolName; label: string; active: boolean; badge: number; showBadge?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.mobileInboxTab, active && styles.mobileInboxTabActive, pressed && styles.pressed]}>
      <View style={styles.mobileInboxTabIconWrap}>
        <SymbolView name={icon} size={25} tintColor={active ? '#159750' : '#5f6368'} />
        {showBadge && badge > 0 ? (
          <View style={[styles.mobileInboxTabBadge, active && styles.mobileInboxTabBadgeActive]}>
            <Text style={styles.mobileInboxTabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.mobileInboxTabText, active && styles.mobileInboxTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';
  const label = status === 'needs-human' ? t('status_waiting') : status === 'open' ? t('status_active') : status === 'ai-active' ? t('status_ai') : status;

  return (
    <View style={[styles.chatStatusPill, isLight && styles.chatStatusPillLight, status === 'needs-human' && styles.chatStatusWaiting]}>
      <View style={[styles.statusDot, status !== 'ai-active' && styles.statusDotActive]} />
      <ThemedText style={[styles.chatStatusText, isLight && styles.chatStatusTextLight]}>{label}</ThemedText>
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

function TypewriterText({ text, style }: { text: string; style: any }) {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    if (!text) {
      setVisibleText('');
      return undefined;
    }

    let index = 0;
    setVisibleText('');
    const step = Math.max(8, Math.min(24, 900 / text.length));
    const timer = setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
      }
    }, step);

    return () => clearInterval(timer);
  }, [text]);

  return <Text style={style}>{visibleText}</Text>;
}

function ConversationRow({ chat, active, compact, onPress }: { chat: SupportChat; active: boolean; compact?: boolean; onPress: () => void }) {
  const { colorScheme } = useThemePreference();
  const { t } = useTranslation();
  const isLight = colorScheme === 'light';
  const lastMessage = chat.messages.at(-1);
  const needsAnswer = chat.status === 'needs-human';
  const isAI = chat.status === 'ai-active';
  const accentColor = needsAnswer ? '#ef4444' : isAI ? '#8b5cf6' : '#0f6eff';
  const bg = avatarColor(chat.visitorName || 'V');
  const label = needsAnswer ? t('admin_needs_reply') : isAI ? t('status_ai') : t('status_active');
  const messageLabel = `${chat.messageCount} ${chat.messageCount === 1 ? t('admin_message_one') : t('admin_message_other')}`;
  const sourceLabel = chat.pageTitle || chat.countryCode || chat.pageUrl || '';
  const statusMeta = compact ? messageLabel : `${messageLabel}${sourceLabel ? ` • ${sourceLabel}` : ''}`;

  return (
    <Animated.View entering={FadeInDown.duration(180)} layout={LinearTransition.duration(180)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chatRow,
          isLight && styles.chatRowLight,
          compact && styles.chatRowCompact,
          compact && isLight && styles.chatRowCompactLight,
          active && styles.chatRowActive,
          active && isLight && styles.chatRowActiveLight,
          active && compact && styles.chatRowActiveCompact,
          active && compact && isLight && styles.chatRowActiveCompactLight,
          needsAnswer && styles.chatRowUrgent,
          needsAnswer && compact && styles.chatRowUrgentCompact,
          needsAnswer && compact && isLight && styles.chatRowUrgentCompactLight,
          pressed && styles.pressed,
        ]}>
        {!compact && <View style={[styles.chatRowAccentBar, { backgroundColor: active || needsAnswer ? accentColor : 'transparent' }]} />}
        <View style={[styles.chatRowAvatar, compact && styles.chatRowAvatarCompact, { backgroundColor: bg }]}>
          <Text style={styles.chatRowAvatarText}>{(chat.visitorName || 'V').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.chatRowBody}>
          <View style={styles.chatRowTop}>
            <Text style={[styles.chatRowName, compact && styles.chatRowNameCompact, active && styles.chatRowNameActive, isLight && styles.chatRowNameLight, active && isLight && styles.chatRowNameActiveLight, compact && isLight && styles.chatRowNameCompactLight]} numberOfLines={1}>
              {chat.visitorName || t('admin_visitor')}
            </Text>
            <Text style={[styles.chatRowTime, isLight && styles.chatRowTimeLight, compact && styles.chatRowTimeCompact]}>{formatRelativeTime(chat.updatedAt, t)}</Text>
          </View>
          <Text style={[styles.chatRowPreview, isLight && styles.chatRowPreviewLight, compact && styles.chatRowPreviewCompact, compact && isLight && styles.chatRowPreviewCompactLight]} numberOfLines={1}>
            {lastMessage?.text || chat.preview || t('admin_no_messages')}
          </Text>
          <View style={styles.chatRowMeta}>
            <Text style={[styles.chatRowSource, isLight && styles.chatRowSourceLight, compact && styles.chatRowSourceCompact, compact && isLight && styles.chatRowSourceCompactLight]} numberOfLines={1}>
              {statusMeta}
            </Text>
          </View>
        </View>
        <View style={styles.chatRowRight}>
          <View style={[styles.chatRowBadge, compact && styles.chatRowBadgeCompact, { backgroundColor: compact ? accentColor : accentColor + '18', borderColor: compact ? accentColor : accentColor + '45' }]}>
            <Text style={[styles.chatRowBadgeText, compact && styles.chatRowBadgeTextCompact, { color: compact ? '#ffffff' : accentColor }]}>{compact && chat.status === 'ai-active' ? t('status_ai') : compact && chat.status === 'open' ? t('status_active') : label}</Text>
          </View>
          {!compact && <Text style={[styles.chatRowTimestamp, isLight && styles.chatRowTimestampLight]}>{formatTime(chat.updatedAt)}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MessageBubble({ message, compact }: { message: SupportMessage; compact?: boolean }) {
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';
  const fromAdmin = message.role === 'support';
  const fromSystem = message.role === 'system';

  if (fromSystem) {
    return (
      <View style={[styles.sysMsgRow, compact && styles.sysMsgRowCompact]}>
        <Text style={[styles.sysMsgText, compact && styles.sysMsgTextCompact, compact && isLight && styles.sysMsgTextCompactLight]}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, compact && styles.bubbleRowCompact, fromAdmin && styles.bubbleRowAdmin]}>
      {!fromAdmin && (
        <View style={[styles.bubbleVisitorAvatar, isLight && styles.bubbleVisitorAvatarLight, compact && styles.bubbleVisitorAvatarCompact, compact && isLight && styles.bubbleVisitorAvatarCompactLight]}>
          <Text style={[styles.bubbleVisitorAvatarText, isLight && styles.bubbleVisitorAvatarTextLight, compact && styles.bubbleVisitorAvatarTextCompact, compact && isLight && styles.bubbleVisitorAvatarTextCompactLight]}>V</Text>
        </View>
      )}
      <View style={[styles.bubble, isLight && styles.bubbleLight, compact && styles.bubbleCompact, compact && isLight && styles.bubbleCompactLight, fromAdmin && styles.bubbleAdmin, fromAdmin && isLight && styles.bubbleAdminLight, fromAdmin && compact && styles.bubbleAdminCompact]}>
        {compact ? (
          <Text
            style={[
              styles.bubbleText,
              isLight && styles.bubbleTextLight,
              styles.bubbleTextCompact,
              isLight && styles.bubbleTextCompactLight,
              fromAdmin && styles.bubbleTextAdmin,
              fromAdmin && compact && styles.bubbleTextAdminCompact,
              fromAdmin && compact && isLight && styles.bubbleTextAdminCompactLight,
            ]}>
            {message.text}
          </Text>
        ) : (
          <TypewriterText text={message.text} style={[styles.bubbleText, isLight && styles.bubbleTextLight, fromAdmin && styles.bubbleTextAdmin]} />
        )}
        <Text style={[styles.bubbleTime, isLight && styles.bubbleTimeLight, compact && styles.bubbleTimeCompact, fromAdmin && styles.bubbleTimeAdmin, fromAdmin && compact && styles.bubbleTimeAdminCompact]}>{formatTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

function TypingBubble({ label, compact }: { label: string; compact?: boolean }) {
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';

  return (
    <View style={[styles.bubbleRow, compact && styles.bubbleRowCompact, styles.typingRow]}>
      <View style={[styles.bubbleVisitorAvatar, isLight && styles.bubbleVisitorAvatarLight, compact && styles.bubbleVisitorAvatarCompact, compact && isLight && styles.bubbleVisitorAvatarCompactLight]}>
        <Text style={[styles.bubbleVisitorAvatarText, isLight && styles.bubbleVisitorAvatarTextLight, compact && styles.bubbleVisitorAvatarTextCompact, compact && isLight && styles.bubbleVisitorAvatarTextCompactLight]}>V</Text>
      </View>
      <View style={[styles.typingBubble, isLight && styles.typingBubbleLight, compact && styles.typingBubbleCompact, compact && isLight && styles.typingBubbleCompactLight]}>
        <View style={styles.typingDots}>
          <View style={[styles.typingDot, isLight && styles.typingDotLight]} />
          <View style={[styles.typingDot, isLight && styles.typingDotLight]} />
          <View style={[styles.typingDot, isLight && styles.typingDotLight]} />
        </View>
        <Text style={[styles.typingLabel, isLight && styles.typingLabelLight]}>{label}</Text>
      </View>
    </View>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date: Date, t: ReturnType<typeof useTranslation>['t']) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return t('admin_just_now');
  if (diffMinutes < 60) return `${diffMinutes}${t('admin_minutes_ago')}`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}${t('admin_hours_ago')}`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}${t('admin_days_ago')}`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateShort(date: Date) {
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemePreference();
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

  useEffect(() => {
    setTabsHidden(compact && chatOpen);
    return () => setTabsHidden(false);
  }, [chatOpen, compact]);

  if (!user) return null;

  return (
    <ThemedView style={[styles.container, colorScheme === 'light' && styles.containerLight]}>
      <AnimatedBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardView}>
        <AdminScreen
          user={user}
          compact={compact}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          initialSelectedChatId={selectedChatIdForModal}
          onChatSelect={setSelectedChatIdForModal}
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141e2e',
  },
  containerLight: {
    backgroundColor: '#f2f6fb',
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
  authAurora: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#040a17',
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
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authLayoutCompact: {
    minHeight: undefined,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authFormGroup: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 10,
  },
  brand: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  brandDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 92,
    height: 72,
  },
  brandName: {
    color: '#f4fbff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: 7,
    textAlign: 'center',
    textShadowColor: 'rgba(110,231,199,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
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
    color: '#9fd8cb',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
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
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    textAlign: 'center',
  },
  authTitleCompact: {
    fontSize: 29,
    lineHeight: 34,
  },
  authCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 22,
    backgroundColor: 'rgba(8,18,34,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,199,0.16)',
    shadowColor: '#0b3b34',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  registerBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(110,231,199,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,199,0.22)',
  },
  registerBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6ee7c7',
    marginBottom: 4,
  },
  registerBannerMsg: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  segment: {
    height: 46,
    padding: 4,
    borderRadius: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(110,231,199,0.1)',
  },
  segmentButton: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#15b89a',
    shadowColor: '#15b89a',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
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
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    textAlign: 'center',
  },
  formLead: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  form: {
    gap: 10,
    marginTop: 14,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,199,0.14)',
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#15b89a',
    shadowColor: '#15b89a',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
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
  dashboardLight: {
    backgroundColor: '#f2f6fb',
  },
  dashboardMobile: {
    backgroundColor: '#101826',
  },
  dashboardMobileLight: {
    backgroundColor: '#f7f7f8',
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
    width: 38,
    height: 38,
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
    fontSize: 14,
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
  chatStatusPillLight: {
    backgroundColor: '#e8f1ff',
    borderColor: '#b8d2ff',
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
  chatStatusTextLight: {
    color: '#0f3f91',
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
  auroraBaseLight: {
    backgroundColor: '#f2f6fb',
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
  auroraTealLight: {
    backgroundColor: 'rgba(15,110,255,0.10)',
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
  auroraPurpleLight: {
    backgroundColor: 'rgba(3,168,78,0.10)',
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
  auroraBlueLight: {
    backgroundColor: 'rgba(14,165,233,0.16)',
  },
  meshGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,46,0.15)',
  },
  meshGradientOverlayLight: {
    backgroundColor: 'rgba(255,255,255,0.42)',
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
  topBarLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomColor: '#dbe7f4',
  },
  mobileTopBar: {
    backgroundColor: '#101826',
    borderBottomColor: '#263346',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  mobileTopBarLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d2d2d7',
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
    letterSpacing: 0,
  },
  mobileWorkspaceName: {
    flex: 1,
    color: '#e5edf8',
    fontSize: 19,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  mobileWorkspaceNameLight: {
    color: '#575757',
  },
  mobileTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mobileIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileInboxTabs: {
    height: 68,
    flexDirection: 'row',
    backgroundColor: '#101826',
    borderBottomWidth: 1,
    borderBottomColor: '#263346',
  },
  mobileInboxTabsLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d2d2d7',
  },
  mobileInboxTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mobileInboxTabActive: {
    borderBottomColor: '#159750',
  },
  mobileInboxTabIconWrap: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileInboxTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileInboxTabTextActive: {
    color: '#159750',
  },
  mobileInboxTabBadge: {
    position: 'absolute',
    top: -5,
    right: -12,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3b45',
  },
  mobileInboxTabBadgeActive: {
    backgroundColor: '#ff3b45',
  },
  mobileInboxTabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  topBarName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  topBarNameLight: {
    color: '#0f172a',
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
  superAdminBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },

  /* ── Chatbot / widget tab bar ───────────────────────── */
  widgetTabBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  widgetTabBarLight: {
    backgroundColor: '#f8fbff',
    borderBottomColor: '#dbe7f4',
  },
  widgetTabRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
  },
  widgetTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  widgetTabLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d8e3f0',
  },
  widgetTabActive: {
    backgroundColor: '#0f6eff',
    borderColor: 'rgba(15,110,255,0.55)',
  },
  widgetTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 100,
  },
  widgetTabTextLight: {
    color: '#334155',
  },
  widgetTabTextActive: {
    color: '#ffffff',
  },
  widgetTabUrgentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  widgetTabCount: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  widgetTabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  widgetTabCountUrgent: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  widgetTabCountText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
  },
  widgetTabCountTextActive: {
    color: '#ffffff',
  },

  /* ── Business switcher button (top bar) ──────────────── */
  bizSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 160,
  },
  bizSwitchName: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },

  /* ── Business picker modal ───────────────────────────── */
  bizPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
  },
  bizPickerCard: {
    backgroundColor: '#141e2e',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 20,
  },
  bizPickerTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  bizPickerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 4,
  },
  bizPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bizPickerRowActive: {
    backgroundColor: 'rgba(3,168,78,0.08)',
    borderColor: 'rgba(3,168,78,0.2)',
  },
  bizPickerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bizPickerAvatarActive: {
    backgroundColor: 'rgba(3,168,78,0.15)',
  },
  bizPickerAvatarText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '900',
  },
  bizPickerAvatarTextActive: {
    color: '#03a84e',
  },
  bizPickerName: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  bizPickerNameActive: {
    color: '#ffffff',
  },
  bizPickerRole: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
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
  sidePanelLight: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRightColor: '#dbe7f4',
  },
  sidePanelFull: {
    width: '100%',
    flexDirection: 'column',
    borderRightWidth: 0,
    flex: 1,
    backgroundColor: '#101826',
  },
  sidePanelFullLight: {
    backgroundColor: '#f7f7f8',
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
  sideSearchLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d8e3f0',
  },
  sideSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  sideSearchInputLight: {
    color: '#0f172a',
  },
  sideSearchInputCompact: {
    color: '#e5edf8',
    fontSize: 17,
    fontWeight: '500',
  },
  sideSearchInputCompactLight: {
    color: '#222222',
  },
  sideSearchCompactLight: {
    backgroundColor: '#ececf0',
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
  sideStatCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dce6f2',
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
  sideStatNumLight: {
    color: '#0f172a',
  },
  sideStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sideStatLabelLight: {
    color: '#64748b',
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
  sideEmptyTitleLight: {
    color: '#0f172a',
  },
  sideEmptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4a6080',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 220,
  },
  sideEmptyTextLight: {
    color: '#64748b',
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
  sideSectionTextLight: {
    color: '#475569',
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
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 0,
    marginHorizontal: 10,
    marginVertical: 4,
    borderRadius: 18,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chatRowCompact: {
    minHeight: 88,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingVertical: 10,
    paddingRight: 20,
    paddingLeft: 20,
    borderRadius: 0,
    gap: 10,
    backgroundColor: '#101826',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#263346',
  },
  chatRowCompactLight: {
    backgroundColor: '#f7f7f8',
    borderBottomColor: '#c8c8cc',
  },
  chatRowLight: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: '#deebf7',
  },
  chatRowActive: {
    backgroundColor: 'rgba(15,110,255,0.11)',
    borderColor: 'rgba(15,110,255,0.28)',
  },
  chatRowActiveLight: {
    backgroundColor: '#edf5ff',
    borderColor: '#a7c8ff',
  },
  chatRowActiveCompact: {
    backgroundColor: '#172235',
    borderBottomColor: '#334155',
  },
  chatRowActiveCompactLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#bdbdc2',
  },
  chatRowUrgent: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.14)',
  },
  chatRowUrgentCompact: {
    backgroundColor: '#151d2c',
    borderBottomColor: '#334155',
  },
  chatRowUrgentCompactLight: {
    backgroundColor: '#fff7f7',
    borderBottomColor: '#e5c7c7',
  },
  chatRowAccentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
    marginLeft: 6,
  },
  chatRowAccentDot: {
    width: 10,
    height: 10,
    alignSelf: 'flex-start',
    marginLeft: 0,
    marginTop: 15,
    borderRadius: 999,
  },
  chatRowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  chatRowAvatarCompact: {
    width: 42,
    height: 42,
    borderRadius: 10,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  chatRowAvatarText: {
    fontSize: 15,
    fontWeight: '900',
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
  chatRowStatusDotLight: {
    borderColor: '#ffffff',
  },
  chatRowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  chatRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  chatRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#e2e8f0',
    flex: 1,
  },
  chatRowNameCompact: {
    color: '#e5edf8',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  chatRowNameCompactLight: {
    color: '#202124',
  },
  chatRowNameLight: {
    color: '#162033',
  },
  chatRowNameActive: {
    color: '#e2e8f0',
  },
  chatRowNameActiveLight: {
    color: '#0f172a',
  },
  chatRowTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7ea6da',
  },
  chatRowTimeLight: {
    color: '#7a8aa0',
  },
  chatRowTimeCompact: {
    color: '#5f6368',
    fontSize: 11,
    fontWeight: '700',
  },
  chatRowPreview: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    lineHeight: 18,
  },
  chatRowPreviewLight: {
    color: '#334155',
  },
  chatRowPreviewCompact: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  chatRowPreviewCompactLight: {
    color: '#202124',
  },
  chatRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatRowSource: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#7c94b6',
  },
  chatRowSourceLight: {
    color: '#64748b',
  },
  chatRowSourceCompact: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  chatRowSourceCompactLight: {
    color: '#6f6f73',
  },
  chatRowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatRowBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chatRowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chatRowBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chatRowBadgeTextCompact: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  chatRowTimestamp: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  chatRowTimestampLight: {
    color: '#94a3b8',
  },
  chatRowTimestampCompact: {
    color: '#5f6368',
    fontSize: 13,
    fontWeight: '600',
  },
  mobileInboxHero: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mobileInboxHeroLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: '#dbe7f4',
  },
  mobileInboxHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  mobileInboxEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7dd3fc',
  },
  mobileInboxEyebrowLight: {
    color: '#0f6eff',
  },
  mobileInboxTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
  },
  mobileInboxTitleLight: {
    color: '#0f172a',
  },
  mobileInboxPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
  },
  mobileInboxPulseUrgent: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  mobileInboxPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  mobileInboxPulseDotUrgent: {
    backgroundColor: '#ef4444',
  },
  mobileInboxPulseText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#86efac',
  },
  mobileInboxPulseTextLight: {
    color: '#166534',
  },
  mobileInboxStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  queueStatCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  queueStatCardLight: {
    backgroundColor: '#f8fbff',
    borderColor: '#deebf7',
  },
  queueStatCardUrgent: {
    backgroundColor: 'rgba(239,68,68,0.09)',
    borderColor: 'rgba(239,68,68,0.18)',
  },
  queueStatCardActive: {
    backgroundColor: 'rgba(15,110,255,0.1)',
    borderColor: 'rgba(15,110,255,0.2)',
  },
  queueStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f8fafc',
  },
  queueStatValueLight: {
    color: '#0f172a',
  },
  queueStatValueUrgent: {
    color: '#f87171',
  },
  queueStatValueActive: {
    color: '#60a5fa',
  },
  queueStatLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  queueStatLabelLight: {
    color: '#64748b',
  },
  mobileInboxFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingRight: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipLight: {
    backgroundColor: '#f8fbff',
    borderColor: '#deebf7',
  },
  filterChipActive: {
    backgroundColor: 'rgba(15,110,255,0.16)',
    borderColor: 'rgba(15,110,255,0.28)',
  },
  filterChipActiveLight: {
    backgroundColor: '#eaf3ff',
    borderColor: '#a7c8ff',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  filterChipTextLight: {
    color: '#334155',
  },
  filterChipTextActive: {
    color: '#0f6eff',
  },
  filterChipBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterChipBadgeActive: {
    backgroundColor: '#0f6eff',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#e2e8f0',
  },
  filterChipBadgeTextActive: {
    color: '#ffffff',
  },
  sideSearchCompact: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#1a2536',
    borderWidth: 0,
  },

  /* ── CHAT AREA ────────────────────────────────────── */
  chatArea: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  chatAreaLight: {
    backgroundColor: 'rgba(248,251,255,0.72)',
  },
  chatAreaFull: {
    width: '100%',
    backgroundColor: '#101826',
  },
  chatAreaFullLight: {
    backgroundColor: '#f3f3f4',
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
  chatTopBarLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomColor: '#dbe7f4',
  },
  mobileChatTopBar: {
    minHeight: 92,
    backgroundColor: '#101826',
    borderBottomColor: '#263346',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  mobileChatTopBarLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d2d2d7',
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
  mobileChatCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  chatTopAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mobileChatTopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  chatTopNameLight: {
    color: '#0f172a',
  },
  mobileChatTopName: {
    color: '#e5edf8',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  mobileChatTopNameLight: {
    color: '#575757',
  },
  chatTopMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  chatTopMetaLight: {
    color: '#64748b',
  },
  mobileChatTopMeta: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  mobileChatTopMetaLight: {
    backgroundColor: '#dedede',
    color: '#555555',
  },
  mobileChatMenuBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  chatToolbarLight: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderBottomColor: '#dbe7f4',
  },
  mobileChatToolbar: {
    backgroundColor: '#f7f7f8',
    borderBottomColor: '#d2d2d7',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  handoffControl: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  handoffButton: {
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  handoffButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d8e3f0',
  },
  handoffButtonCompact: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderColor: '#dedede',
  },
  handoffButtonHumanActive: {
    backgroundColor: '#0f6eff',
    borderColor: '#63a5ff',
    shadowColor: '#0f6eff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  handoffButtonAiActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#c4b5fd',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  handoffButtonWaiting: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  handoffButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handoffTitle: {
    flexShrink: 1,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  handoffTitleLight: {
    color: '#334155',
  },
  handoffTitleActive: {
    color: '#ffffff',
  },
  handoffTitleWaiting: {
    color: '#fca5a5',
  },
  handoffTitleWaitingLight: {
    color: '#dc2626',
  },
  handoffSub: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  handoffSubLight: {
    color: '#64748b',
  },
  handoffSubActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  handoffSubWaiting: {
    color: 'rgba(252,165,165,0.75)',
  },
  handoffSubWaitingLight: {
    color: '#b91c1c',
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
    width: 2,
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
  toolBtnResolveCompact: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderColor: '#dedede',
  },

  /* ── MESSAGES ─────────────────────────────────────── */
  msgScroll: {
    flex: 1,
  },
  msgScrollLight: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  msgScrollCompact: {
    backgroundColor: '#101826',
  },
  msgScrollCompactLight: {
    backgroundColor: '#f3f3f4',
  },
  msgScrollContent: {
    padding: 14,
    gap: 8,
    paddingBottom: 32,
  },
  msgScrollContentCompact: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 42,
    gap: 18,
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
  sysMsgRowCompact: {
    alignItems: 'flex-start',
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
  sysMsgTextCompact: {
    color: '#94a3b8',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  sysMsgTextCompactLight: {
    color: '#777777',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  bubbleRowCompact: {
    maxWidth: '92%',
    gap: 10,
  },
  bubbleRowAdmin: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  typingRow: {
    alignSelf: 'flex-start',
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
  bubbleVisitorAvatarLight: {
    backgroundColor: '#e8eef7',
  },
  bubbleVisitorAvatarCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginBottom: 0,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleVisitorAvatarCompactLight: {
    backgroundColor: '#eeeeee',
    borderColor: '#cfcfcf',
  },
  bubbleVisitorAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  bubbleVisitorAvatarTextLight: {
    color: '#475569',
  },
  bubbleVisitorAvatarTextCompact: {
    color: '#94a3b8',
    fontSize: 24,
    fontWeight: '500',
  },
  bubbleVisitorAvatarTextCompactLight: {
    color: '#9b9b9b',
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
  bubbleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe7f4',
  },
  bubbleCompact: {
    maxWidth: 300,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: '#1a2536',
    borderColor: '#263346',
  },
  bubbleCompactLight: {
    backgroundColor: '#ffffff',
    borderColor: '#eeeeee',
  },
  bubbleAdmin: {
    backgroundColor: 'rgba(15,110,255,0.18)',
    borderColor: 'rgba(15,110,255,0.3)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleAdminLight: {
    backgroundColor: '#0f6eff',
    borderColor: '#0f6eff',
  },
  bubbleAdminCompact: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderBottomRightRadius: 8,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
    lineHeight: 20,
  },
  bubbleTextLight: {
    color: '#1e293b',
  },
  bubbleTextCompact: {
    color: '#e5edf8',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  bubbleTextCompactLight: {
    color: '#404040',
  },
  bubbleTextAdmin: {
    color: '#e2e8f0',
  },
  bubbleTextAdminCompact: {
    color: '#052e16',
  },
  bubbleTextAdminCompactLight: {
    color: '#14532d',
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a6080',
    textAlign: 'right',
  },
  bubbleTimeLight: {
    color: '#94a3b8',
  },
  bubbleTimeCompact: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  bubbleTimeAdmin: {
    color: 'rgba(147,197,253,0.5)',
  },
  bubbleTimeAdminCompact: {
    color: '#166534',
  },
  typingBubble: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typingBubbleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe7f4',
  },
  typingBubbleCompact: {
    minHeight: 42,
    borderRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: '#1a2536',
    borderColor: '#263346',
  },
  typingBubbleCompactLight: {
    backgroundColor: '#ffffff',
    borderColor: '#eeeeee',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
    opacity: 0.9,
  },
  typingDotLight: {
    backgroundColor: '#64748b',
  },
  typingLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  typingLabelLight: {
    color: '#64748b',
  },

  /* ── QUICK REPLIES ────────────────────────────────── */
  quickBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,30,46,0.7)',
  },
  quickBarLight: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderTopColor: '#dbe7f4',
  },
  quickBarCompact: {
    backgroundColor: '#101826',
    borderTopColor: '#263346',
  },
  quickBarCompactLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d2d2d7',
  },
  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(16,24,38,0.96)',
  },
  joinBarLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d2dbe8',
  },
  joinBarCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: '#101826',
    borderTopColor: '#263346',
  },
  joinCopy: {
    flex: 1,
    minWidth: 0,
  },
  joinTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '900',
  },
  joinTitleLight: {
    color: '#0f172a',
  },
  joinSub: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  joinSubLight: {
    color: '#64748b',
  },
  joinButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#159750',
    shadowColor: '#159750',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
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
  quickChipLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d8e3f0',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  quickChipTextLight: {
    color: '#334155',
  },

  /* ── INPUT BAR ────────────────────────────────────── */
  msgInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(20,30,46,0.92)',
  },
  msgInputBarExpanded: {
    paddingTop: 12,
    backgroundColor: 'rgba(16,24,38,0.98)',
  },
  msgInputBarExpandedLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#c7d7eb',
  },
  msgInputBarLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopColor: '#dbe7f4',
  },
  msgInputBarCompact: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#101826',
    borderTopColor: '#263346',
  },
  msgInputBarExpandedCompact: {
    paddingTop: 14,
  },
  msgInputBarCompactLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d2d2d7',
  },
  msgInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 92,
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
  msgInputExpanded: {
    minHeight: 54,
    maxHeight: 136,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 16,
    borderColor: 'rgba(15,110,255,0.36)',
    backgroundColor: 'rgba(255,255,255,0.075)',
    lineHeight: 21,
  },
  msgInputExpandedCompact: {
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: '#162235',
    borderColor: 'rgba(96,165,250,0.52)',
  },
  msgInputExpandedLight: {
    backgroundColor: '#ffffff',
    borderColor: '#9fc3ff',
  },
  msgInputExpandedCompactLight: {
    backgroundColor: '#ffffff',
    borderColor: '#7db2ff',
  },
  msgInputLight: {
    backgroundColor: '#f8fbff',
    borderColor: '#d7e2ef',
    color: '#0f172a',
  },
  msgInputCompact: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#1a2536',
    borderColor: '#334155',
    color: '#e5edf8',
    fontSize: 15,
  },
  msgInputCompactLight: {
    backgroundColor: '#f1f1f3',
    borderColor: '#dddddf',
    color: '#202124',
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
  msgSendBtnCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
  chatPlaceholderTitleLight: {
    color: '#0f172a',
  },
  chatPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4a6080',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 240,
  },
  chatPlaceholderTextLight: {
    color: '#64748b',
  },
});
