// App-wide wiring: opens the database, picks the services, and recomputes the dog whenever
// the app becomes active (CLAUDE.md engineering rule 2). Tests pass `db` and `services`.

import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { eventsRepo, migrate, type Db, type EventPayloads, type EventType } from '@/data';
import { refreshDog } from '@/features/dog/refresh';
import { handleNudgeResponse } from '@/features/dog/nudgeResponse';
import { scheduleTrialReminder } from '@/features/settings/trialReminder';
import { createAppServices, type Services } from '@/services';
import { syncScreenTimeMonitoring } from '@/services/screentime/ScreenTimeService';
import { useDogStore } from '@/store/dogStore';
import { currentPersona, nowMs, useDevStore } from '@/store/dev';

interface AppContextValue {
  db: Db;
  services: Services;
  ready: boolean;
  reduceMotion: boolean;
  now(): string;
  /** `pull: false` recomputes from stored data only (no platform reads). */
  refresh(opened?: boolean, pull?: boolean): Promise<void>;
  /** Records a user action now and recomputes. */
  record<T extends EventType>(type: T, payload: EventPayloads[T]): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp() outside <AppProvider>');
  return value;
}

interface Props {
  children: React.ReactNode;
  db?: Db;
  services?: Services;
}

function defaultDb(): Db {
  // Loaded lazily so tests never import expo-sqlite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { openDb } = require('@/data/openDb') as typeof import('@/data/openDb');
  return openDb();
}

export function AppProvider({ children, db: injectedDb, services: injectedServices }: Props) {
  const [db] = useState(() => injectedDb ?? defaultDb());
  const [services] = useState(
    () =>
      injectedServices ??
      createAppServices(currentPersona, nowMs, (ms) => ms - useDevStore.getState().offsetMs),
  );
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const reduceMotionRef = useRef(false);

  const now = useCallback(() => new Date(nowMs()).toISOString(), []);
  // One recompute at a time: overlapping runs would interleave the notification
  // cancel/schedule calls (duplicate pushes) and record the same open twice.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(
    (opened = false, pull = true): Promise<void> => {
      const run = queue.current.then(() =>
        refreshDog(
          { db, services, now: now(), reduceMotion: reduceMotionRef.current },
          { opened, pull },
        ),
      );
      queue.current = run.catch(() => undefined);
      return run.then(() => undefined);
    },
    [db, services, now],
  );
  const record = useCallback(
    async <T extends EventType>(type: T, payload: EventPayloads[T]) => {
      eventsRepo.add(db, type, now(), payload);
      await refresh(false, false);
    },
    [db, now, refresh],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      await migrate(db);
      reduceMotionRef.current = await AccessibilityInfo.isReduceMotionEnabled();
      setReduceMotion(reduceMotionRef.current);
      await refresh(true);
      if (alive) setReady(true);
      await scheduleTrialReminder(services, db, now());
      // shortcut: monitoring uses the weekday wake time even on weekend schedules.
      await syncScreenTimeMonitoring(services.screenTime, useDogStore.getState().prefs);
      // HealthKit background delivery wakes the app; recompute and reschedule then.
      if (await services.health.isAvailable()) {
        await services.health.enableBackgroundUpdates(() => refresh(false));
      }
    })().catch((e: unknown) => console.error('App start failed', e));
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh(true)
        .then(() => scheduleTrialReminder(services, db, now()))
        .catch((e: unknown) => console.error(e));
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      reduceMotionRef.current = on;
      setReduceMotion(on);
    });
    return () => {
      alive = false;
      appState.remove();
      motion.remove();
    };
  }, [db, services, now, refresh]);

  // Taps on nudges, including the one that launched the app. Only once start-up is done:
  // the database is migrated and the navigator is mounted. The foreground event (or
  // start-up) records the open; this only applies the tap.
  useEffect(() => {
    if (!ready) return;
    return services.notifications.onResponse((r) => {
      const route = handleNudgeResponse(db, r, now());
      refresh(false, false).catch((e: unknown) => console.error(e));
      router.push(route as '/');
    });
  }, [ready, db, services, now, refresh]);

  // Dev clock moved: recompute as if time passed. Subscribing (not an effect on `ready`)
  // keeps the start-up recompute's greeting from being overwritten.
  useEffect(
    () =>
      useDevStore.subscribe((state, prev) => {
        if (state.offsetMs !== prev.offsetMs)
          refresh(false).catch((e: unknown) => console.error(e));
      }),
    [refresh],
  );

  const value = useMemo(
    () => ({ db, services, ready, reduceMotion, now, refresh, record }),
    [db, services, ready, reduceMotion, now, refresh, record],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
