// Onboarding choices (PRD F1), saved in one step at the end. No account required.

import { create } from 'zustand';

import { DEFAULT_STORED_PREFS, dogRepo, prefsRepo, type Db } from '@/data';
import type { Breed, HHmm, ISO } from '@/engine';

export const NAME_MAX = 24;

export interface Draft {
  breed: Breed;
  name: string;
  wakeTime: HHmm;
  bedTime: HHmm;
  nudgesPerDay: 0 | 1 | 2 | 3;
  screenTimeEnabled: boolean;
}

export const DEFAULT_DRAFT: Draft = {
  breed: 'aspin',
  name: '',
  wakeTime: DEFAULT_STORED_PREFS.wakeTime,
  bedTime: DEFAULT_STORED_PREFS.bedTime,
  nudgesPerDay: DEFAULT_STORED_PREFS.nudgesPerDay,
  screenTimeEnabled: false,
};

export const useDraft = create<Draft & { update(d: Partial<Draft>): void }>((set) => ({
  ...DEFAULT_DRAFT,
  update: (d) => set(d),
}));

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidName(name: string): boolean {
  const n = cleanName(name);
  return n.length >= 1 && n.length <= NAME_MAX;
}

/** The device's IANA zone, falling back to the launch market's. */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_STORED_PREFS.timezone;
}

export function completeOnboarding(db: Db, draft: Draft, now: ISO, timezone: string): void {
  if (!isValidName(draft.name)) throw new Error('Invalid dog name');
  db.transaction((tx) => {
    prefsRepo.save(tx, {
      ...DEFAULT_STORED_PREFS,
      timezone,
      wakeTime: draft.wakeTime,
      bedTime: draft.bedTime,
      nudgesPerDay: draft.nudgesPerDay,
      screenTimeEnabled: draft.screenTimeEnabled,
      onboardedAt: now,
    });
    dogRepo.save(
      tx,
      {
        id: `dog-${Date.parse(now)}`,
        name: cleanName(draft.name),
        breed: draft.breed,
        adoptedAt: now,
        adoptedAsSenior: false,
        bondPoints: 0,
        goodDaysTotal: 0,
        walksTotal: 0,
        tricks: [],
      },
      now,
    );
  });
}

/** ±30 minutes on an HH:mm clock, wrapping at midnight. */
export function shiftTime(time: HHmm, minutes: number): HHmm {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
