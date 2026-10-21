// The only bridge from stored data to the engine (docs/ARCHITECTURE.md, MILESTONES M2).

import {
  BUCKET_MINUTES,
  MINUTE_MS,
  dayKeyAt,
  dayWindow,
  type EngineInput,
  type ISO,
  type Prefs,
} from '@/engine';
import { toISO } from '@/engine/time';

import type { Db } from './db';
import { aggregateDay } from './dayData';
import { dayRepo, dogRepo, eventsRepo, ledgerRepo, prefsRepo, stepCacheRepo } from './repos';
import type { StoredPrefs } from './repos';

const BUCKET_MS = BUCKET_MINUTES * MINUTE_MS;

/** Device state that is not stored: it is read fresh on every compute. */
export interface RuntimeState {
  stepsAvailable: boolean;
  reduceMotion?: boolean;
}

export function enginePrefs(stored: StoredPrefs, stepsAvailable: boolean): Prefs {
  const { locale, onboardedAt, ...rest } = stored;
  return { ...rest, stepsAvailable };
}

/** Everything the engine needs for `now`, or null before onboarding (no prefs or dog). */
export function buildEngineInput(db: Db, now: ISO, runtime: RuntimeState): EngineInput | null {
  const stored = prefsRepo.get(db);
  const dog = dogRepo.get(db);
  if (!stored || !dog) return null;

  const prefs = enginePrefs(stored, runtime.stepsAvailable);
  const nowMs = Date.parse(now);
  const day = dayKeyAt(nowMs, prefs);
  const w = dayWindow(day, prefs);
  const justAfterNow = toISO(nowMs + 1);
  const today = aggregateDay(eventsRepo.between(db, toISO(w.start), justAfterNow), w);

  return {
    now: toISO(nowMs),
    prefs,
    dog,
    today: {
      day,
      dayStart: toISO(w.start),
      dayEnd: toISO(w.end),
      // Completed buckets only, like the engine's simulator.
      stepBuckets: stepCacheRepo.buckets(db, day, Math.floor((nowMs - w.start) / BUCKET_MS)),
      walks: today.walks,
      water: today.water,
      waterLastAt: today.waterLastAt,
      screenRung: today.screenRung,
      screenRungAt: today.screenRungAt,
      screenAckRung: today.screenAckRung,
      moodToday: today.moodLatest,
      petsToday: today.pets,
    },
    history: dayRepo.historyBefore(db, day, 14),
    ledger: ledgerRepo.forDay(db, day),
    lastOpenedAt: eventsRepo.lastOfType(db, 'app_opened', justAfterNow)?.at,
    lastPlayBowAt: eventsRepo.lastOfType(db, 'play_bow_answered', justAfterNow)?.at,
    reduceMotion: runtime.reduceMotion,
  };
}
