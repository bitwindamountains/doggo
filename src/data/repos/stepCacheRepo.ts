import { and, asc, eq, lt } from 'drizzle-orm';

import type { DayKey } from '@/engine';

import type { Db } from '../db';
import { stepCache } from '../schema';

export const stepCacheRepo = {
  /** Writes buckets (index = 10-minute bucket from day start); later writes replace. */
  upsert(db: Db, day: DayKey, buckets: { bucket: number; steps: number }[]): void {
    if (buckets.length === 0) return;
    db.transaction((tx) => {
      for (const b of buckets) {
        tx.insert(stepCache)
          .values({ day, bucket: b.bucket, steps: b.steps })
          .onConflictDoUpdate({
            target: [stepCache.day, stepCache.bucket],
            set: { steps: b.steps },
          })
          .run();
      }
    });
  },

  /** Dense bucket array for buckets 0..count−1; missing buckets read as 0 steps. */
  buckets(db: Db, day: DayKey, count: number): number[] {
    const out = new Array<number>(Math.max(0, count)).fill(0);
    const rows = db
      .select()
      .from(stepCache)
      .where(and(eq(stepCache.day, day), lt(stepCache.bucket, count)))
      .orderBy(asc(stepCache.bucket))
      .all();
    for (const r of rows) if (r.bucket >= 0) out[r.bucket] = r.steps;
    return out;
  },

  total(db: Db, day: DayKey): number {
    return db
      .select({ steps: stepCache.steps })
      .from(stepCache)
      .where(eq(stepCache.day, day))
      .all()
      .reduce((sum, r) => sum + r.steps, 0);
  },
};
