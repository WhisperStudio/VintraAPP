import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark';

const THEME_KEY = '@vintra_theme_preference';

type ThemePreferenceContextValue = {
  colorScheme: ThemePreference;
  savedTheme: ThemePreference | null;
  ready: boolean;
  setTheme: (theme: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  colorScheme: 'light',
  savedTheme: null,
  ready: false,
  setTheme: async () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const nativeScheme = useNativeColorScheme();
  const [ready, setReady] = useState(false);
  const [savedTheme, setSavedTheme] = useState<ThemePreference | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark') {
          setSavedTheme(value);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setTheme = useCallback(async (theme: ThemePreference) => {
    setSavedTheme(theme);
    await AsyncStorage.setItem(THEME_KEY, theme);
  }, []);

  const colorScheme = savedTheme ?? (nativeScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo(
    () => ({ colorScheme, savedTheme, ready, setTheme }),
    [colorScheme, ready, savedTheme, setTheme],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
