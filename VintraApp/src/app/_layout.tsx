import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { VintraChatWidget } from '@/components/vintra-chat-widget';
import { firebaseAuth } from '@/lib/firebase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (user) => {
      setLoggedIn(!!user);
    });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
      {!loggedIn && <VintraChatWidget />}
    </ThemeProvider>
  );
}
