import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
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
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

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

function SettingRow({ icon, label, description, value, onValueChange }: {
  icon: any;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <SymbolView name={icon} size={20} tintColor="#ffffff" />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
        <ThemedText style={styles.settingDescription}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#2d3a4d', true: '#03a84e' }}
        thumbColor="#ffffff"
        ios_backgroundColor="#2d3a4d"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [user, setUser] = useState<User | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleSignOut() {
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

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
            <SymbolView name={{ ios: 'gearshape.2.fill', android: 'settings', web: 'settings' }} size={28} tintColor="#ffffff" />
          </View>
          <ThemedText style={[styles.title, compact && styles.titleCompact]}>Innstillinger</ThemedText>
          <ThemedText style={styles.lead}>
            Tilpass notifikasjoner og lyd for support-varsler.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.panel}>
          <ThemedText style={styles.sectionTitle}>Varsler</ThemedText>
          
          <SettingRow
            icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            label="Notifikasjoner"
            description="Varsler når noen ber om menneskelig support"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          
          <SettingRow
            icon={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
            label="Lydvarsler"
            description="Avspill lyd når ny melding kommer"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
          />
          
          <SettingRow
            icon={{ ios: 'iphone.gen2', android: 'vibration', web: 'vibration' }}
            label="Vibrasjon"
            description="Vibrer når ny melding kommer"
            value={vibrationEnabled}
            onValueChange={setVibrationEnabled}
          />
        </Animated.View>

        {user ? (
          <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.panel}>
            <ThemedText style={styles.sectionTitle}>Konto</ThemedText>
            <View style={styles.accountInfo}>
              <View style={styles.accountAvatar}>
                <ThemedText style={styles.avatarText}>{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.accountName}>{user.displayName || 'Admin'}</ThemedText>
                <ThemedText style={styles.accountEmail}>{user.email}</ThemedText>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.actionRow}>
              <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={20} tintColor="#ef4444" />
              <ThemedText style={styles.logoutText} onPress={handleSignOut}>Logg ut</ThemedText>
            </View>
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
  panel: {
    borderRadius: 28,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: Spacing.three,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#246cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  settingDescription: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  accountAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#03a84e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  accountName: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  accountEmail: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
});
