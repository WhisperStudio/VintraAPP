import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { onAuthStateChanged, reload, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthScreen, AuthAuroraBackdrop } from './index';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { VintraChatWidget } from '@/components/vintra-chat-widget';
import { WelcomeTutorial } from '@/components/welcome-tutorial';
import { firebaseAuth } from '@/lib/firebase';
import { LanguageProvider, useTranslation } from '@/lib/i18n';
import { ThemePreferenceProvider, useThemePreference, type ThemePreference } from '@/lib/theme-preference';

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootLayoutContent />
    </ThemePreferenceProvider>
  );
}

function RootLayoutContent() {
  const { colorScheme, ready: themeReady, savedTheme, setTheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@vintra_onboarded')
      .then((val) => setOnboarded(val === 'true'))
      .catch(() => setOnboarded(false));
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      // Refresh the user's emailVerified status — the initial auth state may
      // carry a stale ID token where emailVerified is still false.
      if (currentUser) {
        reload(currentUser)
          .then(() => setUser(firebaseAuth.currentUser))
          .catch(() => {});
      }
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

  // Never keep saved credentials for an unverified account, so stale sessions
  // from older builds can't auto-login into a broken, access-less state.
  useEffect(() => {
    if (authReady && user && !user.emailVerified) {
      AsyncStorage.removeItem('@vintra_creds').catch(() => {});
    }
  }, [authReady, user]);

  // Only treat a user as logged in once their email is verified. This mirrors
  // the website and prevents freshly-registered (unverified) accounts from being
  // dropped into a broken, access-less dashboard.
  const isLoggedIn = authReady && themeReady && !!user && !!user.emailVerified;
  const showThemePrompt = isLoggedIn && !savedTheme;
  const showTutorial = isLoggedIn && !!savedTheme && onboarded === false;
  const tutorialName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';

  const chooseTheme = (theme: ThemePreference) => {
    setTheme(theme).catch(() => {});
  };

  const finishTutorial = () => {
    setOnboarded(true);
    AsyncStorage.setItem('@vintra_onboarded', 'true').catch(() => {});
  };

  return (
    <LanguageProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {!authReady || !themeReady ? (
        <View style={[styles.loadingScreen, { backgroundColor: colorScheme === 'dark' ? '#040a17' : '#f5f8fc' }]}>
          <ActivityIndicator color="#15b89a" size="large" />
        </View>
      ) : isLoggedIn ? (
        <>
          <AppTabs />
          <ThemeChoiceModal visible={showThemePrompt} onChoose={chooseTheme} />
          <WelcomeTutorial visible={showTutorial} displayName={tutorialName} onDone={finishTutorial} />
        </>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#040a17' }}>
          <AuthAuroraBackdrop />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                padding: 20,
                paddingTop: Math.max(insets.top + 16, 34),
                paddingBottom: Math.max(insets.bottom + 72, 92),
              }}>
              <AuthScreen compact={compact} />
            </ScrollView>
          </KeyboardAvoidingView>
          <VintraChatWidget />
        </View>
      )}
    </ThemeProvider>
    </LanguageProvider>
  );
}

function ThemeChoiceModal({ visible, onChoose }: { visible: boolean; onChoose: (theme: ThemePreference) => void }) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.themeOverlay}>
      <View style={styles.themeCard}>
        <Text style={styles.themeTitle}>{t('theme_prompt_title')}</Text>
        <Text style={styles.themeLead}>{t('theme_prompt_lead')}</Text>
        <View style={styles.themeOptions}>
          <Pressable onPress={() => onChoose('light')} style={({ pressed }) => [styles.themeOption, pressed && styles.pressed]}>
            <View style={[styles.themePreview, styles.themePreviewLight]}>
              <View style={[styles.themePreviewLine, { backgroundColor: '#0f172a' }]} />
              <View style={[styles.themePreviewLineSmall, { backgroundColor: '#64748b' }]} />
            </View>
            <Text style={styles.themeOptionTitle}>Light mode</Text>
          </Pressable>
          <Pressable onPress={() => onChoose('dark')} style={({ pressed }) => [styles.themeOption, styles.themeOptionDark, pressed && styles.pressed]}>
            <View style={[styles.themePreview, styles.themePreviewDark]}>
              <View style={[styles.themePreviewLine, { backgroundColor: '#ffffff' }]} />
              <View style={[styles.themePreviewLineSmall, { backgroundColor: '#94a3b8' }]} />
            </View>
            <Text style={[styles.themeOptionTitle, styles.themeOptionTitleDark]}>Dark mode</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 24,
    zIndex: 100,
  },
  themeCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  themeTitle: {
    color: '#0f172a',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  themeLead: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    minHeight: 138,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ef',
    justifyContent: 'space-between',
  },
  themeOptionDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  themePreview: {
    height: 70,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'flex-end',
    gap: 8,
  },
  themePreviewLight: {
    backgroundColor: '#ffffff',
  },
  themePreviewDark: {
    backgroundColor: '#020617',
  },
  themePreviewLine: {
    width: '70%',
    height: 8,
    borderRadius: 8,
  },
  themePreviewLineSmall: {
    width: '48%',
    height: 7,
    borderRadius: 8,
  },
  themeOptionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  themeOptionTitleDark: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.72,
  },
});
