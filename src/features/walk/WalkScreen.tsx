// Manual walk (PRD F4): a timer plus the steps health reports for that time, if any.
// A walk in progress survives the app being closed: it resumes from walk_started.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { eventsRepo } from '@/data';
import { MINUTE_MS } from '@/engine';
import { useDogStore } from '@/store/dogStore';

export function WalkScreen() {
  const router = useRouter();
  const { db, services, now, record } = useApp();
  const name = useDogStore((s) => s.dog?.name ?? '');
  const [start, setStart] = useState<string | null>(() => {
    const later = new Date(Date.parse(now()) + 1).toISOString();
    const started = eventsRepo.lastOfType(db, 'walk_started', later);
    const ended = eventsRepo.lastOfType(db, 'walk_ended', later);
    return started && (!ended || ended.at < started.at) ? started.at : null;
  });
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!start) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [start]);

  const minutes = start ? Math.floor((Date.parse(now()) - Date.parse(start)) / MINUTE_MS) : 0;
  void tick;

  const begin = async () => {
    const at = now();
    await record('walk_started', null);
    setStart(at);
  };
  const finish = async () => {
    if (!start) return;
    const end = now();
    const steps = (await services.health.isAvailable())
      ? await services.health.getStepsBetween(start, end)
      : 0;
    await record('walk_ended', { start, steps });
    setStart(null);
    setDone(true);
  };

  return (
    <Screen title={t('ui.walk.title', { name })}>
      {done ? (
        <>
          <Text style={styles.big}>{t('ui.walk.done', { name })}</Text>
          <Button label={t('ui.common.done')} onPress={() => router.back()} />
        </>
      ) : start ? (
        <>
          <Text style={styles.big} accessibilityLiveRegion="polite">
            {t('ui.walk.elapsed', { minutes })}
          </Text>
          <Text style={styles.hint}>{t('ui.walk.short')}</Text>
          <Button label={t('ui.walk.finish')} onPress={finish} />
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('ui.walk.short')}</Text>
          <Button label={t('ui.walk.start')} onPress={begin} />
          <Button kind="secondary" label={t('ui.common.cancel')} onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginVertical: 16,
  },
  hint: { fontSize: 14, color: colors.inkSoft },
});
