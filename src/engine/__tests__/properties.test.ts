// Property tests over fuzzed personas (DOG_ENGINE.md §12): contentment stays within 20–100,
// lifetime totals never decrease, pushes per day never exceed the budget, and pushes respect
// spacing, quiet hours and bedtime.

import { MINUTE_MS, NUDGE } from '../constants';
import type { Persona, StepSegment } from '../sim/personas';
import { simulate } from '../sim/simulate';
import { dayWindow, formatHHmm, inQuietHours, toMs } from '../time';
import type { HHmm, Mood } from '../types';

/** Small seeded PRNG (mulberry32) so failures reproduce. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
  const time = (): HHmm => formatHHmm(int(0, 143) * 10);
  return { next, int, pick, time };
}

function fuzzPersona(seed: number): Persona {
  const r = rng(seed);
  const wake = r.int(4, 16) * 60 + r.pick([0, 30]);
  const awake = r.int(13, 19) * 60;
  const steps: StepSegment[] = Array.from({ length: r.int(2, 10) }, () => [
    r.time(),
    r.time(),
    r.pick([0, 0, 10, 40, 120, 600]),
  ]);
  const rungTimes = [r.time(), r.time(), r.time()].sort();
  return {
    id: `fuzz-${seed}`,
    description: 'fuzzed',
    prefs: {
      timezone: r.pick(['Asia/Manila', 'America/Los_Angeles', 'America/New_York']),
      wakeTime: formatHHmm(wake),
      bedTime: formatHHmm(wake + awake),
      weekendWakeTime: r.next() < 0.3 ? formatHHmm(wake + 120) : undefined,
      nudgesPerDay: r.pick([0, 1, 2, 3] as const),
      quietHours: r.next() < 0.5 ? [{ start: r.time(), end: r.time() }] : [],
      waterGoal: r.int(0, 12),
      screenTimeEnabled: r.next() < 0.6,
      stepsAvailable: r.next() < 0.8,
    },
    startDay: r.pick(['2026-10-02', '2026-10-30', '2027-03-12']),
    days: 3,
    dog: {
      name: 'Fuzz',
      breed: 'aspin',
      adoptedDaysBeforeStart: r.int(0, 20),
      adoptedAsSenior: r.next() < 0.2,
      bondPoints: r.int(0, 500),
      goodDaysTotal: r.int(0, 120),
      walksTotal: r.int(0, 50),
    },
    historySteps: Array.from({ length: r.int(0, 14) }, () => r.int(0, 15_000)),
    steps,
    screen: [1, 2, 3].slice(0, r.int(0, 3)).map((rung, i) => ({
      rung: rung as 1 | 2 | 3,
      at: rungTimes[i] as HHmm,
    })),
    water: Array.from({ length: r.int(0, 10) }, () => r.time()),
    pets: Array.from({ length: r.int(0, 5) }, () => r.time()),
    mood: r.next() < 0.5 ? { at: r.time(), value: r.int(1, 5) as Mood } : undefined,
    manualWalks:
      r.next() < 0.3 ? [{ start: r.time(), minutes: r.int(1, 60), steps: r.int(0, 4_000) }] : [],
    lastOpenedDaysAgo: r.next() < 0.5 ? r.int(0, 30) : undefined,
    opensNudges: r.next() < 0.5,
  };
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe.each(SEEDS)('fuzzed persona seed %i', (seed) => {
  const persona = fuzzPersona(seed);
  const result = simulate(persona);

  it('keeps contentment, energy, bond and bowl in range', () => {
    for (const day of result.days) {
      for (const row of day.rows) {
        expect(row.contentment).toBeGreaterThanOrEqual(20);
        expect(row.contentment).toBeLessThanOrEqual(100);
        expect(row.energy).toBeGreaterThanOrEqual(0);
        expect(row.energy).toBeLessThanOrEqual(100);
        expect(row.bond).toBeGreaterThanOrEqual(0);
        expect(row.bond).toBeLessThanOrEqual(100);
      }
    }
  });

  it('never decreases bond points, good days, walks or tricks', () => {
    expect(result.dog.bondPoints).toBeGreaterThanOrEqual(result.dogBefore.bondPoints);
    expect(result.dog.goodDaysTotal).toBeGreaterThanOrEqual(result.dogBefore.goodDaysTotal);
    expect(result.dog.walksTotal).toBeGreaterThanOrEqual(result.dogBefore.walksTotal);
    for (const trick of result.dogBefore.tricks) expect(result.dog.tricks).toContain(trick);
    // The bond shown never drops: not within a day, and not from one day to the next.
    let previous = 0;
    for (const day of result.days) {
      for (const row of day.rows) {
        expect(row.bond).toBeGreaterThanOrEqual(previous);
        previous = row.bond;
      }
    }
  });

  it('keeps pushes within budget, spaced, outside quiet hours and before bed', () => {
    for (const day of result.days) {
      expect(day.pushes.length).toBeLessThanOrEqual(day.budget);
      expect(day.budget).toBeLessThanOrEqual(persona.prefs.nudgesPerDay);
      const w = dayWindow(day.day, persona.prefs);
      const times = day.pushes.map((p) => toMs(p.at));
      for (const [i, t] of times.entries()) {
        expect(t).toBeGreaterThanOrEqual(w.start + NUDGE.AFTER_WAKE_MIN * MINUTE_MS);
        expect(t).toBeLessThan(w.bedAt);
        expect(inQuietHours(t, persona.prefs)).toBe(false);
        if (i > 0)
          expect(t - (times[i - 1] as number)).toBeGreaterThanOrEqual(
            NUDGE.MIN_GAP_MIN * MINUTE_MS,
          );
      }
      expect(new Set(day.pushes.map((p) => p.type)).size).toBe(day.pushes.length);
    }
  });
});
