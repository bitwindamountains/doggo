// §5 Walk detection from 10-minute step buckets.

import { BUCKET_MINUTES, MINUTE_MS, WALK } from './constants';
import { toISO, toMs } from './time';
import type { WalkEvent } from './types';

const BUCKET_MS = BUCKET_MINUTES * MINUTE_MS;

export function sumSteps(buckets: number[]): number {
  return buckets.reduce((total, steps) => total + steps, 0);
}

/** Steps in the last 60 minutes (the last six buckets). */
export function stepsLastHour(buckets: number[]): number {
  return sumSteps(buckets.slice(-WALK.LAST_HOUR_BUCKETS));
}

/** Manual walks count only when at least 5 minutes long; detected walks always count. */
export function countableWalks(walks: WalkEvent[]): WalkEvent[] {
  return walks.filter(
    (w) =>
      w.source === 'detected' || toMs(w.end) - toMs(w.start) >= WALK.MANUAL_MIN_MINUTES * MINUTE_MS,
  );
}

/** End of the most recent walk that has ended by `nowMs`, or null. */
export function lastWalkEnd(walks: WalkEvent[], nowMs: number): number | null {
  let latest: number | null = null;
  for (const walk of walks) {
    const end = toMs(walk.end);
    if (end <= nowMs && (latest === null || end > latest)) latest = end;
  }
  return latest;
}

/**
 * Finds walks in the step buckets: any rolling 20-minute window (two consecutive buckets)
 * with at least 1,000 steps. Overlapping qualifying windows merge into one run. A run that
 * overlaps an existing walk is the same walk (already recorded, or still going), so only
 * runs that overlap no existing walk are returned.
 */
export function detectWalks(
  buckets: number[],
  dayStartMs: number,
  nowMs: number,
  existing: WalkEvent[],
): WalkEvent[] {
  const qualifies = (i: number) =>
    i + 1 < buckets.length &&
    (buckets[i] as number) + (buckets[i + 1] as number) >= WALK.WINDOW_STEPS;
  const taken = existing.map((w) => [toMs(w.start), toMs(w.end)] as const);
  const found: WalkEvent[] = [];

  let i = 0;
  while (i < buckets.length) {
    if (!qualifies(i)) {
      i += 1;
      continue;
    }
    let last = i + 1; // last bucket in the run
    while (qualifies(last)) last += 1;
    const start = dayStartMs + i * BUCKET_MS;
    const end = Math.min(dayStartMs + (last + 1) * BUCKET_MS, nowMs);
    const overlaps = taken.some(([s, e]) => start < e && s < end);
    if (!overlaps && end > start) {
      found.push({
        start: toISO(start),
        end: toISO(end),
        steps: sumSteps(buckets.slice(i, last + 1)),
        source: 'detected',
      });
    }
    i = last + 1;
  }
  return found;
}
