// Onboarding screens (PRD F1). Every permission is optional; denying all still gives a
// working dog with manual walks.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '@/components/AppProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { colors } from '@/components/theme';
import { t } from '@/copy';
import type { Breed } from '@/engine';
import { SOCIAL_GROUP, syncScreenTimeMonitoring } from '@/services/screentime/ScreenTimeService';

import {
  NAME_MAX,
  completeOnboarding,
  deviceTimezone,
  isValidName,
  shiftTime,
  useDraft,
} from './draft';

const BREEDS: Breed[] = ['aspin', 'shiba', 'golden', 'corgi'];

export function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen title={t('ui.welcome.title')}>
      <Text style={styles.body}>{t('ui.welcome.body')}</Text>
      <Text style={styles.hint}>{t('ui.welcome.noAccount')}</Text>
      <Button label={t('ui.welcome.start')} onPress={() => router.push('/adopt')} />
    </Screen>
  );
}

export function AdoptScreen() {
  const router = useRouter();
  const { breed, update } = useDraft();
  return (
    <Screen title={t('ui.adopt.title')}>
      {BREEDS.map((b) => (
        <Button
          key={b}
          kind={b === breed ? 'primary' : 'secondary'}
          label={t(`ui.breed.${b}`)}
          accessibilityLabel={
            b === breed
              ? t('ui.common.selected', { label: t(`ui.breed.${b}`) })
              : t(`ui.breed.${b}`)
          }
          onPress={() => update({ breed: b })}
        />
      ))}
      <Button label={t('ui.common.next')} onPress={() => router.push('/name')} />
    </Screen>
  );
}

export function NameScreen() {
  const router = useRouter();
  const { name, update } = useDraft();
  return (
    <Screen title={t('ui.name.title')}>
      <TextInput
        value={name}
        onChangeText={(v) => update({ name: v })}
        placeholder={t('ui.name.placeholder')}
        maxLength={NAME_MAX}
        autoFocus
        accessibilityLabel={t('ui.name.title')}
        style={styles.input}
      />
      <Text style={styles.hint}>{t('ui.name.hint')}</Text>
      <Button
        label={t('ui.common.next')}
        disabled={!isValidName(name)}
        onPress={() => router.push('/schedule')}
      />
    </Screen>
  );
}

export function ScheduleScreen() {
  const router = useRouter();
  const d = useDraft();
  const wake = t('ui.schedule.wake');
  const bed = t('ui.schedule.bed');
  return (
    <Screen title={t('ui.schedule.title')}>
      <Stepper
        label={wake}
        value={d.wakeTime}
        onLess={() => d.update({ wakeTime: shiftTime(d.wakeTime, -30) })}
        onMore={() => d.update({ wakeTime: shiftTime(d.wakeTime, 30) })}
        lessLabel={t('ui.schedule.earlier', { label: wake })}
        moreLabel={t('ui.schedule.later', { label: wake })}
      />
      <Stepper
        label={bed}
        value={d.bedTime}
        onLess={() => d.update({ bedTime: shiftTime(d.bedTime, -30) })}
        onMore={() => d.update({ bedTime: shiftTime(d.bedTime, 30) })}
        lessLabel={t('ui.schedule.earlier', { label: bed })}
        moreLabel={t('ui.schedule.later', { label: bed })}
      />
      <Stepper
        label={t('ui.schedule.nudges')}
        value={String(d.nudgesPerDay)}
        onLess={() => d.update({ nudgesPerDay: Math.max(0, d.nudgesPerDay - 1) as 0 | 1 | 2 | 3 })}
        onMore={() => d.update({ nudgesPerDay: Math.min(3, d.nudgesPerDay + 1) as 0 | 1 | 2 | 3 })}
      />
      <Text style={styles.hint}>{t('ui.schedule.nudgesHint', { name: d.name })}</Text>
      <Button label={t('ui.common.next')} onPress={() => router.push('/permissions')} />
    </Screen>
  );
}

type PermState = 'ask' | 'yes' | 'no';

function Primer(props: { title: string; why: string; state: PermState; onAllow(): void }) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {props.title}
      </Text>
      <Text style={styles.body}>{props.why}</Text>
      {props.state === 'ask' ? (
        <Button
          kind="secondary"
          label={t('ui.perm.allow')}
          accessibilityLabel={`${t('ui.perm.allow')}: ${props.title}`}
          onPress={props.onAllow}
        />
      ) : (
        <Text style={styles.hint}>
          {props.state === 'yes' ? t('ui.perm.allowed') : t('ui.perm.notAllowed')}
        </Text>
      )}
    </View>
  );
}

export function PermissionsScreen() {
  const router = useRouter();
  const { db, services, now, refresh } = useApp();
  const draft = useDraft();
  const [steps, setSteps] = useState<PermState>('ask');
  const [notes, setNotes] = useState<PermState>('ask');
  const [screen, setScreen] = useState<PermState>('ask');
  const name = draft.name;

  const finish = async () => {
    completeOnboarding(db, draft, now(), deviceTimezone());
    await syncScreenTimeMonitoring(services.screenTime, draft);
    await refresh(true);
    router.replace('/');
  };

  return (
    <Screen title={t('ui.perm.title')}>
      <Primer
        title={t('ui.perm.steps.title')}
        why={t('ui.perm.steps.why', { name })}
        state={steps}
        onAllow={async () =>
          setSteps((await services.health.requestPermissions()) === 'denied' ? 'no' : 'yes')
        }
      />
      <Primer
        title={t('ui.perm.notifications.title')}
        why={t('ui.perm.notifications.why', { name, count: draft.nudgesPerDay })}
        state={notes}
        onAllow={async () =>
          setNotes((await services.notifications.requestPermissions()) ? 'yes' : 'no')
        }
      />
      {services.screenTime.isSupported() ? (
        <Primer
          title={t('ui.perm.screen.title')}
          why={t('ui.perm.screen.why', { name })}
          state={screen}
          onAllow={async () => {
            const ok =
              (await services.screenTime.requestAuthorization()) &&
              (await services.screenTime.presentAppPicker(SOCIAL_GROUP)).count > 0;
            draft.update({ screenTimeEnabled: ok });
            setScreen(ok ? 'yes' : 'no');
          }}
        />
      ) : null}
      <Text style={styles.hint}>{t('ui.perm.later')}</Text>
      <Button label={t('ui.onboarding.finish', { name })} onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  hint: { fontSize: 14, color: colors.inkSoft },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: colors.ink,
  },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
