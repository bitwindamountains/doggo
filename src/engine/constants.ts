// Every tunable number of the dog engine lives here (docs/DOG_ENGINE.md).
// UI code must read these instead of hard-coding its own.

import type { Breed, LifeStage, NudgeType, Pose, Prefs, Request, TrickId } from './types';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_PREFS: Prefs = {
  timezone: 'Asia/Manila',
  wakeTime: '07:00',
  bedTime: '23:00',
  nudgesPerDay: 3,
  quietHours: [],
  waterGoal: 8,
  screenTimeEnabled: false,
  stepsAvailable: false,
};

export const BUCKET_MINUTES = 10;

/** §4 Activity curve. */
export const ACTIVITY = {
  BASE: 20,
  HEIGHT: 70,
  SIGMA_HOURS: 1.5,
  PEAK1_AFTER_WAKE_MIN: 15,
  PEAK2_BEFORE_BED_MIN: 240,
  SENIOR_SHIFT_MIN: 60,
  ASLEEP_ENERGY: 5,
  STAGE_SCALE: { puppy: 1.3, young: 1.15, adult: 1.0, senior: 0.75 } satisfies Record<
    LifeStage,
    number
  >,
} as const;

/** §5 Steps, baseline and targets. */
export const STEPS = {
  BASELINE_DAYS: 7,
  MIN_BASELINE_DAYS: 3,
  LEARNING_TARGET: 5_000,
  TARGET_MULTIPLIER: 1.1,
  TARGET_ROUND_TO: 100,
  TARGET_MIN: 3_000,
  TARGET_MAX: 12_000,
  WEEKLY_RAMP: 1.05,
  LEARNING_DAYS_AFTER_ADOPTION: 7,
} as const;

/** §5 Walk detection. */
export const WALK = {
  WINDOW_BUCKETS: 2,
  WINDOW_STEPS: 1_000,
  MANUAL_MIN_MINUTES: 5,
  LAST_HOUR_BUCKETS: 6,
} as const;

/** §6.1 Leash. */
export const LEASH = {
  CHECK_FRACTION: 0.45,
  CHECK_ROUND_MIN: 30,
  STOP_BEFORE_BED_MIN: 60,
  BEHIND_FACTOR: 0.6,
  RECENT_WALK_MIN: 180,
} as const;

/** §6.2 Play bow. */
export const PLAY_BOW = {
  AFTER_WAKE_MIN: 60,
  START_BELOW_STEPS: 50,
  CLEAR_AT_STEPS: 150,
  COOLDOWN_MIN: 90,
  RECENT_WALK_MIN: 90,
} as const;

/** §6.3 Screen-time rungs: minutes on watched apps for rungs 1–3. */
export const SCREEN_RUNG_MINUTES = [0, 45, 60, 120] as const;

/** §6.4 Water. */
export const WATER = {
  REQUEST_BELOW_LEVEL: 0.5,
  MIN_EXPECTED_GLASSES: 2,
  QUIET_AFTER_LOG_MIN: 120,
  GOOD_DAY_FRACTION: 0.75,
} as const;

/** §6.5 Bedtime. */
export const BEDTIME = { WINDOW_MIN: 30 } as const;

/** §7 Contentment. */
export const CONTENTMENT = {
  START: 70,
  MIN: 20,
  MAX: 100,
  REQUEST_PENALTY: 15, // each of leash / ball / playBow
  BORED_PENALTY: 20,
  MAX_PENALTY: 25,
  RUNG1_PENALTY: 5,
  RECENT_WALK_BONUS: 10,
  RECENT_WALK_MIN: 120,
  PET_BONUS: 5,
  PET_BONUS_MAX: 15,
  WATER_GOAL_BONUS: 5,
  MOOD_BONUS: 5,
} as const;

/** §7 Pose thresholds on energy. */
export const POSE = { EXCITED_AT: 70, SNIFFING_AT: 40 } as const;

/** §7 Greeting thresholds (minutes away). */
export const GREETING = { SMALL_AFTER_MIN: 30, BIG_AFTER_MIN: 120 } as const;

/** Low mood check-in values that make the dog rest its head on the user (PRD F9). */
export const LOW_MOOD_MAX = 2;

/** §8 Bond. */
export const BOND = {
  WALK_POINTS: 2,
  WALKS_COUNTED_PER_DAY: 3,
  PET_POINTS: 1,
  PETS_COUNTED_PER_DAY: 3,
  MOOD_POINTS: 1,
  GOOD_DAY_POINTS: 5,
  CALM_SCREEN_POINTS: 2,
  SCALE: 200,
  TAIL_RIGHT_BIAS_MAX: 0.3,
} as const;

/** §8 Life stage by good days. */
export const LIFE_STAGE = { YOUNG_AT_GOOD_DAYS: 15, ADULT_AT_GOOD_DAYS: 60 } as const;

/** §8 Trick milestones, in unlock order. */
export const TRICKS: readonly { id: TrickId; goodDays?: number; walks?: number }[] = [
  { id: 'sit', goodDays: 3 },
  { id: 'paw', goodDays: 7 },
  { id: 'fetch', walks: 10 },
  { id: 'spin', goodDays: 14 },
  { id: 'rollOver', goodDays: 30 },
  { id: 'highFive', goodDays: 45 },
  { id: 'bow', goodDays: 60 },
  { id: 'dance', goodDays: 100 },
];

/** §9 Nudge scheduler. */
export const NUDGE = {
  MAX_PER_DAY: 3,
  MIN_GAP_MIN: 120,
  AFTER_WAKE_MIN: 30,
  IGNORED_DAYS_FOR_BACKOFF: 3,
  OPENED_WITHIN_MIN: 60,
  SEARCH_STEP_MIN: 5,
  PLAY_BOW_MAX_DELAY_MIN: 30, // a sitting-break nudge is only useful while the user still sits
  SCREEN_MAX_DELAY_MIN: 180,
} as const;

/** §6 Request priority, highest first. */
export const REQUEST_PRIORITY: readonly Request[] = [
  'bedtime',
  'bored',
  'ball',
  'leash',
  'playBow',
  'water',
  'none',
];

/** §9 Nudge priority, highest first. */
export const NUDGE_PRIORITY: readonly NudgeType[] = [
  'bedtime',
  'bored',
  'ball',
  'leash',
  'playBow',
];

/** §9 Deep links per nudge. */
export const NUDGE_DEEP_LINKS: Record<NudgeType, string> = {
  leash: 'dogyears://walk',
  playBow: 'dogyears://home?stretch=1',
  ball: 'dogyears://home?play=1',
  bored: 'dogyears://home?play=1',
  bedtime: 'dogyears://home',
};

/**
 * §10 Number of line variants per copy base. `src/copy/en.ts` must define exactly
 * `${base}.0` … `${base}.${n - 1}` for each base (enforced by the copy test).
 */
export const LINE_VARIANTS = {
  leash: 2,
  playBow: 2,
  ball: 2,
  bored: 2,
  water: 2,
  bedtime: 2,
  sleeping: 2,
  resting: 2,
  sniffing: 2,
  excited: 2,
  idle: 1,
  greetBig: 2,
  greetSmall: 2,
  headRest: 1,
  rung1: 1,
} as const;
export type LineBase = keyof typeof LINE_VARIANTS;

/** §9 Push notification copy variants per nudge type (`push.${type}.${n}`). */
export const PUSH_VARIANTS: Record<NudgeType, number> = {
  leash: 2,
  playBow: 2,
  ball: 2,
  bored: 1,
  bedtime: 2,
};

/** §11 Renderer indices (Rive contract, ARCHITECTURE §7). */
export const RENDER_INDEX = {
  breed: { aspin: 0, shiba: 1, golden: 2, corgi: 3 } satisfies Record<Breed, number>,
  lifeStage: { puppy: 0, young: 1, adult: 2, senior: 3 } satisfies Record<LifeStage, number>,
  pose: { sleeping: 0, resting: 1, idle: 2, sniffing: 3, excited: 4 } satisfies Record<
    Pose,
    number
  >,
  request: {
    none: 0,
    leash: 1,
    playBow: 2,
    ball: 3,
    bored: 4,
    water: 5,
    bedtime: 6,
  } satisfies Record<Request, number>,
  trick: {
    sit: 1,
    paw: 2,
    spin: 3,
    rollOver: 4,
    highFive: 5,
    bow: 6,
    fetch: 7,
    dance: 8,
  } satisfies Record<TrickId, number>,
} as const;
