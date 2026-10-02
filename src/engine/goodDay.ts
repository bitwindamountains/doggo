// §8 Good day: at least 2 of the criteria that are available to this user.

import { WATER } from './constants';
import type { DaySummary, Prefs } from './types';

export interface Criterion {
  available: boolean;
  met: boolean;
}

export function goodDayCriteria(
  summary: DaySummary,
  prefs: Pick<Prefs, 'stepsAvailable' | 'screenTimeEnabled' | 'waterGoal'>,
): Record<'movement' | 'water' | 'calmScreen' | 'mood', Criterion> {
  return {
    movement: {
      available: prefs.stepsAvailable || summary.walks > 0,
      met:
        summary.walks >= 1 ||
        (summary.stepTarget !== undefined && summary.steps >= summary.stepTarget),
    },
    water: {
      available: prefs.waterGoal > 0,
      met: summary.water >= WATER.GOOD_DAY_FRACTION * prefs.waterGoal,
    },
    calmScreen: { available: prefs.screenTimeEnabled, met: summary.screenRungMax <= 1 },
    mood: { available: true, met: summary.moodCheckin },
  };
}

export function isGoodDay(
  summary: DaySummary,
  prefs: Pick<Prefs, 'stepsAvailable' | 'screenTimeEnabled' | 'waterGoal'>,
): boolean {
  const criteria = Object.values(goodDayCriteria(summary, prefs)).filter((c) => c.available);
  const required = Math.min(2, criteria.length);
  return criteria.filter((c) => c.met).length >= required;
}
