import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { regionFor, SUPPORT_RESOURCES } from '@/config/supportResources';
import { t } from '@/copy';
import { useDogStore } from '@/store/dogStore';

export function SupportScreen() {
  const timezone = useDogStore((s) => s.prefs?.timezone ?? 'Asia/Manila');
  const list = SUPPORT_RESOURCES[regionFor(timezone)];
  return (
    <Screen title={t('ui.support.title')}>
      <Text style={styles.body}>{t('ui.support.body')}</Text>
      {list.map((r) => (
        <View key={r.name} style={styles.card}>
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.body}>{r.detail}</Text>
          {r.phone ? (
            <Button
              kind="secondary"
              label={t('ui.support.call', { name: r.name })}
              onPress={() => Linking.openURL(`tel:${r.phone}`)}
            />
          ) : null}
          {r.sms ? (
            <Button
              kind="secondary"
              label={r.detail}
              onPress={() =>
                Linking.openURL(`sms:${r.sms?.to}?body=${encodeURIComponent(r.sms?.body ?? '')}`)
              }
            />
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 4 },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
});
