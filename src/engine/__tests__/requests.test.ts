import { MINUTE_MS } from '../constants';
import {
  activeRequests,
  ballActive,
  bedtimeActive,
  boredActive,
  bowlLevel,
  leashActive,
  playBowActive,
  sittingSpellActive,
  topRequest,
  waterActive,
  type RequestContext,
} from '../requests';
import { dayWindow } from '../time';
import type { Prefs } from '../types';
import { at, buckets, DAY, prefs } from './helpers';

function ctx(now: string, over: Partial<RequestContext> = {}, p: Prefs = prefs()): RequestContext {
  const stepBuckets = over.stepBuckets ?? buckets(now, [], 100, p);
  return {
    nowMs: at(now, p),
    window: dayWindow(DAY, p),
    prefs: p,
    stepBuckets,
    stepsToday: stepBuckets.reduce((a, b) => a + b, 0),
    stepsLast60: stepBuckets.slice(-6).reduce((a, b) => a + b, 0),
    stepTarget: 5_500,
    lastWalkEndMs: null,
    lastPlayBowAtMs: null,
    screenRung: 0,
    screenAckRung: 0,
    water: 8,
    waterLastAtMs: null,
    ...over,
  };
}

describe('leash (§6.1)', () => {
  // desk-worker: 800 steps by 14:00 vs 0.6 × 5,500 × 7/16 = 1,444
  const behind = { stepsToday: 800 };

  it('asks at walk-check time when behind', () => {
    expect(leashActive(ctx('13:50', behind))).toBe(false);
    expect(leashActive(ctx('14:00', behind))).toBe(true);
    expect(leashActive(ctx('14:00', { stepsToday: 1_500 }))).toBe(false);
  });

  it('stops an hour before bed and after a recent walk', () => {
    expect(leashActive(ctx('22:00', behind))).toBe(true);
    expect(leashActive(ctx('22:10', behind))).toBe(false);
    expect(leashActive(ctx('15:00', { ...behind, lastWalkEndMs: at('12:00') }))).toBe(true);
    expect(leashActive(ctx('15:00', { ...behind, lastWalkEndMs: at('12:00') + MINUTE_MS }))).toBe(
      false,
    );
  });

  it('never asks without step data', () => {
    const p = prefs({ stepsAvailable: false });
    expect(leashActive(ctx('14:00', behind, p))).toBe(false);
  });
});

describe('play bow (§6.2)', () => {
  const sitting = buckets('10:00', [['09:00', '10:00', 0]], 100);

  it('asks after an hour with under 50 steps', () => {
    expect(playBowActive(ctx('10:00', { stepBuckets: sitting }))).toBe(true);
    expect(
      playBowActive(ctx('09:50', { stepBuckets: buckets('09:50', [['09:00', '10:00', 0]], 100) })),
    ).toBe(false);
  });

  it('keeps asking until the last hour reaches 150 steps', () => {
    const some = buckets(
      '10:30',
      [
        ['09:00', '10:00', 0],
        ['10:00', '10:30', 30],
      ],
      100,
    );
    expect(playBowActive(ctx('10:30', { stepBuckets: some }))).toBe(true); // 90 steps
    const enough = buckets(
      '10:30',
      [
        ['09:00', '10:00', 0],
        ['10:00', '10:30', 50],
      ],
      100,
    );
    expect(playBowActive(ctx('10:30', { stepBuckets: enough }))).toBe(false); // 150 steps
  });

  it('clears when answered and waits 90 minutes before asking again', () => {
    const longSit = buckets('12:30', [['09:00', '13:00', 0]], 100);
    const answered = at('10:05');
    expect(
      playBowActive(ctx('10:10', { stepBuckets: longSit.slice(0, 19), lastPlayBowAtMs: answered })),
    ).toBe(false);
    expect(
      playBowActive(ctx('11:30', { stepBuckets: longSit.slice(0, 27), lastPlayBowAtMs: answered })),
    ).toBe(false);
    expect(
      playBowActive(ctx('11:40', { stepBuckets: longSit.slice(0, 28), lastPlayBowAtMs: answered })),
    ).toBe(true);
  });

  it('a spell before an answer still started (the answer was to it)', () => {
    expect(sittingSpellActive(sitting, dayWindow(DAY, prefs()).start, at('12:00'))).toBe(true);
  });

  it('never asks in the first hour, in quiet hours, after a walk, or without steps', () => {
    expect(playBowActive(ctx('07:50', { stepBuckets: buckets('07:50') }))).toBe(false);
    const quiet = prefs({ quietHours: [{ start: '09:30', end: '10:30' }] });
    expect(playBowActive(ctx('10:00', { stepBuckets: sitting }, quiet))).toBe(false);
    expect(playBowActive(ctx('10:00', { stepBuckets: sitting, lastWalkEndMs: at('08:45') }))).toBe(
      false,
    );
    const noSteps = prefs({ stepsAvailable: false });
    expect(playBowActive(ctx('10:00', { stepBuckets: sitting }, noSteps))).toBe(false);
  });
});

describe('ball and bored (§6.3)', () => {
  it('follows rungs and acknowledgements', () => {
    expect(ballActive(1, 0)).toBe(false);
    expect(ballActive(2, 0)).toBe(true);
    expect(ballActive(3, 1)).toBe(true);
    expect(ballActive(2, 2)).toBe(false);
    expect(boredActive(2, 0)).toBe(false);
    expect(boredActive(3, 2)).toBe(true);
    expect(boredActive(3, 3)).toBe(false);
  });
});

describe('water (§6.4)', () => {
  it('bowl starts full and drains against the expected glasses', () => {
    expect(bowlLevel(0, 0)).toBe(1);
    expect(bowlLevel(0, 3)).toBe(0.25);
    expect(bowlLevel(4, 4)).toBe(1);
    expect(bowlLevel(9, 4)).toBe(1);
  });

  it('asks when the bowl is under half, 2+ glasses expected, none in the last 2 h', () => {
    expect(waterActive(ctx('09:00', { water: 0 }))).toBe(false); // 1 glass expected
    expect(waterActive(ctx('11:00', { water: 0 }))).toBe(true); // 2 expected
    expect(waterActive(ctx('11:00', { water: 2 }))).toBe(false);
    expect(waterActive(ctx('11:00', { water: 0, waterLastAtMs: at('09:00') }))).toBe(true);
    expect(waterActive(ctx('11:00', { water: 0, waterLastAtMs: at('09:00') + MINUTE_MS }))).toBe(
      false,
    );
  });
});

describe('bedtime (§6.5) and priority', () => {
  it('asks in the 30 minutes before bed', () => {
    const w = dayWindow(DAY, prefs());
    expect(bedtimeActive(at('22:29'), w)).toBe(false);
    expect(bedtimeActive(at('22:30'), w)).toBe(true);
    expect(bedtimeActive(at('23:00'), w)).toBe(false);
  });

  it('orders bedtime > bored > ball > leash > playBow > water', () => {
    const all = ctx('22:30', {
      stepBuckets: buckets('22:30', [['21:00', '23:00', 0]], 1),
      stepsToday: 100,
      screenRung: 3,
      water: 0,
    });
    // leash already stopped at 22:00 (an hour before bed)
    expect(activeRequests(all)).toEqual(['bedtime', 'bored', 'ball', 'playBow', 'water']);
    const afternoon = ctx('15:00', {
      stepBuckets: buckets('15:00', [['14:00', '15:00', 0]], 1),
      stepsToday: 100,
      screenRung: 3,
      water: 0,
    });
    expect(activeRequests(afternoon)).toEqual(['bored', 'ball', 'leash', 'playBow', 'water']);
    expect(topRequest(activeRequests(all))).toBe('bedtime');
    expect(topRequest([])).toBe('none');
  });

  it('has no requests while asleep', () => {
    expect(activeRequests(ctx('23:30', { screenRung: 3, water: 0 }))).toEqual([]);
  });
});
