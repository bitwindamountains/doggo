// §7 Contentment and pose.

import { CONTENTMENT, POSE } from './constants';
import type { Pose, Request, ScreenRung } from './types';

export interface ContentmentInput {
  activeRequests: Request[];
  screenRung: ScreenRung;
  walkEndedWithin2h: boolean;
  petsToday: number;
  water: number;
  waterGoal: number;
  moodCheckedIn: boolean;
}

/** 70 ± modifiers, clamped 20–100: the dog is never miserable. */
export function contentmentFor(input: ContentmentInput): number {
  let penalty = 0;
  for (const request of input.activeRequests) {
    if (request === 'leash' || request === 'ball' || request === 'playBow') {
      penalty += CONTENTMENT.REQUEST_PENALTY;
    } else if (request === 'bored') {
      penalty += CONTENTMENT.BORED_PENALTY;
    }
  }
  if (input.screenRung === 1) penalty += CONTENTMENT.RUNG1_PENALTY;
  penalty = Math.min(penalty, CONTENTMENT.MAX_PENALTY);

  let bonus = 0;
  if (input.walkEndedWithin2h) bonus += CONTENTMENT.RECENT_WALK_BONUS;
  bonus += Math.min(
    Math.max(0, input.petsToday) * CONTENTMENT.PET_BONUS,
    CONTENTMENT.PET_BONUS_MAX,
  );
  if (input.waterGoal > 0 && input.water >= input.waterGoal) bonus += CONTENTMENT.WATER_GOAL_BONUS;
  if (input.moodCheckedIn) bonus += CONTENTMENT.MOOD_BONUS;

  const value = CONTENTMENT.START - penalty + bonus;
  return Math.min(CONTENTMENT.MAX, Math.max(CONTENTMENT.MIN, value));
}

/** Asleep → sleeping; any request → idle (the renderer shows it); otherwise by energy. */
export function poseFor(isAsleep: boolean, request: Request, energy: number): Pose {
  if (isAsleep) return 'sleeping';
  if (request !== 'none') return 'idle';
  if (energy >= POSE.EXCITED_AT) return 'excited';
  if (energy >= POSE.SNIFFING_AT) return 'sniffing';
  return 'resting';
}
