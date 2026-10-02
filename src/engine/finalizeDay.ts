// Day finalization: commits a finished day to the dog's lifetime totals. Pure and
// idempotent — a summary that is already finalized comes back unchanged.

import { activityPoints, finalizationPoints } from './bond';
import { isGoodDay } from './goodDay';
import { newTricks } from './growth';
import type { DayKey, DaySummary, DogProfile, NudgeLedger, Prefs, TrickId } from './types';

export interface FinalizeResult {
  summary: DaySummary;
  dog: DogProfile;
  ledger: NudgeLedger;
  unlockedTricks: TrickId[];
}

export function finalizeDay(
  summary: DaySummary,
  dog: DogProfile,
  ledger: NudgeLedger,
  prefs: Pick<Prefs, 'stepsAvailable' | 'screenTimeEnabled' | 'waterGoal'>,
): FinalizeResult {
  if (summary.finalized) return { summary, dog, ledger, unlockedTricks: [] };

  const goodDay = isGoodDay(summary, prefs);
  const calmScreenDay = prefs.screenTimeEnabled && summary.screenRungMax <= 1;
  const points =
    activityPoints({ walks: summary.walks, pets: summary.pets, moodCheckin: summary.moodCheckin }) +
    finalizationPoints(goodDay, calmScreenDay);

  const grown: DogProfile = {
    ...dog,
    bondPoints: dog.bondPoints + points,
    goodDaysTotal: dog.goodDaysTotal + (goodDay ? 1 : 0),
    walksTotal: dog.walksTotal + summary.walks,
  };
  const unlockedTricks = newTricks(grown);
  // "Ignored" day: nudges went out and none was opened (within 60 minutes).
  const ignored = summary.day === ledger.day && ledger.sentCount > 0 && ledger.openedCount === 0;

  return {
    summary: { ...summary, goodDay, finalized: true },
    dog: { ...grown, tricks: [...grown.tricks, ...unlockedTricks] },
    ledger: { ...ledger, ignoredStreakDays: ignored ? ledger.ignoredStreakDays + 1 : 0 },
    unlockedTricks,
  };
}

/** A fresh ledger for a new day; the ignored streak carries over. */
export function newDayLedger(
  day: DayKey,
  previous?: Pick<NudgeLedger, 'ignoredStreakDays'>,
): NudgeLedger {
  return {
    day,
    sentCount: 0,
    sentTypes: [],
    openedCount: 0,
    ignoredStreakDays: previous?.ignoredStreakDays ?? 0,
  };
}
