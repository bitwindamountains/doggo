import { Redirect, Tabs } from 'expo-router';

import { useApp } from '@/components/AppProvider';
import { t } from '@/copy';
import { useDogStore } from '@/store/dogStore';

export default function TabsLayout() {
  const { ready } = useApp();
  const onboarded = useDogStore((s) => !!s.prefs?.onboardedAt && !!s.dog);
  if (!ready) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('ui.tab.home') }} />
      <Tabs.Screen name="progress" options={{ title: t('ui.progress.title') }} />
      <Tabs.Screen name="settings" options={{ title: t('ui.settings.title') }} />
    </Tabs>
  );
}
