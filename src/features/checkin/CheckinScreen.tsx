// Mood check-in (PRD F9). Mood and note stay on the phone. A low mood brings the dog over
// (headRest) and offers a 1-minute breathing exercise.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { LOW_MOOD_MAX, type Mood } from '@/engine';
import { useDogStore } from '@/store/dogStore';

import { needsSupport } from './support';

const FACES: Record<Mood, string> = { 1: '😣', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
const BREATH_SECONDS = 60;
const HALF_BREATH_MS = 4000;

export function Breathing({ name, reduceMotion }: { name: string; reduceMotion: boolean }) {
  const [left, setLeft] = useState(BREATH_SECONDS);
  const [size] = useState(() => new Animated.Value(0.6));
  const breathingIn = Math.floor((BREATH_SECONDS - left) / (HALF_BREATH_MS / 1000)) % 2 === 0;

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (reduceMotion || left === 0) return;
    Animated.timing(size, {
      toValue: breathingIn ? 1 : 0.6,
      duration: HALF_BREATH_MS,
      useNativeDriver: true,
    }).start();
  }, [breathingIn, reduceMotion, left, size]);

  if (left === 0) return <Text style={styles.big}>{t('ui.breath.done', { name })}</Text>;
  return (
    <View style={styles.center}>
      <Animated.View
        style={[styles.circle, { transform: [{ scale: reduceMotion ? 0.8 : size }] }]}
      />
      <Text style={styles.big} accessibilityLiveRegion="polite">
        {t(breathingIn ? 'ui.breath.in' : 'ui.breath.out')}
      </Text>
    </View>
  );
}

export function CheckinScreen() {
  const router = useRouter();
  const { db, now, record, reduceMotion } = useApp();
  const name = useDogStore((s) => s.dog?.name ?? '');
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [breathing, setBreathing] = useState(false);

  const save = async () => {
    if (!mood) return;
    await record('mood_checkin', note.trim() ? { mood, note: note.trim() } : { mood });
    setSaved(true);
  };
  const low = mood !== null && mood <= LOW_MOOD_MAX;

  return (
    <Screen title={t('ui.checkin.title')}>
      {!saved ? (
        <>
          <View style={styles.faces}>
            {([1, 2, 3, 4, 5] as Mood[]).map((m) => (
              <Button
                key={m}
                kind={m === mood ? 'primary' : 'secondary'}
                label={FACES[m]}
                accessibilityLabel={
                  m === mood
                    ? t('ui.common.selected', { label: t(`ui.mood.${m}`) })
                    : t(`ui.mood.${m}`)
                }
                onPress={() => setMood(m)}
              />
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('ui.checkin.note')}
            accessibilityLabel={t('ui.checkin.note')}
            multiline
            style={styles.input}
          />
          <Button label={t('ui.checkin.save', { name })} disabled={!mood} onPress={save} />
        </>
      ) : (
        <>
          <Text style={styles.body}>{t(low ? 'headRest.0' : 'ui.checkin.thanks', { name })}</Text>
          {low && !breathing ? (
            <>
              <Text style={styles.body}>{t('ui.breath.offer', { name })}</Text>
              <Button label={t('ui.breath.start')} onPress={() => setBreathing(true)} />
            </>
          ) : null}
          {breathing ? <Breathing name={name} reduceMotion={reduceMotion} /> : null}
          {needsSupport(db, now()) ? (
            <Button
              kind="secondary"
              label={t('ui.checkin.support')}
              onPress={() => router.push('/support')}
            />
          ) : null}
          <Button kind="secondary" label={t('ui.common.done')} onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  faces: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  body: { fontSize: 17, color: colors.ink, lineHeight: 24 },
  big: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    marginVertical: 12,
  },
  center: { alignItems: 'center', marginVertical: 12 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.water,
    opacity: 0.5,
  },
  input: {
    minHeight: 72,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.ink,
  },
});
