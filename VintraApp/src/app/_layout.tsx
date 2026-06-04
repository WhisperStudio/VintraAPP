import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthScreen } from './index';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { VintraChatWidget } from '@/components/vintra-chat-widget';
import { firebaseAuth } from '@/lib/firebase';
import { LanguageProvider } from '@/lib/i18n';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);
  const [authReady, setAuthReady] = useState(false);

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

  const isLoggedIn = authReady && !!user;

  return (
    <LanguageProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {!authReady ? (
        <View style={{ flex: 1, backgroundColor: '#06111f', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#ffffff" size="large" />
        </View>
      ) : isLoggedIn ? (
        <AppTabs />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#06111f' }}>
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
