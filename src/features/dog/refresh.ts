// Recompute on open (CLAUDE.md engineering rule 2): pull fresh platform data into SQLite,
// recompute the dog from stored data, then apply the engine's nudge plan.

import {
  commitDeliveredNudges,
  dogRepo,
  enginePrefs,
  eventsRepo,
  prefsRepo,
  recompute,
  replaceScheduledNudges,
  stepCacheRepo,
  type Db,
  type RecomputeResult,
} from '@/data';
import { t } from '@/copy';
import { dayKeyAt, dayWindow, type ISO } from '@/engine';
import { addDays, toISO } from '@/engine/time';
import type { Services } from '@/services';
import { NUDGE_ACTION_COPY } from '@/services/notifications/actions';
import { useDogStore } from '@/store/dogStore';

// Steps availability from the last full refresh; taps reuse it instead of asking again.
let lastStepsAvailable = false;

export interface RefreshContext {
  db: Db;
  services: Services;
  now: ISO;
  reduceMotion: boolean;
}

export async function refreshDog(
  { db, services, now, reduceMotion }: RefreshContext,
  opts: { opened: boolean; pull?: boolean },
): Promise<RecomputeResult | null> {
  // `pull: false` (a tap in the app): recompute from stored data only, without asking
  // HealthKit / Health Connect / Screen Time again.
  const pull = opts.pull ?? true;
  const stored = prefsRepo.get(db);
  if (!stored) {
    useDogStore.getState().set({ output: null, dog: null, prefs: null });
    return null;
  }
  const stepsAvailable = pull ? await services.health.isAvailable() : lastStepsAvailable;
  lastStepsAvailable = stepsAvailable;
  const prefs = enginePrefs(stored, stepsAvailable);
  const nowMs = Date.parse(now);
  const today = dayKeyAt(nowMs, prefs);

  // shortcut: only yesterday and today are re-read from health; after a longer absence
  // older days finalize with whatever was cached. Fine until M4 adds a real backfill.
  if (pull && stepsAvailable) {
    for (const day of [addDays(today, -1), today]) {
      const w = dayWindow(day, prefs);
      const end = Math.min(w.end, nowMs);
      const steps = await services.health.getStepBuckets(toISO(w.start), toISO(end), 10);
      stepCacheRepo.upsert(
        db,
        day,
        steps.map((s, bucket) => ({ bucket, steps: s })),
      );
    }
  }
  if (pull && stored.screenTimeEnabled) {
    const w = dayWindow(today, prefs);
    const reading = await services.screenTime.getRungsReachedToday(toISO(w.start));
    const known = eventsRepo
      .between(db, toISO(w.start), toISO(nowMs + 1))
      .some(
        (e) =>
          e.type === 'screen_rung' && (e.payload as { rung: number }).rung >= (reading?.rung ?? 0),
      );
    if (reading && reading.rung > 0 && !known) eventsRepo.add(db, 'screen_rung', now, reading);
  }

  commitDeliveredNudges(db, now, prefs);
  const result = recompute(db, now, { stepsAvailable, reduceMotion }, opts);
  const dog = dogRepo.get(db);
  if (result && dog) {
    const plan = result.output.nudgePlan;
    const scheduled = await services.notifications.replaceSchedule(
      plan.map((n) => ({
        ...n,
        title: dog.name,
        body: t(n.copyKey, { name: dog.name }),
        action: t(NUDGE_ACTION_COPY[n.type]),
      })),
    );
    // Only what the OS really scheduled counts toward the ledger later.
    replaceScheduledNudges(db, now, scheduled);
  }
  const learned = result?.finalized.flatMap((f) => f.unlockedTricks) ?? [];
  const store = useDogStore.getState();
  store.set({
    output: result?.output ?? null,
    dog,
    prefs: stored,
    celebrate: learned.length ? [...store.celebrate, ...learned] : store.celebrate,
  });
  return result;
}
