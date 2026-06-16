import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { firebaseAuth } from '@/lib/firebase';
import { useTabsHidden } from '@/lib/tab-visibility';
import { useThemePreference } from '@/lib/theme-preference';

export default function AppTabs() {
  const tabsHidden = useTabsHidden();
  const { colorScheme } = useThemePreference();
  const isLight = colorScheme === 'light';
  const tabTheme = {
    background: isLight ? '#ffffff' : '#111827',
    indicator: isLight ? '#e8f5ee' : '#183326',
    active: '#159750',
    inactive: isLight ? '#64748b' : '#94a3b8',
    shadow: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(0,0,0,0.45)',
    badge: '#ef4444',
  };
  const { t } = useTranslation();
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return unsub;
  }, []);

  const isSuperAdmin = user?.email?.toLowerCase() === 'vintrastudio@gmail.com';

  return (
    <NativeTabs
      backgroundColor={tabTheme.background}
      badgeBackgroundColor={tabTheme.badge}
      iconColor={{ default: tabTheme.inactive, selected: tabTheme.active }}
      indicatorColor={tabTheme.indicator}
      shadowColor={tabTheme.shadow}
      hidden={tabsHidden}
      tintColor={tabTheme.active}
      labelStyle={{
        default: { color: tabTheme.inactive, fontSize: 11, fontWeight: '700' },
        selected: { color: tabTheme.active, fontSize: 11, fontWeight: '800' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tab_home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="bubble.left.and.bubble.right.fill"
          md="forum"
          src={require('../../assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>{t('tab_analyse')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="chart.xyaxis.line"
          md="monitoring"
          src={require('../../assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {isSuperAdmin && (
        <NativeTabs.Trigger name="notifications">
          <NativeTabs.Trigger.Label>Notifications</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="bell.fill"
            md="notifications"
            src={require('../../assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('tab_settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="gearshape.fill"
          md="settings"
          src={require('../../assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
