import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View, Pressable, Alert } from 'react-native';
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

function SettingRow({ icon, label, description, value, onValueChange, iconBg = '#246cff' }: {
  icon: any;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  iconBg?: string;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <SymbolView name={icon} size={20} tintColor="#ffffff" />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
        <ThemedText style={styles.settingDescription}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#1d2736', true: '#03a84e' }}
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
  const { t, savedLang, setLang } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

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
      } catch (e) {
        console.error('Error loading settings', e);
      }
    };
    loadSettings();
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    AsyncStorage.getItem('@vintra_default_widget').then(v => { if (v) setDefaultWidgetKeyState(v); }).catch(() => {});
    return () => unsub();
  }, []);

  const toggleNotifications = async (val: boolean) => {
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

  return (
    <ThemedView style={styles.container}>
      <MovingBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <View style={styles.center}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={28} tintColor="#ffffff" />
          </View>
          <ThemedText style={[styles.title, compact && styles.titleCompact]}>{t('settings_title')}</ThemedText>
          <ThemedText style={styles.lead}>{t('settings_lead')}</ThemedText>
        </View>

        {/* Notifications */}
        <View style={styles.panel}>
          <ThemedText style={styles.sectionTitle}>{t('settings_section_notif')}</ThemedText>
          <View style={styles.divider} />
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

        {/* Language */}
        <View style={styles.panel}>
          <ThemedText style={styles.sectionTitle}>{t('settings_section_lang')}</ThemedText>
          <View style={styles.divider} />
          <View style={styles.langOptions}>
            {langOptions.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={({ pressed }) => [
                  styles.langOption,
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

        {/* Chatbots */}
        {(loadingWidgets || allWidgets.length > 0) && (
          <View style={styles.panel}>
            <ThemedText style={styles.sectionTitle}>Chatbots</ThemedText>
            <View style={styles.divider} />
            {loadingWidgets ? (
              <ActivityIndicator color="#0f6eff" style={{ paddingVertical: 14 }} />
            ) : (
              allWidgets.map((w) => {
                const isDefault = defaultWidgetKey === w.key;
                return (
                  <Pressable
                    key={w.key}
                    onPress={() => setDefaultWidget(w.key)}
                    style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <View style={[styles.settingIcon, { backgroundColor: isDefault ? '#03a84e' : '#7c3aed' }]}>
                      <SymbolView
                        name={{ ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' }}
                        size={20}
                        tintColor="#ffffff"
                      />
                    </View>
                    <View style={styles.settingContent}>
                      <ThemedText style={styles.settingLabel}>{w.name}</ThemedText>
                      <ThemedText style={styles.settingDescription}>{w.businessName}</ThemedText>
                    </View>
                    {isDefault && (
                      <View style={styles.defaultBadge}>
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          size={14}
                          tintColor="#03a84e"
                        />
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* Account */}
        {user ? (
          <View style={styles.panel}>
            <ThemedText style={styles.sectionTitle}>{t('settings_section_account')}</ThemedText>
            <View style={styles.divider} />
            <View style={styles.accountInfo}>
              <View style={styles.accountAvatar}>
                <ThemedText style={styles.avatarText}>
                  {(user.displayName || user.email || 'A').slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <View>
                <ThemedText style={styles.accountName}>{user.displayName || t('settings_agent_name')}</ThemedText>
                <ThemedText style={styles.accountEmail}>{user.email}</ThemedText>
              </View>
            </View>
            <View style={styles.divider} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
              <View style={[styles.settingIcon, { backgroundColor: '#ef4444' }]}>
                <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={20} tintColor="#ffffff" />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.logoutText}>{t('settings_sign_out')}</ThemedText>
                <ThemedText style={styles.settingDescription}>{t('settings_sign_out_desc')}</ThemedText>
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
  panel: {
    borderRadius: 24,
    padding: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.three,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
  settingDescription: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
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
  accountEmail: {
    color: '#9fb1ce',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: Spacing.one,
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
