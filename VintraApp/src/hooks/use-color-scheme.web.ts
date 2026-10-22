import { useThemePreference } from '@/lib/theme-preference';

// Use the same saved theme as the rest of the app. The provider handles loading.
export function useColorScheme() {
  return useThemePreference().colorScheme;
}
