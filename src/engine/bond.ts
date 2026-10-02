// §8 Bond. Points only ever go up.

import { BOND } from './constants';

export interface DayActivity {
  walks: number;
  pets: number;
  moodCheckin: boolean;
}

/** Points earned through the day's actions (walks, pets, check-in), with daily caps. */
export function activityPoints({ walks, pets, moodCheckin }: DayActivity): number {
  return (
    Math.min(walks, BOND.WALKS_COUNTED_PER_DAY) * BOND.WALK_POINTS +
    Math.min(pets, BOND.PETS_COUNTED_PER_DAY) * BOND.PET_POINTS +
    (moodCheckin ? BOND.MOOD_POINTS : 0)
  );
}

/** Points added at day finalization. */
export function finalizationPoints(goodDay: boolean, calmScreenDay: boolean): number {
  return (goodDay ? BOND.GOOD_DAY_POINTS : 0) + (calmScreenDay ? BOND.CALM_SCREEN_POINTS : 0);
}

/** bond = round(100 × (1 − e^(−points / 200))), 0–100. */
export function bondFromPoints(points: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(0, points) / BOND.SCALE)));
}

/** Tail-wag right bias for the renderer: 0.3 × bond / 100. */
export function tailRightBias(bond: number): number {
  return (BOND.TAIL_RIGHT_BIAS_MAX * bond) / 100;
}
