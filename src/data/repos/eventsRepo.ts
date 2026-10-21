import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';

import type { ISO } from '@/engine';

import type { Db } from '../db';
import type { EventPayloads, EventType, StoredEvent } from '../events';
import { event } from '../schema';

/** Normalizes to `toISOString()` form so string comparison orders by time. */
function canonical(at: ISO): ISO {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${at}`);
  return new Date(ms).toISOString();
}

type EventRow = typeof event.$inferSelect;

function toEvent(row: EventRow): StoredEvent {
  return { id: row.id, at: row.at, type: row.type as EventType, payload: row.payload as never };
}

export const eventsRepo = {
  add<T extends EventType>(db: Db, type: T, at: ISO, payload: EventPayloads[T]): number {
    const row = db
      .insert(event)
      .values({ type, at: canonical(at), payload })
      .returning({ id: event.id })
      .get();
    return row.id;
  },

  /** Events with from ≤ at < to, oldest first. */
  between(db: Db, from: ISO, to: ISO): StoredEvent[] {
    return db
      .select()
      .from(event)
      .where(and(gte(event.at, canonical(from)), lt(event.at, canonical(to))))
      .orderBy(asc(event.at), asc(event.id))
      .all()
      .map(toEvent);
  },

  /** The latest event of a type before `before` (exclusive), if any. */
  lastOfType<T extends EventType>(db: Db, type: T, before: ISO): StoredEvent<T> | null {
    const row = db
      .select()
      .from(event)
      .where(and(eq(event.type, type), lt(event.at, canonical(before))))
      .orderBy(desc(event.at), desc(event.id))
      .limit(1)
      .get();
    return row ? (toEvent(row) as StoredEvent<T>) : null;
  },

  /** The earliest event time, if any (lower bound for finalization). */
  firstAt(db: Db): ISO | null {
    const row = db.select({ at: event.at }).from(event).orderBy(asc(event.at)).limit(1).get();
    return row?.at ?? null;
  },
};
