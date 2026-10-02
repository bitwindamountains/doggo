// §9 Nudge scheduler (pure planning). NotificationService applies the plan.

import {
  BEDTIME,
  LEASH,
  MINUTE_MS,
  NUDGE,
  NUDGE_DEEP_LINKS,
  NUDGE_PRIORITY,
  PUSH_VARIANTS,
} from './constants';
import { variantFor } from './copyKeys';
import { leashThreshold } from './requests';
import { inQuietHours, isAsleepAt, toISO, toMs, walkCheckAt, type DayWindow } from './time';
import type { NudgeLedger, NudgeType, PlannedNudge, Prefs, Request } from './types';

/** Daily budget: the user's setting, one less after 3 ignored days in a row. */
export function nudgeBudget(prefs: Pick<Prefs, 'nudgesPerDay'>, ledger: NudgeLedger): number {
  const backOff = ledger.ignoredStreakDays >= NUDGE.IGNORED_DAYS_FOR_BACKOFF ? 1 : 0;
  return Math.max(0, Math.min(NUDGE.MAX_PER_DAY, prefs.nudgesPerDay) - backOff);
}

export function shouldAskNudgeFrequency(ledger: NudgeLedger): boolean {
  return ledger.ignoredStreakDays >= NUDGE.IGNORED_DAYS_FOR_BACKOFF;
}

export interface NudgeContext {
  nowMs: number;
  window: DayWindow;
  prefs: Prefs;
  ledger: NudgeLedger;
  baselineLearning: boolean;
  activeRequests: Request[];
  stepsToday: number;
  stepTarget: number;
  lastWalkEndMs: number | null;
}

interface Candidate {
  type: NudgeType;
  earliest: number;
  latest: number;
}

/**
 * Candidates for the rest of the day: requests active now, plus the two that can be
 * foreseen — bedtime, and the leash at walk-check time if the user would still be behind
 * with no more steps. Later recomputes cancel a foreseen nudge whose reason went away.
 */
function candidates(ctx: NudgeContext): Candidate[] {
  const { nowMs, window, prefs } = ctx;
  const minute = MINUTE_MS;
  const list: Candidate[] = [];
  const active = new Set(ctx.activeRequests);

  if (active.has('bored')) {
    list.push({
      type: 'bored',
      earliest: nowMs,
      latest: nowMs + NUDGE.SCREEN_MAX_DELAY_MIN * minute,
    });
  }
  if (active.has('ball')) {
    list.push({
      type: 'ball',
      earliest: nowMs,
      latest: nowMs + NUDGE.SCREEN_MAX_DELAY_MIN * minute,
    });
  }
  const leashLatest = window.bedAt - LEASH.STOP_BEFORE_BED_MIN * minute;
  if (active.has('leash')) {
    list.push({ type: 'leash', earliest: nowMs, latest: leashLatest });
  } else if (prefs.stepsAvailable) {
    const checkAt = walkCheckAt(window, prefs);
    const walkBlocksCheck =
      ctx.lastWalkEndMs !== null && checkAt - ctx.lastWalkEndMs < LEASH.RECENT_WALK_MIN * minute;
    if (
      checkAt > nowMs &&
      checkAt <= leashLatest &&
      ctx.stepsToday < leashThreshold(checkAt, window, ctx.stepTarget) &&
      !walkBlocksCheck
    ) {
      list.push({ type: 'leash', earliest: checkAt, latest: leashLatest });
    }
  }
  if (active.has('playBow')) {
    list.push({
      type: 'playBow',
      earliest: nowMs,
      latest: nowMs + NUDGE.PLAY_BOW_MAX_DELAY_MIN * minute,
    });
  }
  const bedtimeStart = window.bedAt - BEDTIME.WINDOW_MIN * minute;
  list.push({
    type: 'bedtime',
    earliest: Math.max(nowMs, bedtimeStart),
    latest: window.bedAt - minute,
  });
  return list;
}

/**
 * Plans pushes from now until bedtime. Rules (drop): budget used, type already sent today,
 * baseline learning for leash/playBow. Rules (time): not in quiet hours, not before wake +
 * 30 min, not after bedtime, at least 120 min from every sent or planned nudge. A candidate
 * that cannot go out now may wait until its latest useful time. Higher priority types are
 * placed first, so they win a contested slot.
 */
export function planNudges(ctx: NudgeContext): PlannedNudge[] {
  const { nowMs, window, prefs, ledger } = ctx;
  if (isAsleepAt(nowMs, window)) return [];

  const slots = nudgeBudget(prefs, ledger) - ledger.sentCount;
  if (slots <= 0) return [];

  const sent = new Set(ledger.sentTypes);
  const gap = NUDGE.MIN_GAP_MIN * MINUTE_MS;
  const notBefore = window.start + NUDGE.AFTER_WAKE_MIN * MINUTE_MS;
  const lastSent = ledger.lastSentAt === undefined ? null : toMs(ledger.lastSentAt);
  const placed: { type: NudgeType; at: number }[] = [];

  const fits = (t: number) =>
    t >= notBefore &&
    t < window.bedAt &&
    (lastSent === null || t - lastSent >= gap) &&
    placed.every((p) => Math.abs(t - p.at) >= gap) &&
    !inQuietHours(t, prefs);

  const ordered = candidates(ctx)
    .filter((c) => !sent.has(c.type))
    .filter((c) => !(ctx.baselineLearning && (c.type === 'leash' || c.type === 'playBow')))
    .sort((a, b) => NUDGE_PRIORITY.indexOf(a.type) - NUDGE_PRIORITY.indexOf(b.type));

  for (const candidate of ordered) {
    if (placed.length >= slots) break;
    const latest = Math.min(candidate.latest, window.bedAt - MINUTE_MS);
    for (let t = candidate.earliest; t <= latest; t += NUDGE.SEARCH_STEP_MIN * MINUTE_MS) {
      if (fits(t)) {
        placed.push({ type: candidate.type, at: t });
        break;
      }
    }
  }

  return placed
    .sort((a, b) => a.at - b.at)
    .map(({ type, at }) => ({
      type,
      at: toISO(at),
      copyKey: `push.${type}.${variantFor(window.day, `push.${type}`, PUSH_VARIANTS[type])}`,
      deepLink: NUDGE_DEEP_LINKS[type],
    }));
}
