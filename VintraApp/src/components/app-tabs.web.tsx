import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { firebaseAuth } from '@/lib/firebase';
import { useTranslation } from '@/lib/i18n';
import { useThemePreference } from '@/lib/theme-preference';

export default function AppTabs() {
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const isSuperAdmin = user?.email?.toLowerCase() === 'vintrastudio@gmail.com';

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}>{t('tab_home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon={{ ios: 'chart.xyaxis.line', android: 'monitoring', web: 'monitoring' }}>{t('tab_analyse')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}>{t('tab_settings')}</TabButton>
          </TabTrigger>
          {isSuperAdmin && (
            <TabTrigger name="notifications" href={'/notifications' as Href} asChild>
              <TabButton icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}>Notifications</TabButton>
            </TabTrigger>
          )}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: React.ComponentProps<typeof SymbolView>['name'] }) {
  const { colorScheme } = useThemePreference();
  const activeColor = '#159750';
  const inactiveColor = colorScheme === 'light' ? '#64748b' : '#94a3b8';

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabPressable, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.tabButtonView,
          isFocused && (colorScheme === 'light' ? styles.tabButtonViewActiveLight : styles.tabButtonViewActiveDark),
        ]}>
        <SymbolView name={icon} size={17} tintColor={isFocused ? activeColor : inactiveColor} />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'} style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { colorScheme } = useThemePreference();

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.innerContainer,
          colorScheme === 'light' ? styles.innerContainerLight : styles.innerContainerDark,
        ]}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    maxWidth: Math.min(MaxContentWidth, 520),
    borderWidth: 1,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  innerContainerLight: {
    borderColor: '#dce7f3',
    shadowColor: '#0f172a',
  },
  innerContainerDark: {
    borderColor: '#263346',
    shadowColor: '#000000',
  },
  pressed: {
    opacity: 0.7,
  },
  tabPressable: {
    flex: 1,
  },
  tabButtonView: {
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabButtonViewActiveLight: {
    backgroundColor: '#e8f5ee',
  },
  tabButtonViewActiveDark: {
    backgroundColor: '#183326',
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#159750',
    fontWeight: '900',
  },
});
