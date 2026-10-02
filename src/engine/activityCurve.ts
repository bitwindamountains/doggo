// §4 Activity curve: two peaks (after waking and in the evening), resting in between.

import { ACTIVITY, HOUR_MS, MINUTE_MS } from './constants';
import { isAsleepAt, type DayWindow } from './time';
import type { LifeStage } from './types';

function bump(ms: number, peak: number): number {
  const hours = (ms - peak) / HOUR_MS;
  return Math.exp(-(hours * hours) / (2 * ACTIVITY.SIGMA_HOURS * ACTIVITY.SIGMA_HOURS));
}

/** Peak instants for the day; seniors peak one hour earlier. */
export function activityPeaks(w: DayWindow, lifeStage: LifeStage): [number, number] {
  const shift = lifeStage === 'senior' ? ACTIVITY.SENIOR_SHIFT_MIN * MINUTE_MS : 0;
  return [
    w.start + ACTIVITY.PEAK1_AFTER_WAKE_MIN * MINUTE_MS - shift,
    w.bedAt - ACTIVITY.PEAK2_BEFORE_BED_MIN * MINUTE_MS - shift,
  ];
}

/** Energy 0–100 at an instant. */
export function energyAt(ms: number, w: DayWindow, lifeStage: LifeStage): number {
  if (isAsleepAt(ms, w)) return ACTIVITY.ASLEEP_ENERGY;
  const [p1, p2] = activityPeaks(w, lifeStage);
  const raw =
    ACTIVITY.BASE +
    ACTIVITY.HEIGHT * ACTIVITY.STAGE_SCALE[lifeStage] * (bump(ms, p1) + bump(ms, p2));
  return Math.round(Math.min(100, Math.max(0, raw)));
}
