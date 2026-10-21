import { DEFAULT_PREFS, type ISO, type Prefs } from '@/engine';

import type { Db } from '../db';
import { prefs } from '../schema';

/** Prefs as stored. `stepsAvailable` is runtime state from HealthService, not a pref. */
export type StoredPrefs = Omit<Prefs, 'stepsAvailable'> & {
  locale: string;
  onboardedAt?: ISO;
};

export const DEFAULT_STORED_PREFS: StoredPrefs = {
  timezone: DEFAULT_PREFS.timezone,
  wakeTime: DEFAULT_PREFS.wakeTime,
  bedTime: DEFAULT_PREFS.bedTime,
  nudgesPerDay: DEFAULT_PREFS.nudgesPerDay,
  quietHours: DEFAULT_PREFS.quietHours,
  waterGoal: DEFAULT_PREFS.waterGoal,
  screenTimeEnabled: DEFAULT_PREFS.screenTimeEnabled,
  locale: 'en',
};

const ROW_ID = 1;

export const prefsRepo = {
  /** Stored prefs, or null before onboarding saves them. */
  get(db: Db): StoredPrefs | null {
    const row = db.select().from(prefs).get();
    if (!row) return null;
    return {
      timezone: row.timezone,
      wakeTime: row.wakeTime,
      bedTime: row.bedTime,
      weekendWakeTime: row.weekendWakeTime ?? undefined,
      weekendBedTime: row.weekendBedTime ?? undefined,
      walkCheckTime: row.walkCheckTime ?? undefined,
      nudgesPerDay: row.nudgesPerDay,
      quietHours: row.quietHours,
      waterGoal: row.waterGoal,
      screenTimeEnabled: row.screenTimeEnabled,
      locale: row.locale,
      onboardedAt: row.onboardedAt ?? undefined,
    };
  },

  save(db: Db, value: StoredPrefs): void {
    const row = {
      id: ROW_ID,
      ...value,
      weekendWakeTime: value.weekendWakeTime ?? null,
      weekendBedTime: value.weekendBedTime ?? null,
      walkCheckTime: value.walkCheckTime ?? null,
      onboardedAt: value.onboardedAt ?? null,
    };
    db.insert(prefs).values(row).onConflictDoUpdate({ target: prefs.id, set: row }).run();
  },
};
