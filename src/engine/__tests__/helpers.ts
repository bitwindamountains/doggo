// Builders for engine tests. Times are local HH:mm in Asia/Manila (UTC+8, no DST).

import { DAY_MS, DEFAULT_PREFS, MINUTE_MS } from '../constants';
import { newDayLedger } from '../finalizeDay';
import { addDays, dayWindow, nextLocalTime, parseHHmm, toISO } from '../time';
import type {
  DayKey,
  DaySummary,
  DogProfile,
  EngineInput,
  ISO,
  NudgeLedger,
  Prefs,
  TodayData,
} from '../types';

export const DAY: DayKey = '2026-10-05'; // Monday

export function prefs(over: Partial<Prefs> = {}): Prefs {
  return { ...DEFAULT_PREFS, stepsAvailable: true, ...over };
}

/** Instant of local `hhmm` within the user-day `day` (after its wake time). */
export function at(hhmm: string, p: Prefs = prefs(), day: DayKey = DAY): number {
  return nextLocalTime(dayWindow(day, p).start, parseHHmm(hhmm), p.timezone);
}

export function iso(hhmm: string, p: Prefs = prefs(), day: DayKey = DAY): ISO {
  return toISO(at(hhmm, p, day));
}

export function dog(over: Partial<DogProfile> = {}): DogProfile {
  return {
    id: 'dog-1',
    name: 'Biscuit',
    breed: 'aspin',
    adoptedAt: toISO(dayWindow(DAY, prefs()).start - 30 * DAY_MS),
    adoptedAsSenior: false,
    bondPoints: 0,
    goodDaysTotal: 0,
    walksTotal: 0,
    tricks: [],
    ...over,
  };
}

export function ledger(over: Partial<NudgeLedger> = {}): NudgeLedger {
  return { ...newDayLedger(DAY), ...over };
}

export function summary(over: Partial<DaySummary> = {}): DaySummary {
  return {
    day: DAY,
    steps: 0,
    walks: 0,
    water: 0,
    screenRungMax: 0,
    moodCheckin: false,
    goodDay: false,
    finalized: false,
    pets: 0,
    ...over,
  };
}

/** Finalized history, most recent first, one entry per value. */
export function history(steps: number[]): DaySummary[] {
  return steps.map((s, i) =>
    summary({ day: addDays(DAY, -(i + 1)), steps: s, finalized: true, goodDay: true }),
  );
}

/**
 * Complete 10-minute buckets from wake time until `untilHHmm`. `segments` give steps per
 * bucket for local [from, to) ranges; everything else is `fill`.
 */
export function buckets(
  untilHHmm: string,
  segments: [string, string, number][] = [],
  fill = 0,
  p: Prefs = prefs(),
): number[] {
  const start = dayWindow(DAY, p).start;
  const count = Math.floor((at(untilHHmm, p) - start) / (10 * MINUTE_MS));
  return Array.from({ length: count }, (_, i) => {
    const t = start + i * 10 * MINUTE_MS;
    let steps = fill;
    for (const [from, to, n] of segments) if (t >= at(from, p) && t < at(to, p)) steps = n;
    return steps;
  });
}

export function today(over: Partial<TodayData> = {}, p: Prefs = prefs()): TodayData {
  const w = dayWindow(DAY, p);
  return {
    day: DAY,
    dayStart: toISO(w.start),
    dayEnd: toISO(w.end),
    stepBuckets: [],
    walks: [],
    water: 0,
    screenRung: 0,
    screenAckRung: 0,
    petsToday: 0,
    ...over,
  };
}

export function input(
  now: string,
  over: Partial<Omit<EngineInput, 'now' | 'today'>> & { today?: Partial<TodayData> } = {},
): EngineInput {
  const p = over.prefs ?? prefs();
  return {
    prefs: p,
    dog: dog(),
    history: history([5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000]),
    ledger: ledger(),
    ...over,
    now: iso(now, p),
    today: today(over.today, p),
  };
}
