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
import { dayKeyAt, dayWindow, type ISO, type NudgeType } from '@/engine';
import { addDays, toISO } from '@/engine/time';
import type { Services } from '@/services';
import { useDogStore } from '@/store/dogStore';

const ACTION_KEY: Record<NudgeType, string> = {
  leash: 'push.action.leash',
  playBow: 'push.action.playBow',
  ball: 'push.action.ball',
  bored: 'push.action.ball',
  bedtime: 'push.action.bedtime',
};

export interface RefreshContext {
  db: Db;
  services: Services;
  now: ISO;
  reduceMotion: boolean;
}

export async function refreshDog(
  { db, services, now, reduceMotion }: RefreshContext,
  opts: { opened: boolean },
): Promise<RecomputeResult | null> {
  const stored = prefsRepo.get(db);
  if (!stored) {
    useDogStore.getState().set({ output: null, dog: null, prefs: null });
    return null;
  }
  const stepsAvailable = await services.health.isAvailable();
  const prefs = enginePrefs(stored, stepsAvailable);
  const nowMs = Date.parse(now);
  const today = dayKeyAt(nowMs, prefs);

  // shortcut: only yesterday and today are re-read from health; after a longer absence
  // older days finalize with whatever was cached. Fine until M4 adds a real backfill.
  if (stepsAvailable) {
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
  if (stored.screenTimeEnabled) {
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
    replaceScheduledNudges(db, now, plan);
    await services.notifications.replaceSchedule(
      plan.map((n) => ({
        ...n,
        title: dog.name,
        body: t(n.copyKey, { name: dog.name }),
        action: t(ACTION_KEY[n.type]),
      })),
    );
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
