// "Your data" (PRD F13): plain-language storage summary and delete-all.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { deleteAllData } from '@/data';
import { useDraft, DEFAULT_DRAFT } from '@/features/onboarding/draft';

export function DataScreen() {
  const router = useRouter();
  const { db, services, refresh } = useApp();
  const [confirming, setConfirming] = useState(false);

  const deleteAll = async () => {
    deleteAllData(db);
    await services.notifications.replaceSchedule([]);
    useDraft.getState().update(DEFAULT_DRAFT);
    await refresh(false);
    router.replace('/welcome');
  };

  return (
    <Screen title={t('ui.data.title')}>
      <Text style={styles.body}>{t('ui.data.onPhone')}</Text>
      <Text style={styles.body}>{t('ui.data.synced')}</Text>
      <Text style={styles.credit}>{t('ui.data.credits')}</Text>
      {confirming ? (
        <>
          <Text style={styles.body}>{t('ui.data.confirm')}</Text>
          <Button label={t('ui.data.confirmYes')} onPress={deleteAll} />
          <Button
            kind="secondary"
            label={t('ui.common.cancel')}
            onPress={() => setConfirming(false)}
          />
        </>
      ) : (
        <Button kind="secondary" label={t('ui.data.delete')} onPress={() => setConfirming(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  credit: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
});
