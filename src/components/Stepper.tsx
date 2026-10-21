import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/copy';

import { Button } from './Button';
import { colors } from './theme';

interface Props {
  label: string;
  value: string;
  onLess(): void;
  onMore(): void;
  lessLabel?: string;
  moreLabel?: string;
}

/** A labeled value with − / + buttons (no extra picker dependency). */
export function Stepper({ label, value, onLess, onMore, lessLabel, moreLabel }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Button
          kind="secondary"
          label="−"
          onPress={onLess}
          accessibilityLabel={lessLabel ?? t('ui.settings.less', { label })}
        />
        <Text style={styles.value} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
        <Button
          kind="secondary"
          label="+"
          onPress={onMore}
          accessibilityLabel={moreLabel ?? t('ui.settings.more', { label })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: { fontSize: 16, color: colors.ink, flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { minWidth: 56, textAlign: 'center', fontSize: 18, fontWeight: '600', color: colors.ink },
});
