// §6 Requests: what the dog is asking for right now.

import {
  BEDTIME,
  BUCKET_MINUTES,
  LEASH,
  MINUTE_MS,
  PLAY_BOW,
  REQUEST_PRIORITY,
  WALK,
  WATER,
} from './constants';
import { inQuietHours, isAsleepAt, wakingFraction, walkCheckAt, type DayWindow } from './time';
import type { Prefs, Request, ScreenRung } from './types';
import { sumSteps } from './walks';

export interface RequestContext {
  nowMs: number;
  window: DayWindow;
  prefs: Prefs;
  stepBuckets: number[];
  stepsToday: number;
  stepsLast60: number;
  stepTarget: number;
  lastWalkEndMs: number | null;
  lastPlayBowAtMs: number | null;
  screenRung: ScreenRung;
  screenAckRung: ScreenRung; // already includes "a walk after the rung acknowledges it"
  water: number;
  waterLastAtMs: number | null;
}

function walkEndedWithin(ctx: RequestContext, minutes: number): boolean {
  return ctx.lastWalkEndMs !== null && ctx.nowMs - ctx.lastWalkEndMs < minutes * MINUTE_MS;
}

/** Steps the user "should" have by `ms` for the leash rule: 0.6 × target × wakingFraction. */
export function leashThreshold(ms: number, window: DayWindow, stepTarget: number): number {
  return LEASH.BEHIND_FACTOR * stepTarget * wakingFraction(ms, window);
}

/** §6.1 */
export function leashActive(ctx: RequestContext): boolean {
  const { nowMs, window } = ctx;
  return (
    ctx.prefs.stepsAvailable &&
    nowMs >= walkCheckAt(window, ctx.prefs) &&
    nowMs <= window.bedAt - LEASH.STOP_BEFORE_BED_MIN * MINUTE_MS &&
    ctx.stepsToday < leashThreshold(nowMs, window, ctx.stepTarget) &&
    !walkEndedWithin(ctx, LEASH.RECENT_WALK_MIN)
  );
}

/**
 * §6.2 Sitting state with hysteresis, replayed over the day's buckets: a sitting spell
 * starts when the last hour has fewer than 50 steps, and ends when it reaches 150 steps or
 * the user answers the play bow. A new spell cannot start within 90 minutes of an answer.
 */
export function sittingSpellActive(
  buckets: number[],
  dayStartMs: number,
  lastPlayBowAtMs: number | null,
): boolean {
  const hour = WALK.LAST_HOUR_BUCKETS;
  let active = false;
  let since = 0;
  for (let k = hour; k <= buckets.length; k += 1) {
    const windowEnd = dayStartMs + k * BUCKET_MINUTES * MINUTE_MS;
    const steps = sumSteps(buckets.slice(k - hour, k));
    const answered = lastPlayBowAtMs !== null && lastPlayBowAtMs <= windowEnd;
    if (active) {
      if (steps >= PLAY_BOW.CLEAR_AT_STEPS || (answered && (lastPlayBowAtMs as number) >= since)) {
        active = false;
      }
    } else if (
      steps < PLAY_BOW.START_BELOW_STEPS &&
      windowEnd >= dayStartMs + PLAY_BOW.AFTER_WAKE_MIN * MINUTE_MS &&
      (!answered || windowEnd - (lastPlayBowAtMs as number) >= PLAY_BOW.COOLDOWN_MIN * MINUTE_MS)
    ) {
      active = true;
      since = windowEnd;
    }
  }
  return active;
}

/** §6.2 */
export function playBowActive(ctx: RequestContext): boolean {
  const { nowMs, window } = ctx;
  return (
    ctx.prefs.stepsAvailable &&
    !isAsleepAt(nowMs, window) &&
    nowMs >= window.start + PLAY_BOW.AFTER_WAKE_MIN * MINUTE_MS &&
    !inQuietHours(nowMs, ctx.prefs) &&
    (ctx.lastPlayBowAtMs === null ||
      nowMs - ctx.lastPlayBowAtMs >= PLAY_BOW.COOLDOWN_MIN * MINUTE_MS) &&
    !walkEndedWithin(ctx, PLAY_BOW.RECENT_WALK_MIN) &&
    sittingSpellActive(ctx.stepBuckets, window.start, ctx.lastPlayBowAtMs)
  );
}

/** §6.3 */
export function ballActive(rung: ScreenRung, ack: ScreenRung): boolean {
  return rung >= 2 && ack < 2;
}

/** §6.3 */
export function boredActive(rung: ScreenRung, ack: ScreenRung): boolean {
  return rung === 3 && ack < 3;
}

/** §6.4 Expected glasses by now: goal × wakingFraction. */
export function expectedWater(goal: number, fraction: number): number {
  return goal * fraction;
}

/**
 * §6.4 Bowl level 0–1. The bowl starts full at wake time and drains as the day goes on:
 * (water + 1) / (expected + 1). See DOG_ENGINE.md §6.4 for why the +1.
 */
export function bowlLevel(water: number, expected: number): number {
  return Math.min(1, Math.max(0, (water + 1) / (expected + 1)));
}

/** §6.4 In-app only. */
export function waterActive(ctx: RequestContext): boolean {
  const expected = expectedWater(ctx.prefs.waterGoal, wakingFraction(ctx.nowMs, ctx.window));
  return (
    !isAsleepAt(ctx.nowMs, ctx.window) &&
    bowlLevel(ctx.water, expected) < WATER.REQUEST_BELOW_LEVEL &&
    expected >= WATER.MIN_EXPECTED_GLASSES &&
    (ctx.waterLastAtMs === null ||
      ctx.nowMs - ctx.waterLastAtMs >= WATER.QUIET_AFTER_LOG_MIN * MINUTE_MS)
  );
}

/** §6.5 The half hour before bedtime. */
export function bedtimeActive(nowMs: number, window: DayWindow): boolean {
  return nowMs >= window.bedAt - BEDTIME.WINDOW_MIN * MINUTE_MS && nowMs < window.bedAt;
}

/** Every request whose conditions hold, highest priority first. Empty while asleep. */
export function activeRequests(ctx: RequestContext): Request[] {
  if (isAsleepAt(ctx.nowMs, ctx.window)) return [];
  const holds: Record<Exclude<Request, 'none'>, boolean> = {
    bedtime: bedtimeActive(ctx.nowMs, ctx.window),
    bored: boredActive(ctx.screenRung, ctx.screenAckRung),
    ball: ballActive(ctx.screenRung, ctx.screenAckRung),
    leash: leashActive(ctx),
    playBow: playBowActive(ctx),
    water: waterActive(ctx),
  };
  return REQUEST_PRIORITY.filter((r): r is Exclude<Request, 'none'> => r !== 'none' && holds[r]);
}

export function topRequest(active: Request[]): Request {
  return active[0] ?? 'none';
}
