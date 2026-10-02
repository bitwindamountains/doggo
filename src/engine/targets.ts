// §5 Baseline steps and the daily step target.

import { DAY_MS, STEPS } from './constants';
import { toMs } from './time';
import type { DaySummary, DogProfile } from './types';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Median of the last 7 finalized days with steps > 0 (history is most recent first).
 * Returns null while fewer than 3 such days exist (baseline learning).
 */
export function baselineSteps(history: DaySummary[]): number | null {
  const days = history
    .filter((d) => d.finalized && d.steps > 0)
    .slice(0, STEPS.BASELINE_DAYS)
    .map((d) => d.steps);
  return days.length < STEPS.MIN_BASELINE_DAYS ? null : median(days);
}

function clampTarget(steps: number): number {
  return Math.min(STEPS.TARGET_MAX, Math.max(STEPS.TARGET_MIN, steps));
}

function targetFromBaseline(baseline: number): number {
  const round = STEPS.TARGET_ROUND_TO;
  return clampTarget(Math.round((baseline * STEPS.TARGET_MULTIPLIER) / round) * round);
}

/**
 * Today's step target: baseline × 1.10 rounded to 100, clamped 3,000–12,000, and at most
 * 5% above last week's target. Last week's target is computed the same way from the
 * history entries before the most recent 7; when it had no baseline, no ramp cap applies.
 */
export function dailyTarget(history: DaySummary[]): number {
  const baseline = baselineSteps(history);
  if (baseline === null) return STEPS.LEARNING_TARGET;
  const target = targetFromBaseline(baseline);
  const lastWeekBaseline = baselineSteps(history.slice(STEPS.BASELINE_DAYS));
  if (lastWeekBaseline === null) return target;
  const round = STEPS.TARGET_ROUND_TO;
  const cap =
    Math.floor((targetFromBaseline(lastWeekBaseline) * STEPS.WEEKLY_RAMP) / round) * round;
  return clampTarget(Math.min(target, cap));
}

/** Fewer than 7 days since adoption: step requests stay in-app, never pushed. */
export function isBaselineLearning(dog: DogProfile, nowMs: number): boolean {
  return nowMs - toMs(dog.adoptedAt) < STEPS.LEARNING_DAYS_AFTER_ADOPTION * DAY_MS;
}
