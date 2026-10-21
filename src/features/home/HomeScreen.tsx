// Home scene (PRD F2, F3, F7, F8): the dog in a room lit by the user's local time, the
// water bowl, the current request's action and four quick actions.

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, roomColor } from '@/components/theme';
import { t } from '@/copy';
import { enginePrefs, ledgerRepo, prefsRepo } from '@/data';
import { dayKeyAt, type Request } from '@/engine';
import { PlaceholderDog, type DogTrigger, type Trigger } from '@/features/dog/PlaceholderDog';
import { useDogStore } from '@/store/dogStore';

export function HomeScreen() {
  const router = useRouter();
  const { db, now, record, refresh } = useApp();
  const output = useDogStore((s) => s.output);
  const dog = useDogStore((s) => s.dog);
  const celebrate = useDogStore((s) => s.celebrate);
  const [reaction, setReaction] = useState<Trigger>();
  const fire = (name: DogTrigger) => setReaction({ name, id: {} });

  // Each recompute is a new output object, so a greeting plays once per open.
  const event = useMemo<Trigger | undefined>(() => {
    if (celebrate.length) return { name: 'celebrate', id: celebrate };
    const greeting = output?.state.greeting ?? 'none';
    if (greeting === 'none') return undefined;
    return { name: greeting === 'big' ? 'greetBig' : 'greetSmall', id: output };
  }, [output, celebrate]);

  if (!output || !dog) return <Screen>{null}</Screen>;
  const { state, render } = output;
  const name = dog.name;
  const asleep = state.isAsleep;
  const ink = asleep ? colors.nightInk : colors.ink;

  const pet = async () => {
    fire('pet');
    await record('pet', null);
  };
  const water = async () => {
    fire('drink');
    await record('water_logged', null);
  };

  const requestAction: Partial<Record<Request, () => void>> = {
    leash: () => router.push('/walk'),
    playBow: () => record('play_bow_answered', null),
    ball: () => record('ball_played', { rung: 2 }),
    bored: () => record('ball_played', { rung: 3 }),
    water,
  };
  const act = requestAction[state.request];

  const answerFrequency = async (fewer: boolean) => {
    const prefs = prefsRepo.get(db);
    if (!prefs) return;
    if (fewer) {
      const next = Math.max(0, prefs.nudgesPerDay - 1) as 0 | 1 | 2 | 3;
      prefsRepo.save(db, { ...prefs, nudgesPerDay: next });
    }
    // Answered either way: stop asking until three more ignored days.
    const day = dayKeyAt(Date.parse(now()), enginePrefs(prefs, false));
    ledgerRepo.save(db, { ...ledgerRepo.forDay(db, day), ignoredStreakDays: 0 });
    await refresh(false);
  };

  return (
    <Screen background={roomColor(render.timeOfDay, asleep)}>
      <PlaceholderDog
        render={render}
        label={t(output.a11yLabelKey, { name })}
        hint={t('ui.home.petHint', { name })}
        reaction={reaction}
        event={event}
        onPress={pet}
      />
      <Text style={[styles.line, { color: ink }]} accessibilityLiveRegion="polite">
        {t(output.lineKey, { name })}
      </Text>

      {celebrate.length ? (
        <View style={styles.card}>
          {celebrate.map((trick) => (
            <Text key={trick} style={styles.cardText}>
              {t('ui.trick.learned', { name, trick: t(`ui.trick.${trick}`) })}
            </Text>
          ))}
          <Button
            kind="secondary"
            label={t('ui.common.done')}
            onPress={() => useDogStore.getState().set({ celebrate: [] })}
          />
        </View>
      ) : null}

      {asleep ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {t('ui.home.goodnight')}
          </Text>
          <Text style={styles.cardText}>{t('ui.home.goodnightBody', { name })}</Text>
        </View>
      ) : (
        <>
          {act ? <Button label={t(`ui.request.${state.request}`, { name })} onPress={act} /> : null}

          <View
            style={styles.bowl}
            accessible
            accessibilityLabel={t('ui.home.bowl', { percent: Math.round(state.bowlLevel * 100) })}
          >
            <View style={[styles.bowlFill, { height: `${Math.round(state.bowlLevel * 100)}%` }]} />
          </View>

          {output.askNudgeFrequency ? (
            <View style={styles.card}>
              <Text style={styles.cardText}>{t('nudges.frequencyQuestion')}</Text>
              <Button label={t('ui.home.fewer')} onPress={() => answerFrequency(true)} />
              <Button
                kind="secondary"
                label={t('ui.home.keep')}
                onPress={() => answerFrequency(false)}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              kind="secondary"
              label={t('ui.home.startWalk')}
              onPress={() => router.push('/walk')}
            />
            <Button kind="secondary" label={t('ui.home.logWater')} onPress={water} />
            <Button kind="secondary" label={t('ui.home.pet')} onPress={pet} />
            <Button
              kind="secondary"
              label={t('ui.home.checkin')}
              onPress={() => router.push('/checkin')}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 18, textAlign: 'center', marginVertical: 8 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 4 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  cardText: { fontSize: 16, color: colors.ink },
  bowl: {
    alignSelf: 'center',
    width: 90,
    height: 36,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    borderWidth: 3,
    borderColor: colors.inkSoft,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginVertical: 8,
  },
  bowlFill: { backgroundColor: colors.water, width: '100%' },
  actions: { gap: 4 },
});
