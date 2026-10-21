import { desc, eq, lt } from 'drizzle-orm';

import type { DayKey, DaySummary } from '@/engine';

import type { Db } from '../db';
import { daySummary } from '../schema';

type DayRow = typeof daySummary.$inferSelect;

/** Stored summary: the engine's DaySummary plus the columns only the app reads. */
export type StoredDaySummary = DaySummary & { moodMin?: number; bedtimeKept?: boolean };

function toSummary(row: DayRow): StoredDaySummary {
  return {
    day: row.day,
    steps: row.steps,
    walks: row.walks,
    water: row.water,
    screenRungMax: row.screenRungMax,
    moodCheckin: row.moodMin !== null,
    moodMin: row.moodMin ?? undefined,
    bedtimeKept: row.bedtimeKept ?? undefined,
    goodDay: row.goodDay,
    finalized: row.finalized,
    pets: row.pets,
    stepTarget: row.stepTarget ?? undefined,
  };
}

export const dayRepo = {
  get(db: Db, day: DayKey): StoredDaySummary | null {
    const row = db.select().from(daySummary).where(eq(daySummary.day, day)).get();
    return row ? toSummary(row) : null;
  },

  save(db: Db, s: StoredDaySummary): void {
    const row = {
      day: s.day,
      steps: s.steps,
      walks: s.walks,
      water: s.water,
      screenRungMax: s.screenRungMax,
      moodMin: s.moodMin ?? null,
      bedtimeKept: s.bedtimeKept ?? null,
      goodDay: s.goodDay,
      finalized: s.finalized,
      pets: s.pets,
      stepTarget: s.stepTarget ?? null,
    };
    db.insert(daySummary)
      .values(row)
      .onConflictDoUpdate({ target: daySummary.day, set: row })
      .run();
  },

  /** Up to `limit` days before `day`, most recent first (the engine's `history`). */
  historyBefore(db: Db, day: DayKey, limit = 14): StoredDaySummary[] {
    return db
      .select()
      .from(daySummary)
      .where(lt(daySummary.day, day))
      .orderBy(desc(daySummary.day))
      .limit(limit)
      .all()
      .map(toSummary);
  },

  /** The most recent finalized day, if any. */
  lastFinalized(db: Db): DayKey | null {
    const row = db
      .select({ day: daySummary.day })
      .from(daySummary)
      .where(eq(daySummary.finalized, true))
      .orderBy(desc(daySummary.day))
      .limit(1)
      .get();
    return row?.day ?? null;
  },
};
