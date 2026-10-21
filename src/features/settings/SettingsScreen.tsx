// Settings (PRD F13): schedule, nudges, water goal, quiet hours, screen time, permissions,
// "Your data", Premium. Every change recomputes the dog.

import { useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import { prefsRepo, type StoredPrefs } from '@/data';
import type { QuietHours } from '@/engine';
import { SOCIAL_GROUP, syncScreenTimeMonitoring } from '@/services/screentime/ScreenTimeService';
import { shiftTime } from '@/features/onboarding/draft';
import { useDogStore } from '@/store/dogStore';

import { DevMenu } from './DevMenu';

export function SettingsScreen() {
  const router = useRouter();
  const { db, services, refresh } = useApp();
  const prefs = useDogStore((s) => s.prefs);
  const name = useDogStore((s) => s.dog?.name ?? '');
  if (!prefs) return <Screen>{null}</Screen>;

  const save = async (patch: Partial<StoredPrefs>) => {
    const next = { ...prefs, ...patch };
    prefsRepo.save(db, next);
    if ('screenTimeEnabled' in patch || 'wakeTime' in patch) {
      await syncScreenTimeMonitoring(services.screenTime, next);
    }
    await refresh(false);
  };
  const wake = t('ui.schedule.wake');
  const bed = t('ui.schedule.bed');
  const nudges = t('ui.schedule.nudges');
  const water = t('ui.settings.waterGoal');

  return (
    <Screen title={t('ui.settings.title')}>
      <Stepper
        label={wake}
        value={prefs.wakeTime}
        onLess={() => save({ wakeTime: shiftTime(prefs.wakeTime, -30) })}
        onMore={() => save({ wakeTime: shiftTime(prefs.wakeTime, 30) })}
        lessLabel={t('ui.schedule.earlier', { label: wake })}
        moreLabel={t('ui.schedule.later', { label: wake })}
      />
      <Stepper
        label={bed}
        value={prefs.bedTime}
        onLess={() => save({ bedTime: shiftTime(prefs.bedTime, -30) })}
        onMore={() => save({ bedTime: shiftTime(prefs.bedTime, 30) })}
        lessLabel={t('ui.schedule.earlier', { label: bed })}
        moreLabel={t('ui.schedule.later', { label: bed })}
      />
      <Stepper
        label={nudges}
        value={String(prefs.nudgesPerDay)}
        onLess={() => save({ nudgesPerDay: Math.max(0, prefs.nudgesPerDay - 1) as 0 | 1 | 2 | 3 })}
        onMore={() => save({ nudgesPerDay: Math.min(3, prefs.nudgesPerDay + 1) as 0 | 1 | 2 | 3 })}
      />
      <Text style={styles.hint}>{t('ui.schedule.nudgesHint', { name })}</Text>
      <Stepper
        label={water}
        value={String(prefs.waterGoal)}
        onLess={() => save({ waterGoal: Math.max(1, prefs.waterGoal - 1) })}
        onMore={() => save({ waterGoal: Math.min(16, prefs.waterGoal + 1) })}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        {t('ui.settings.quietHours')}
      </Text>
      {prefs.quietHours.map((q, i) => {
        const set = (patch: Partial<QuietHours>) =>
          save({ quietHours: prefs.quietHours.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
        const from = t('ui.settings.quietFrom');
        const to = t('ui.settings.quietTo');
        return (
          <View key={i} style={styles.card}>
            <Stepper
              label={from}
              value={q.start}
              onLess={() => set({ start: shiftTime(q.start, -30) })}
              onMore={() => set({ start: shiftTime(q.start, 30) })}
              lessLabel={t('ui.schedule.earlier', { label: from })}
              moreLabel={t('ui.schedule.later', { label: from })}
            />
            <Stepper
              label={to}
              value={q.end}
              onLess={() => set({ end: shiftTime(q.end, -30) })}
              onMore={() => set({ end: shiftTime(q.end, 30) })}
              lessLabel={t('ui.schedule.earlier', { label: to })}
              moreLabel={t('ui.schedule.later', { label: to })}
            />
            <Button
              kind="secondary"
              label={t('ui.settings.removeQuiet')}
              onPress={() => save({ quietHours: prefs.quietHours.filter((_, j) => j !== i) })}
            />
          </View>
        );
      })}
      <Button
        kind="secondary"
        label={t('ui.settings.addQuiet')}
        onPress={() =>
          save({ quietHours: [...prefs.quietHours, { start: '12:00', end: '13:00' }] })
        }
      />
      {services.screenTime.isSupported() ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('ui.settings.screenTime')}</Text>
          <Switch
            accessibilityLabel={t('ui.settings.screenTime')}
            value={prefs.screenTimeEnabled}
            onValueChange={async (on) => {
              const ok =
                !on ||
                ((await services.screenTime.requestAuthorization()) &&
                  (await services.screenTime.presentAppPicker(SOCIAL_GROUP)).count > 0);
              await save({ screenTimeEnabled: on && ok });
            }}
          />
        </View>
      ) : null}
      <Button
        kind="secondary"
        label={t('ui.perm.steps.title')}
        onPress={async () => {
          await services.health.requestPermissions();
          await refresh(false);
        }}
      />
      <Button
        kind="secondary"
        label={t('ui.perm.notifications.title')}
        onPress={() => services.notifications.requestPermissions()}
      />
      <Button
        kind="secondary"
        label={t('ui.settings.yourData')}
        onPress={() => router.push('/data')}
      />
      <Button
        kind="secondary"
        label={t('ui.settings.premium')}
        onPress={() => router.push('/paywall')}
      />
      {__DEV__ ? <DevMenu /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 16, color: colors.ink, flexShrink: 1, paddingRight: 8 },
  hint: { fontSize: 14, color: colors.inkSoft },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 8 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 12 },
});
