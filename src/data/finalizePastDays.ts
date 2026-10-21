// Lazy finalization (CLAUDE.md engineering rule 2): on open, every past day that is not
// finalized yet is summarized from stored data and committed with the engine's
// finalizeDay. Idempotent: finalized days are skipped, and each day commits atomically.

import {
  BUCKET_MINUTES,
  MINUTE_MS,
  dailyTarget,
  dayKeyAt,
  dayWindow,
  finalizeDay,
  type DayKey,
  type ISO,
  type TrickId,
} from '@/engine';
import { addDays, toISO } from '@/engine/time';
import { countableWalks, detectWalks } from '@/engine/walks';

import { enginePrefs, type RuntimeState } from './buildEngineInput';
import type { Db } from './db';
import { aggregateDay } from './dayData';
import { dayRepo, dogRepo, eventsRepo, ledgerRepo, prefsRepo, stepCacheRepo } from './repos';
import type { StoredDaySummary } from './repos';

/** Older unfinalized days are not backfilled (nothing can have been recorded for them). */
export const MAX_BACKFILL_DAYS = 60;

export interface FinalizedDay {
  day: DayKey;
  goodDay: boolean;
  unlockedTricks: TrickId[];
}

export function finalizePastDays(
  db: Db,
  now: ISO,
  runtime: Pick<RuntimeState, 'stepsAvailable'>,
): FinalizedDay[] {
  const stored = prefsRepo.get(db);
  const firstDog = dogRepo.get(db);
  if (!stored || !firstDog) return [];

  const prefs = enginePrefs(stored, runtime.stepsAvailable);
  const today = dayKeyAt(Date.parse(now), prefs);
  const lastDone = dayRepo.lastFinalized(db);
  const adoptedDay = dayKeyAt(Date.parse(firstDog.adoptedAt), prefs);
  let day = lastDone ? addDays(lastDone, 1) : adoptedDay;
  const earliest = addDays(today, -MAX_BACKFILL_DAYS);
  if (day < earliest) day = earliest;

  const done: FinalizedDay[] = [];
  for (; day < today; day = addDays(day, 1)) {
    const d = day;
    const result = db.transaction((tx) => {
      const existing = dayRepo.get(tx, d);
      if (existing?.finalized) return null;
      const dog = dogRepo.get(tx);
      if (!dog) return null;

      const w = dayWindow(d, prefs);
      const events = aggregateDay(eventsRepo.between(tx, toISO(w.start), toISO(w.end)), w);
      const buckets = stepCacheRepo.buckets(
        tx,
        d,
        Math.ceil((w.end - w.start) / (BUCKET_MINUTES * MINUTE_MS)),
      );
      // Walks the app never saw because it was not opened that day.
      const missed = prefs.stepsAvailable ? detectWalks(buckets, w.start, w.end, events.walks) : [];
      for (const walk of missed) {
        eventsRepo.add(tx, 'walk_detected', walk.end, {
          start: walk.start,
          end: walk.end,
          steps: walk.steps,
        });
      }

      const summary: StoredDaySummary = {
        day: d,
        steps: buckets.reduce((a, b) => a + b, 0),
        walks: countableWalks([...events.walks, ...missed]).length,
        water: events.water,
        screenRungMax: events.screenRung,
        moodCheckin: events.moodMin !== undefined,
        moodMin: events.moodMin,
        bedtimeKept: events.bedtimeKept || undefined,
        goodDay: false,
        finalized: false,
        pets: events.pets,
        stepTarget: dailyTarget(dayRepo.historyBefore(tx, d, 14)),
      };
      const out = finalizeDay(summary, dog, ledgerRepo.forDay(tx, d), prefs);
      dayRepo.save(tx, { ...summary, ...out.summary });
      dogRepo.save(tx, out.dog, now);
      ledgerRepo.save(tx, out.ledger);
      for (const trick of out.unlockedTricks) eventsRepo.add(tx, 'trick_learned', now, { trick });
      return { day: d, goodDay: out.summary.goodDay, unlockedTricks: out.unlockedTricks };
    });
    if (result) done.push(result);
  }
  return done;
}
