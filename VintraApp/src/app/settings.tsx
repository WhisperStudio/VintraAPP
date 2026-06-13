import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View, Pressable, Alert } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTranslation, type RawLang } from '@/lib/i18n';
import { resolveAllAdminProfiles, fetchWidgets, type AdminProfile, type Widget } from '@/lib/admin-chat';
import { requestNotificationAccess } from '@/lib/notifications';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';
import {
  getDefaultQuickReplies,
  loadQuickReplies,
  loadQuickRepliesEnabled,
  saveQuickReplies,
  saveQuickRepliesEnabled,
  type QuickReply,
} from '@/lib/quick-replies';

function MovingBackground() {
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';
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
      <Animated.View style={[styles.topBand, isLight && styles.topBandLight, topBand]} />
      <Animated.View style={[styles.bottomBand, isLight && styles.bottomBandLight, bottomBand]} />
    </View>
  );
}

function SettingRow({ icon, label, description, value, onValueChange, iconBg = '#246cff' }: {
  icon: any;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  iconBg?: string;
}) {
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';

  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <SymbolView name={icon} size={20} tintColor="#ffffff" />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={[styles.settingLabel, isLight && styles.settingLabelLight]}>{label}</ThemedText>
        <ThemedText style={[styles.settingDescription, isLight && styles.settingDescriptionLight]}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isLight ? '#cbd5e1' : '#1d2736', true: '#03a84e' }}
        thumbColor="#ffffff"
        ios_backgroundColor="#1d2736"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const { t, lang, savedLang, setLang } = useTranslation();
  const { savedTheme, colorScheme, setTheme } = useThemePreference();
  const isLight = colorScheme === 'light';
  const [user, setUser] = useState<User | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [quickRepliesEnabled, setQuickRepliesEnabled] = useState(true);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => getDefaultQuickReplies(lang));
  const [expandedQuickReplyId, setExpandedQuickReplyId] = useState<string | null>('hello');

  type WidgetEntry = Widget & { businessId: string; businessName: string };
  const [allWidgets, setAllWidgets] = useState<WidgetEntry[]>([]);
  const [defaultWidgetKey, setDefaultWidgetKeyState] = useState<string>('');
  const [loadingWidgets, setLoadingWidgets] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notif = await AsyncStorage.getItem('@vintra_settings_notif');
        const sound = await AsyncStorage.getItem('@vintra_settings_sound');
        const vib = await AsyncStorage.getItem('@vintra_settings_vib');
        if (notif !== null) setNotificationsEnabled(notif === 'true');
        if (sound !== null) setSoundEnabled(sound === 'true');
        if (vib !== null) setVibrationEnabled(vib === 'true');
        setQuickRepliesEnabled(await loadQuickRepliesEnabled());
      } catch (e) {
        console.error('Error loading settings', e);
      }
    };
    loadSettings();
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    AsyncStorage.getItem('@vintra_default_widget').then(v => { if (v) setDefaultWidgetKeyState(v); }).catch(() => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    loadQuickReplies(lang).then(setQuickReplies).catch(() => setQuickReplies(getDefaultQuickReplies(lang)));
  }, [lang]);

  const toggleNotifications = async (val: boolean) => {
    if (val) {
      const result = await requestNotificationAccess().catch((error: unknown) => ({
        granted: false,
        message: error instanceof Error ? error.message : 'Could not enable notifications.',
      }));
      if (!result.granted) {
        Alert.alert(t('settings_notif_label'), result.message);
        setNotificationsEnabled(false);
        AsyncStorage.setItem('@vintra_settings_notif', 'false').catch(console.error);
        return;
      }
    }
    setNotificationsEnabled(val);
    AsyncStorage.setItem('@vintra_settings_notif', String(val)).catch(console.error);
  };
  const toggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    AsyncStorage.setItem('@vintra_settings_sound', String(val)).catch(console.error);
  };
  const toggleVibration = async (val: boolean) => {
    setVibrationEnabled(val);
    AsyncStorage.setItem('@vintra_settings_vib', String(val)).catch(console.error);
  };
  const toggleQuickReplies = async (val: boolean) => {
    setQuickRepliesEnabled(val);
    saveQuickRepliesEnabled(val).catch(console.error);
  };

  const updateQuickReply = (id: string, field: 'label' | 'value', value: string) => {
    const next = quickReplies.map(reply => (reply.id === id ? { ...reply, [field]: value } : reply));
    setQuickReplies(next);
    saveQuickReplies(lang, next).catch(console.error);
  };

  const addQuickReply = () => {
    const nextReply: QuickReply = {
      id: `custom-${Date.now()}`,
      label: t('settings_quick_replies_new_label'),
      value: t('settings_quick_replies_new_message'),
    };
    const next = [...quickReplies, nextReply];
    setQuickReplies(next);
    setExpandedQuickReplyId(nextReply.id);
    saveQuickReplies(lang, next).catch(console.error);
  };

  const removeQuickReply = (id: string) => {
    const next = quickReplies.filter(reply => reply.id !== id);
    setQuickReplies(next);
    if (expandedQuickReplyId === id) {
      setExpandedQuickReplyId(next[0]?.id ?? null);
    }
    saveQuickReplies(lang, next).catch(console.error);
  };

  const resetQuickReplies = () => {
    const defaults = getDefaultQuickReplies(lang);
    setQuickReplies(defaults);
    setExpandedQuickReplyId(defaults[0]?.id ?? null);
    saveQuickReplies(lang, defaults).catch(console.error);
  };

  // Load chatbots when user signs in
  useEffect(() => {
    if (!user) { setAllWidgets([]); return; }
    setLoadingWidgets(true);
    resolveAllAdminProfiles(user)
      .then(async (profiles: AdminProfile[]) => {
        const entries: WidgetEntry[] = [];
        for (const profile of profiles) {
          const ws = await fetchWidgets(profile.businessId);
          for (const w of ws) {
            entries.push({ ...w, businessId: profile.businessId, businessName: profile.businessName || profile.businessId });
          }
        }
        setAllWidgets(entries);
      })
      .catch(() => {})
      .finally(() => setLoadingWidgets(false));
  }, [user?.uid]);

  async function setDefaultWidget(key: string) {
    const next = key === defaultWidgetKey ? '' : key;
    setDefaultWidgetKeyState(next);
    if (next) {
      await AsyncStorage.setItem('@vintra_default_widget', next).catch(() => {});
    } else {
      await AsyncStorage.removeItem('@vintra_default_widget').catch(() => {});
    }
  }

  async function handleSignOut() {
    Alert.alert(
      t('settings_sign_out_title'),
      t('settings_sign_out_msg'),
      [
        { text: t('settings_cancel'), style: 'cancel' },
        {
          text: t('settings_log_out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@vintra_creds');
              await signOut(firebaseAuth);
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ],
    );
  }

  const langOptions: { key: RawLang; label: () => string }[] = [
    { key: 'auto', label: () => t('settings_lang_auto') },
    { key: 'en',   label: () => t('settings_lang_en') },
    { key: 'no',   label: () => t('settings_lang_no') },
  ];
  const themeOptions: { key: ThemePreference; label: () => string; icon: any }[] = [
    { key: 'light', label: () => t('settings_theme_light'), icon: { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' } },
    { key: 'dark', label: () => t('settings_theme_dark'), icon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' } },
  ];
  const activeTheme = savedTheme ?? colorScheme;

  return (
    <ThemedView style={[styles.container, isLight && styles.containerLight]}>
      <MovingBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <View style={styles.center}>
          <View style={[styles.iconBox, isLight && styles.iconBoxLight]}>
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={28} tintColor="#ffffff" />
          </View>
          <ThemedText style={[styles.title, isLight && styles.titleLight, compact && styles.titleCompact]}>{t('settings_title')}</ThemedText>
          <ThemedText style={[styles.lead, isLight && styles.leadLight]}>{t('settings_lead')}</ThemedText>
        </View>

        {/* Notifications */}
        <View style={[styles.panel, isLight && styles.panelLight]}>
          <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>{t('settings_section_notif')}</ThemedText>
          <View style={[styles.divider, isLight && styles.dividerLight]} />
          <SettingRow
            icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            iconBg="#3b82f6"
            label={t('settings_notif_label')}
            description={t('settings_notif_desc')}
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
          />
          <SettingRow
            icon={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
            iconBg="#03a84e"
            label={t('settings_sound_label')}
            description={t('settings_sound_desc')}
            value={soundEnabled}
            onValueChange={toggleSound}
          />
          <SettingRow
            icon={{ ios: 'iphone.radiowaves.left.and.right', android: 'vibration', web: 'vibration' }}
            iconBg="#8b5cf6"
            label={t('settings_vib_label')}
            description={t('settings_vib_desc')}
            value={vibrationEnabled}
            onValueChange={toggleVibration}
          />
        </View>

        {/* Appearance */}
        <View style={[styles.panel, isLight && styles.panelLight]}>
          <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>{t('settings_section_appearance')}</ThemedText>
          <View style={[styles.divider, isLight && styles.dividerLight]} />
          <View style={styles.langOptions}>
            {themeOptions.map(opt => {
              const active = activeTheme === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setTheme(opt.key).catch(console.error)}
                  style={({ pressed }) => [
                    styles.langOption,
                    isLight && styles.langOptionLight,
                    active && styles.langOptionActive,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.themeOptionLeft}>
                    <SymbolView
                      name={opt.icon}
                      size={16}
                      tintColor={active ? '#03a84e' : '#9fb1ce'}
                    />
                    <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>
                      {opt.label()}
                    </Text>
                  </View>
                  {active && (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={14}
                      tintColor="#03a84e"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Language */}
        <View style={[styles.panel, isLight && styles.panelLight]}>
          <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>{t('settings_section_lang')}</ThemedText>
          <View style={[styles.divider, isLight && styles.dividerLight]} />
          <View style={styles.langOptions}>
            {langOptions.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={({ pressed }) => [
                  styles.langOption,
                  isLight && styles.langOptionLight,
                  savedLang === opt.key && styles.langOptionActive,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.langOptionText, savedLang === opt.key && styles.langOptionTextActive]}>
                  {opt.label()}
                </Text>
                {savedLang === opt.key && (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={14}
                    tintColor="#03a84e"
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick replies */}
        <View style={[styles.panel, isLight && styles.panelLight]}>
          <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>{t('settings_section_quick_replies')}</ThemedText>
          <View style={styles.headerActions}>
            <Pressable onPress={resetQuickReplies} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
              <Text style={styles.resetButtonText}>{t('settings_quick_replies_reset')}</Text>
            </Pressable>
            <Pressable onPress={addQuickReply} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={14} tintColor="#ffffff" />
              <Text style={styles.addButtonText}>{t('settings_quick_replies_add')}</Text>
            </Pressable>
          </View>
          <View style={[styles.divider, isLight && styles.dividerLight]} />
          <SettingRow
            icon={{ ios: 'text.bubble.fill', android: 'quickreply', web: 'quickreply' }}
            iconBg="#0f6eff"
            label={t('settings_quick_replies_label')}
            description={t('settings_quick_replies_desc')}
            value={quickRepliesEnabled}
            onValueChange={toggleQuickReplies}
          />
          <View style={styles.quickReplyDropdownList}>
            {quickReplies.map((reply, index) => {
              const expanded = expandedQuickReplyId === reply.id;
              return (
                <View key={reply.id} style={[styles.quickReplyDropdown, isLight && styles.quickReplyDropdownLight, expanded && styles.quickReplyDropdownOpen]}>
                  <Pressable
                    onPress={() => setExpandedQuickReplyId(expanded ? null : reply.id)}
                    style={({ pressed }) => [styles.quickReplyDropdownHeader, pressed && styles.pressed]}>
                    <View style={styles.quickReplyHeaderLeft}>
                      <Text style={styles.quickReplyNumber}>{index + 1}</Text>
                      <View style={styles.quickReplyHeaderCopy}>
                        <Text style={[styles.quickReplyTitle, isLight && styles.quickReplyTitleLight]} numberOfLines={1}>{reply.label}</Text>
                        <Text style={[styles.quickReplyPreview, isLight && styles.quickReplyPreviewLight]} numberOfLines={1}>{reply.value}</Text>
                      </View>
                    </View>
                    <SymbolView
                      name={{ ios: expanded ? 'chevron.up' : 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                      size={16}
                      tintColor="#9fb1ce"
                    />
                  </Pressable>
                  {expanded && (
                    <View style={styles.quickReplyFields}>
                      <View style={styles.quickReplyEditHeader}>
                        <Text style={[styles.quickReplyEditTitle, isLight && styles.quickReplyEditTitleLight]}>{t('settings_quick_replies_message_label')}</Text>
                        <Pressable
                          onPress={() => removeQuickReply(reply.id)}
                          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={13} tintColor="#fca5a5" />
                          <Text style={styles.removeButtonText}>{t('settings_quick_replies_remove')}</Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>{t('settings_quick_replies_chip_label')}</Text>
                      <TextInput
                        value={reply.label}
                        onChangeText={(value) => updateQuickReply(reply.id, 'label', value)}
                        placeholderTextColor="#52657f"
                        style={[styles.quickReplyInput, isLight && styles.quickReplyInputLight]}
                      />
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>{t('settings_quick_replies_message_label')}</Text>
                      <TextInput
                        multiline
                        value={reply.value}
                        onChangeText={(value) => updateQuickReply(reply.id, 'value', value)}
                        placeholderTextColor="#52657f"
                        style={[styles.quickReplyInput, isLight && styles.quickReplyInputLight, styles.quickReplyMessageInput]}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Chatbots */}
        {(loadingWidgets || allWidgets.length > 0) && (
          <View style={[styles.panel, isLight && styles.panelLight]}>
            <View style={styles.chatbotSectionHeader}>
              <View>
                <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>Inbox chatbot</ThemedText>
                <ThemedText style={[styles.chatbotSectionLead, isLight && styles.chatbotSectionLeadLight]}>
                  Choose which chatbot the admin inbox should show.
                </ThemedText>
              </View>
              <View style={[styles.chatbotActivePill, isLight && styles.chatbotActivePillLight]}>
                <Text style={[styles.chatbotActivePillText, isLight && styles.chatbotActivePillTextLight]}>
                  {defaultWidgetKey ? 'Focused' : 'All'}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, isLight && styles.dividerLight]} />
            {loadingWidgets ? (
              <ActivityIndicator color="#0f6eff" style={{ paddingVertical: 14 }} />
            ) : (
              <View style={styles.chatbotChoiceList}>
                <Pressable
                  onPress={() => setDefaultWidget('')}
                  style={({ pressed }) => [
                    styles.chatbotChoice,
                    isLight && styles.chatbotChoiceLight,
                    !defaultWidgetKey && styles.chatbotChoiceActive,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.chatbotChoiceIcon, { backgroundColor: '#0f6eff' }]}>
                    <SymbolView
                      name={{ ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }}
                      size={18}
                      tintColor="#ffffff"
                    />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.chatbotChoiceTitle, isLight && styles.chatbotChoiceTitleLight]}>All chatbots</Text>
                    <Text style={[styles.chatbotChoiceMeta, isLight && styles.chatbotChoiceMetaLight]}>
                      Show every support conversation in one inbox.
                    </Text>
                  </View>
                  {!defaultWidgetKey && (
                    <View style={styles.chatbotCheck}>
                      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor="#ffffff" />
                    </View>
                  )}
                </Pressable>

                {allWidgets.map((w) => {
                  const isDefault = defaultWidgetKey === w.key;
                  return (
                  <Pressable
                    key={w.key}
                    onPress={() => setDefaultWidget(w.key)}
                    style={({ pressed }) => [
                      styles.chatbotChoice,
                      isLight && styles.chatbotChoiceLight,
                      isDefault && styles.chatbotChoiceActive,
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.chatbotChoiceIcon, { backgroundColor: isDefault ? '#03a84e' : '#7c3aed' }]}>
                      <SymbolView
                        name={{ ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' }}
                        size={18}
                        tintColor="#ffffff"
                      />
                    </View>
                    <View style={styles.settingContent}>
                      <Text style={[styles.chatbotChoiceTitle, isLight && styles.chatbotChoiceTitleLight]}>{w.name}</Text>
                      <Text style={[styles.chatbotChoiceMeta, isLight && styles.chatbotChoiceMetaLight]}>{w.businessName}</Text>
                    </View>
                    {isDefault && (
                      <View style={styles.chatbotCheck}>
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={14}
                          tintColor="#ffffff"
                        />
                      </View>
                    )}
                  </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Account */}
        {user ? (
          <View style={[styles.panel, isLight && styles.panelLight]}>
            <ThemedText style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>{t('settings_section_account')}</ThemedText>
            <View style={[styles.divider, isLight && styles.dividerLight]} />
            <View style={styles.accountInfo}>
              <View style={styles.accountAvatar}>
                <ThemedText style={styles.avatarText}>
                  {(user.displayName || user.email || 'A').slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <View>
                <ThemedText style={[styles.accountName, isLight && styles.accountNameLight]}>{user.displayName || t('settings_agent_name')}</ThemedText>
                <ThemedText style={[styles.accountEmail, isLight && styles.accountEmailLight]}>{user.email}</ThemedText>
              </View>
            </View>
            <View style={[styles.divider, isLight && styles.dividerLight]} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
              <View style={[styles.settingIcon, { backgroundColor: '#ef4444' }]}>
                <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={20} tintColor="#ffffff" />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.logoutText}>{t('settings_sign_out')}</ThemedText>
                <ThemedText style={[styles.settingDescription, isLight && styles.settingDescriptionLight]}>{t('settings_sign_out_desc')}</ThemedText>
              </View>
            </Pressable>
          </View>
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
  containerLight: {
    backgroundColor: '#f4f8fc',
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
  topBandLight: {
    backgroundColor: 'rgba(15,110,255,0.08)',
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
  bottomBandLight: {
    backgroundColor: 'rgba(3,168,78,0.10)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
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
  iconBoxLight: {
    backgroundColor: '#0f6eff',
    borderColor: '#8db8ff',
  },
  title: {
    color: '#ffffff',
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleLight: {
    color: '#0f172a',
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
  leadLight: {
    color: '#475569',
  },
  panel: {
    borderRadius: 24,
    padding: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.three,
  },
  panelLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: '#dce7f3',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionTitleLight: {
    color: '#0f172a',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  settingLabelLight: {
    color: '#0f172a',
  },
  settingDescription: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  settingDescriptionLight: {
    color: '#64748b',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#03a84e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  accountName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  accountNameLight: {
    color: '#0f172a',
  },
  accountEmail: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  accountEmailLight: {
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: Spacing.one,
  },
  dividerLight: {
    backgroundColor: '#dce7f3',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  langOptions: {
    gap: 6,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  langOptionLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dce7f3',
  },
  langOptionActive: {
    borderColor: 'rgba(3,168,78,0.35)',
    backgroundColor: 'rgba(3,168,78,0.08)',
  },
  langOptionText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
  },
  langOptionTextActive: {
    color: '#ffffff',
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    minHeight: 34,
    flexGrow: 1,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resetButtonText: {
    color: '#9fb1ce',
    fontSize: 12,
    fontWeight: '800',
  },
  addButton: {
    minHeight: 34,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0f6eff',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  quickReplyDropdownList: {
    gap: 8,
  },
  quickReplyDropdown: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  quickReplyDropdownLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dce7f3',
  },
  quickReplyDropdownOpen: {
    backgroundColor: 'rgba(15,110,255,0.055)',
    borderColor: 'rgba(15,110,255,0.2)',
  },
  quickReplyDropdownHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: 12,
  },
  quickReplyHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickReplyNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,110,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.28)',
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 26,
    textAlign: 'center',
  },
  quickReplyHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickReplyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  quickReplyTitleLight: {
    color: '#0f172a',
  },
  quickReplyPreview: {
    color: '#7d91ae',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  quickReplyPreviewLight: {
    color: '#64748b',
  },
  quickReplyFields: {
    gap: 7,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  quickReplyEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 2,
  },
  quickReplyEditTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  quickReplyEditTitleLight: {
    color: '#0f172a',
  },
  removeButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
  },
  removeButtonText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  inputLabel: {
    color: '#9fb1ce',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  inputLabelLight: {
    color: '#64748b',
  },
  quickReplyInput: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickReplyInputLight: {
    backgroundColor: '#f8fbff',
    borderColor: '#d7e2ef',
    color: '#0f172a',
  },
  quickReplyMessageInput: {
    minHeight: 76,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  chatbotSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  chatbotSectionLead: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 6,
    maxWidth: 360,
  },
  chatbotSectionLeadLight: {
    color: '#64748b',
  },
  chatbotActivePill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,110,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(15,110,255,0.28)',
  },
  chatbotActivePillLight: {
    backgroundColor: '#e8f1ff',
    borderColor: '#b8d2ff',
  },
  chatbotActivePillText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chatbotActivePillTextLight: {
    color: '#0f4ca5',
  },
  chatbotChoiceList: {
    gap: 10,
  },
  chatbotChoice: {
    minHeight: 74,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatbotChoiceLight: {
    backgroundColor: '#ffffff',
    borderColor: '#dce7f3',
  },
  chatbotChoiceActive: {
    borderColor: '#0f6eff',
    backgroundColor: 'rgba(15,110,255,0.10)',
  },
  chatbotChoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatbotChoiceTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  chatbotChoiceTitleLight: {
    color: '#0f172a',
  },
  chatbotChoiceMeta: {
    color: '#9fb1ce',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  chatbotChoiceMetaLight: {
    color: '#64748b',
  },
  chatbotCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f6eff',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(3,168,78,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(3,168,78,0.25)',
  },
  defaultBadgeText: {
    color: '#03a84e',
    fontSize: 11,
    fontWeight: '800',
  },
});
