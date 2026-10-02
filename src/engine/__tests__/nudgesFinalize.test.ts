import { HOUR_MS } from '../constants';
import { finalizeDay, newDayLedger } from '../finalizeDay';
import { nudgeBudget, planNudges, shouldAskNudgeFrequency, type NudgeContext } from '../nudges';
import { dayWindow, toMs } from '../time';
import type { Prefs } from '../types';
import { at, DAY, dog, iso, ledger, prefs, summary } from './helpers';

function nctx(now: string, over: Partial<NudgeContext> = {}, p: Prefs = prefs()): NudgeContext {
  return {
    nowMs: at(now, p),
    window: dayWindow(DAY, p),
    prefs: p,
    ledger: ledger(),
    baselineLearning: false,
    activeRequests: [],
    stepsToday: 10_000,
    stepTarget: 5_500,
    lastWalkEndMs: null,
    ...over,
  };
}

const plan = (now: string, over: Partial<NudgeContext> = {}, p?: Prefs) =>
  planNudges(nctx(now, over, p)).map(
    (n) => `${n.type}@${new Date(toMs(n.at) + 8 * HOUR_MS).toISOString().slice(11, 16)}`,
  );

describe('nudge budget (§9)', () => {
  it('is the user setting, one less after 3 ignored days, never negative', () => {
    expect(nudgeBudget(prefs(), ledger())).toBe(3);
    expect(nudgeBudget(prefs({ nudgesPerDay: 1 }), ledger({ ignoredStreakDays: 3 }))).toBe(0);
    expect(nudgeBudget(prefs({ nudgesPerDay: 0 }), ledger({ ignoredStreakDays: 5 }))).toBe(0);
    expect(nudgeBudget(prefs(), ledger({ ignoredStreakDays: 3 }))).toBe(2);
    expect(shouldAskNudgeFrequency(ledger({ ignoredStreakDays: 2 }))).toBe(false);
    expect(shouldAskNudgeFrequency(ledger({ ignoredStreakDays: 3 }))).toBe(true);
  });
});

describe('planNudges (§9)', () => {
  it('always plans the bedtime nudge 30 minutes before bed', () => {
    expect(plan('09:00')).toEqual(['bedtime@22:30']);
  });

  it('sends an active request now, with deep link and copy key', () => {
    const [first] = planNudges(nctx('15:00', { activeRequests: ['leash'] }));
    expect(first).toMatchObject({
      type: 'leash',
      at: iso('15:00'),
      deepLink: 'dogyears://walk',
    });
    expect(first?.copyKey).toMatch(/^push\.leash\.[01]$/);
  });

  it('foresees the leash at walk-check time when the user would still be behind', () => {
    expect(plan('09:00', { stepsToday: 500 })).toEqual(['leash@14:00', 'bedtime@22:30']);
    expect(plan('09:00', { stepsToday: 2_000 })).toEqual(['bedtime@22:30']);
    expect(plan('09:00', { stepsToday: 500, lastWalkEndMs: at('12:00') })).toEqual([
      'bedtime@22:30',
    ]);
    expect(plan('09:00', { stepsToday: 500 }, prefs({ stepsAvailable: false }))).toEqual([
      'bedtime@22:30',
    ]);
  });

  it('never pushes water or rung 1', () => {
    expect(plan('12:00', { activeRequests: ['water'] })).toEqual(['bedtime@22:30']);
  });

  it('keeps 2 hours between nudges, including the last one sent', () => {
    const sent = ledger({ sentCount: 1, lastSentAt: iso('11:00'), sentTypes: ['playBow'] });
    expect(plan('12:00', { activeRequests: ['ball'], ledger: sent })).toEqual([
      'ball@13:00',
      'bedtime@22:30',
    ]);
  });

  it('drops a play bow that cannot go out within 30 minutes', () => {
    const sent = ledger({ sentCount: 1, lastSentAt: iso('11:00'), sentTypes: ['ball'] });
    expect(plan('12:00', { activeRequests: ['playBow'], ledger: sent })).toEqual(['bedtime@22:30']);
  });

  it('waits for quiet hours to end', () => {
    const quiet = prefs({ quietHours: [{ start: '09:00', end: '12:00' }] });
    expect(plan('10:00', { activeRequests: ['ball'] }, quiet)).toEqual([
      'ball@12:00',
      'bedtime@22:30',
    ]);
  });

  it('does not nudge in the first 30 minutes after waking', () => {
    expect(plan('07:10', { activeRequests: ['ball'] })).toEqual(['ball@07:30', 'bedtime@22:30']);
  });

  it('drops types already sent today and step nudges during baseline learning', () => {
    const sent = ledger({ sentCount: 1, lastSentAt: iso('08:00'), sentTypes: ['leash'] });
    expect(plan('15:00', { activeRequests: ['leash'], ledger: sent })).toEqual(['bedtime@22:30']);
    expect(plan('15:00', { activeRequests: ['leash', 'playBow'], baselineLearning: true })).toEqual(
      ['bedtime@22:30'],
    );
  });

  it('gives a contested slot to the higher priority', () => {
    expect(plan('15:00', { activeRequests: ['bored', 'ball', 'leash', 'playBow'] })).toEqual([
      'bored@15:00',
      'ball@17:00', // ball outranks leash; the budget runs out before leash
      'bedtime@22:30',
    ]);
    const one = prefs({ nudgesPerDay: 1 });
    expect(plan('15:00', { activeRequests: ['leash'] }, one)).toEqual(['bedtime@22:30']);
  });

  it('plans nothing once the budget is used, or after bedtime', () => {
    const full = ledger({ sentCount: 3, lastSentAt: iso('16:00'), sentTypes: ['leash'] });
    expect(plan('20:00', { activeRequests: ['ball'], ledger: full })).toEqual([]);
    expect(plan('23:10', { activeRequests: ['ball'] })).toEqual([]);
    expect(plan('12:00', {}, prefs({ nudgesPerDay: 0 }))).toEqual([]);
  });

  it('sends bedtime at once inside the bedtime window', () => {
    expect(plan('22:40')).toEqual(['bedtime@22:40']);
  });
});

describe('finalizeDay', () => {
  const p = { stepsAvailable: true, screenTimeEnabled: true, waterGoal: 8 };
  const day = summary({ walks: 2, water: 7, pets: 5, moodCheckin: true, screenRungMax: 1 });

  it('commits points, good days, walks and tricks', () => {
    const result = finalizeDay(day, dog({ goodDaysTotal: 2, walksTotal: 9 }), ledger(), p);
    // walks 2×2 + pets 3 + mood 1 + good day 5 + calm screen 2
    expect(result.dog.bondPoints).toBe(15);
    expect(result.dog.goodDaysTotal).toBe(3);
    expect(result.dog.walksTotal).toBe(11);
    expect(result.unlockedTricks).toEqual(['sit', 'fetch']);
    expect(result.dog.tricks).toEqual(['sit', 'fetch']);
    expect(result.summary).toMatchObject({ goodDay: true, finalized: true });
  });

  it('is idempotent', () => {
    const once = finalizeDay(day, dog(), ledger(), p);
    const twice = finalizeDay(once.summary, once.dog, once.ledger, p);
    expect(twice.dog).toEqual(once.dog);
    expect(twice.ledger).toEqual(once.ledger);
    expect(twice.unlockedTricks).toEqual([]);
  });

  it('counts ignored days and resets on an opened one', () => {
    const ignored = ledger({ sentCount: 2, openedCount: 0, ignoredStreakDays: 1 });
    expect(finalizeDay(day, dog(), ignored, p).ledger.ignoredStreakDays).toBe(2);
    const opened = ledger({ sentCount: 2, openedCount: 1, ignoredStreakDays: 2 });
    expect(finalizeDay(day, dog(), opened, p).ledger.ignoredStreakDays).toBe(0);
  });

  it('starts a new day ledger carrying the ignored streak', () => {
    expect(newDayLedger('2026-10-06', { ignoredStreakDays: 2 })).toEqual({
      day: '2026-10-06',
      sentCount: 0,
      sentTypes: [],
      openedCount: 0,
      ignoredStreakDays: 2,
    });
    expect(newDayLedger('2026-10-06').ignoredStreakDays).toBe(0);
  });
});
