// Dev builds only (__DEV__): switch the persona that drives the mock services and
// fast-forward the clock. Not user-facing, so its labels are not in src/copy.

import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { colors } from '@/components/theme';
import { HOUR_MS, MINUTE_MS, DAY_MS } from '@/engine';
import { PERSONAS } from '@/engine/sim/personas';
import { currentPersona, useDevStore } from '@/store/dev';

import { applyPersona } from './applyPersona';

export function DevMenu() {
  const { db, now, refresh } = useApp();
  const { personaId, offsetMs, setPersona, advance, resetClock } = useDevStore();
  const load = async (id: string) => {
    setPersona(id);
    applyPersona(db, currentPersona(), now());
    await refresh(true);
  };
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={styles.title}>
        Developer
      </Text>
      <Text style={styles.text}>
        Persona: {personaId} · clock {offsetMs >= 0 ? '+' : ''}
        {Math.round(offsetMs / MINUTE_MS)} min · {new Date(now()).toLocaleString()}
      </Text>
      {Object.keys(PERSONAS).map((id) => (
        <Button
          key={id}
          kind={id === personaId ? 'primary' : 'secondary'}
          label={`Load ${id}`}
          onPress={() => load(id)}
        />
      ))}
      <View style={styles.row}>
        <Button kind="secondary" label="+10 min" onPress={() => advance(10 * MINUTE_MS)} />
        <Button kind="secondary" label="+1 h" onPress={() => advance(HOUR_MS)} />
        <Button kind="secondary" label="+1 day" onPress={() => advance(DAY_MS)} />
        <Button kind="secondary" label="Reset" onPress={resetClock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: 1, borderColor: colors.line, marginTop: 16, paddingTop: 12, gap: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  text: { fontSize: 13, color: colors.inkSoft },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
