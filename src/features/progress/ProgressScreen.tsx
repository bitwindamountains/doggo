// Progress (PRD F10): totals and good days only, never a consecutive-day streak.

import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { dayRepo, enginePrefs, prefsRepo } from '@/data';
import { dayKeyAt } from '@/engine';
import { useDogStore } from '@/store/dogStore';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ProgressScreen() {
  const { db, now } = useApp();
  const dog = useDogStore((s) => s.dog);
  const output = useDogStore((s) => s.output);
  const prefs = prefsRepo.get(db);
  if (!dog || !prefs) return <Screen>{null}</Screen>;

  const today = dayKeyAt(Date.parse(now()), enginePrefs(prefs, false));
  const thisWeek = dayRepo.historyBefore(db, today, 7).filter((d) => d.goodDay).length;
  const stage = output?.state.lifeStage ?? 'puppy';

  return (
    <Screen title={t('ui.progress.title')}>
      <View style={styles.grid}>
        <Stat label={t('ui.progress.walks')} value={dog.walksTotal} />
        <Stat label={t('ui.progress.goodDays')} value={dog.goodDaysTotal} />
        <Stat label={t('ui.progress.thisWeek')} value={thisWeek} />
        <Stat label={t('ui.progress.stage')} value={t(`ui.stage.${stage}`)} />
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('ui.progress.tricks')}
      </Text>
      {dog.tricks.length ? (
        dog.tricks.map((trick) => (
          <Text key={trick} style={styles.item}>
            ⭐ {t(`ui.trick.${trick}`)}
          </Text>
        ))
      ) : (
        <Text style={styles.item}>{t('ui.progress.noTricks', { name: dog.name })}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    minWidth: '45%',
    flexGrow: 1,
  },
  value: { fontSize: 28, fontWeight: '700', color: colors.ink },
  label: { fontSize: 14, color: colors.inkSoft },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 12 },
  item: { fontSize: 16, color: colors.ink },
});
