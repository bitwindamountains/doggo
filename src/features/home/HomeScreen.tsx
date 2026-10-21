// Home scene (PRD F2, F3, F7, F8): the dog in a room lit by the user's local time, the
// water bowl, the current request's action and four quick actions.

import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { colors, roomColor } from '@/components/theme';
import { t } from '@/copy';
import { enginePrefs, ledgerRepo, prefsRepo } from '@/data';
import { dayKeyAt, type Request } from '@/engine';
import { PlaceholderDog, type DogTrigger, type Trigger } from '@/features/dog/PlaceholderDog';
import { useDogStore } from '@/store/dogStore';

import { Room } from './Room';

// Touch feedback; harmless where haptics are unavailable.
const tap = (style: Haptics.ImpactFeedbackStyle) =>
  Haptics.impactAsync(style).catch(() => undefined);

export function HomeScreen() {
  const router = useRouter();
  const { db, now, record, refresh, reduceMotion } = useApp();
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
    tap(Haptics.ImpactFeedbackStyle.Light);
    await record('pet', null);
  };
  const water = async () => {
    fire('drink');
    tap(Haptics.ImpactFeedbackStyle.Soft);
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
      <Room
        hours={render.timeOfDay}
        asleep={asleep}
        reduceMotion={reduceMotion}
        bowlLevel={state.bowlLevel}
        bowlLabel={t('ui.home.bowl', { percent: Math.round(state.bowlLevel * 100) })}
      >
        <PlaceholderDog
          render={render}
          label={t(output.a11yLabelKey, { name })}
          hint={t('ui.home.petHint', { name })}
          reaction={reaction}
          event={event}
          onPress={pet}
        />
      </Room>
      {/* a new line fades in when the dog does something new */}
      <Rise key={output.lineKey} reduceMotion={reduceMotion}>
        <Text style={[styles.line, { color: ink }]} accessibilityLiveRegion="polite">
          {t(output.lineKey, { name })}
        </Text>
      </Rise>

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
            {(
              [
                ['ui.home.startWalk', () => router.push('/walk')],
                ['ui.home.logWater', water],
                ['ui.home.pet', pet],
                ['ui.home.checkin', () => router.push('/checkin')],
              ] as const
            ).map(([key, onPress]) => (
              <View key={key} style={styles.action}>
                <Button kind="secondary" label={t(key)} onPress={onPress} />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 12,
  },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 4 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  cardText: { fontSize: 16, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  action: { width: '48.5%' },
});
