// §8 Life stage and tricks. Both only move forward.

import { LIFE_STAGE, TRICKS } from './constants';
import type { DogProfile, LifeStage, TrickId } from './types';

export function lifeStageFor(
  dog: Pick<DogProfile, 'adoptedAsSenior' | 'goodDaysTotal'>,
): LifeStage {
  if (dog.adoptedAsSenior) return 'senior';
  if (dog.goodDaysTotal >= LIFE_STAGE.ADULT_AT_GOOD_DAYS) return 'adult';
  if (dog.goodDaysTotal >= LIFE_STAGE.YOUNG_AT_GOOD_DAYS) return 'young';
  return 'puppy';
}

/** Every trick the dog's totals have earned, in unlock order. */
export function earnedTricks(dog: Pick<DogProfile, 'goodDaysTotal' | 'walksTotal'>): TrickId[] {
  return TRICKS.filter(
    (t) =>
      (t.goodDays !== undefined && dog.goodDaysTotal >= t.goodDays) ||
      (t.walks !== undefined && dog.walksTotal >= t.walks),
  ).map((t) => t.id);
}

/** Tricks earned but not yet learned. */
export function newTricks(dog: DogProfile): TrickId[] {
  return earnedTricks(dog).filter((id) => !dog.tricks.includes(id));
}
