import { desc, eq, lt } from 'drizzle-orm';

import { addDays } from '@/engine/time';
import {
  MINUTE_MS,
  newDayLedger,
  type DayKey,
  type ISO,
  type NudgeLedger,
  type NudgeType,
} from '@/engine';

import type { Db } from '../db';
import { nudgeLedger } from '../schema';

/** An open counts only within this long after the push (DOG_ENGINE §13). */
export const OPEN_WINDOW_MIN = 60;

type LedgerRow = typeof nudgeLedger.$inferSelect;

function toLedger(row: LedgerRow): NudgeLedger {
  return {
    day: row.day,
    sentCount: row.sentCount,
    lastSentAt: row.lastSentAt ?? undefined,
    sentTypes: row.sentTypes,
    openedCount: row.openedCount,
    ignoredStreakDays: row.ignoredStreakDays,
  };
}

function save(db: Db, l: NudgeLedger): void {
  const row = { ...l, lastSentAt: l.lastSentAt ?? null };
  db.insert(nudgeLedger)
    .values(row)
    .onConflictDoUpdate({ target: nudgeLedger.day, set: row })
    .run();
}

function find(db: Db, day: DayKey): NudgeLedger | null {
  const row = db.select().from(nudgeLedger).where(eq(nudgeLedger.day, day)).get();
  return row ? toLedger(row) : null;
}

/**
 * The day's ledger, or a fresh one. The ignored streak carries over only from the day
 * right before; a day with no ledger row sent nothing, so it ignored nothing.
 */
function forDay(db: Db, day: DayKey): NudgeLedger {
  const existing = find(db, day);
  if (existing) return existing;
  const prev = db
    .select()
    .from(nudgeLedger)
    .where(lt(nudgeLedger.day, day))
    .orderBy(desc(nudgeLedger.day))
    .limit(1)
    .get();
  return newDayLedger(day, prev && prev.day === addDays(day, -1) ? prev : undefined);
}

export const ledgerRepo = {
  find,
  forDay,
  save,

  recordSent(db: Db, day: DayKey, type: NudgeType, at: ISO): NudgeLedger {
    const l = forDay(db, day);
    const next = {
      ...l,
      sentCount: l.sentCount + 1,
      lastSentAt: at,
      sentTypes: [...l.sentTypes, type],
    };
    save(db, next);
    return next;
  },

  /** Counts an open only within OPEN_WINDOW_MIN of the last push. */
  recordOpened(db: Db, day: DayKey, at: ISO): NudgeLedger {
    const l = forDay(db, day);
    const age = l.lastSentAt === undefined ? Infinity : Date.parse(at) - Date.parse(l.lastSentAt);
    if (age < 0 || age > OPEN_WINDOW_MIN * MINUTE_MS) return l;
    const next = { ...l, openedCount: l.openedCount + 1 };
    save(db, next);
    return next;
  },
};
