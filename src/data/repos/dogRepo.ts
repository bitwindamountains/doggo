import { eq } from 'drizzle-orm';

import type { DogProfile, ISO } from '@/engine';

import type { Db } from '../db';
import { dog } from '../schema';

type DogRow = typeof dog.$inferSelect;

function toProfile(row: DogRow): DogProfile {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    adoptedAt: row.adoptedAt,
    adoptedAsSenior: row.adoptedAsSenior,
    bondPoints: row.bondPoints,
    goodDaysTotal: row.goodDaysTotal,
    walksTotal: row.walksTotal,
    tricks: row.tricks,
  };
}

export const dogRepo = {
  /** The user's dog, or null before onboarding adopts one. */
  get(db: Db): DogProfile | null {
    const row = db.select().from(dog).limit(1).get();
    return row ? toProfile(row) : null;
  },

  /**
   * Inserts or updates the dog. Totals never go down (CLAUDE.md product rule 3): a save
   * that would lower bond, good days or walks keeps the stored value.
   */
  save(db: Db, profile: DogProfile, now: ISO): void {
    const current = db.select().from(dog).where(eq(dog.id, profile.id)).get();
    const row = {
      ...profile,
      bondPoints: Math.max(profile.bondPoints, current?.bondPoints ?? 0),
      goodDaysTotal: Math.max(profile.goodDaysTotal, current?.goodDaysTotal ?? 0),
      walksTotal: Math.max(profile.walksTotal, current?.walksTotal ?? 0),
      updatedAt: now,
    };
    db.insert(dog).values(row).onConflictDoUpdate({ target: dog.id, set: row }).run();
  },
};
