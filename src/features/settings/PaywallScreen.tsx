// Paywall (PRD F12). Premium is cosmetics and features only, never the dog's wellbeing.
// Real products and pricing come with RevenueCat in M9.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { useEntitlement } from '@/services/purchases/useEntitlement';

import { scheduleTrialReminder } from './trialReminder';

// Cancel instructions one tap away (PRD F12): the store's own subscription page.
const SUBSCRIPTIONS_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export function PaywallScreen() {
  const router = useRouter();
  const { db, services, now } = useApp();
  const premium = useEntitlement('premium');
  const [bought, setBought] = useState(false);
  const active = premium || bought;
  return (
    <Screen title={t('ui.paywall.title')}>
      <Text style={styles.body}>{t('ui.paywall.body')}</Text>
      {active ? (
        <Text style={styles.body}>{t('ui.paywall.active')}</Text>
      ) : (
        <Button
          label={t('ui.paywall.trial')}
          onPress={async () => {
            setBought(await services.purchases.purchase('annual'));
            await scheduleTrialReminder(services, db, now());
          }}
        />
      )}
      <Button
        kind="secondary"
        label={t('ui.paywall.restore')}
        onPress={async () => {
          setBought((await services.purchases.restore()).premium);
          await scheduleTrialReminder(services, db, now());
        }}
      />
      <Text style={styles.hint}>{t('ui.paywall.cancelInfo')}</Text>
      <Button
        kind="secondary"
        label={t('ui.paywall.manage')}
        onPress={() => Linking.openURL(SUBSCRIPTIONS_URL)}
      />
      <Button kind="secondary" label={t('ui.common.done')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  hint: { fontSize: 14, color: colors.inkSoft },
});
