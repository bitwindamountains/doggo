import { computeDog } from '@/engine';

import { buildEngineInput } from '../buildEngineInput';
import type { Db } from '../db';
import { deleteAllData } from '../deleteAll';
import { finalizePastDays } from '../finalizePastDays';
import { recompute } from '../recompute';
import { dayRepo, dogRepo, eventsRepo, ledgerRepo, prefsRepo, stepCacheRepo } from '../repos';
import { DOG, PREFS } from './fixtures';
import { createTestDb } from './testDb';

// Asia/Manila (UTC+8), wake 07:00: day 2026-10-21 starts at 2026-10-20T23:00Z.
const DAY_START = '2026-10-20T23:00:00.000Z';
const NOON = '2026-10-21T04:00:00.000Z'; // 12:00 local, 30 completed buckets
const RUNTIME = { stepsAvailable: true };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

function onboard(adoptedAt = DOG.adoptedAt) {
  prefsRepo.save(db, PREFS);
  dogRepo.save(db, { ...DOG, adoptedAt }, adoptedAt);
}

describe('buildEngineInput', () => {
  it('returns null before onboarding', () => {
    expect(buildEngineInput(db, NOON, RUNTIME)).toBeNull();
    prefsRepo.save(db, PREFS);
    expect(buildEngineInput(db, NOON, RUNTIME)).toBeNull();
  });

  it('assembles today from stored events, steps, history and ledger', () => {
    onboard();
    eventsRepo.add(db, 'water_logged', '2026-10-20T22:00:00.000Z', null); // yesterday
    eventsRepo.add(db, 'water_logged', '2026-10-21T00:00:00.000Z', null);
    eventsRepo.add(db, 'water_logged', '2026-10-21T02:00:00.000Z', null);
    eventsRepo.add(db, 'walk_ended', '2026-10-21T01:30:00.000Z', {
      start: '2026-10-21T01:00:00.000Z',
      steps: 2400,
    });
    eventsRepo.add(db, 'mood_checkin', '2026-10-21T00:30:00.000Z', { mood: 2 });
    eventsRepo.add(db, 'mood_checkin', '2026-10-21T03:00:00.000Z', { mood: 4 });
    eventsRepo.add(db, 'pet', '2026-10-21T03:10:00.000Z', null);
    eventsRepo.add(db, 'pet', '2026-10-21T03:20:00.000Z', null);
    // Rung 2 (60 min) fired 30 minutes after the day started: early fire, ignored.
    eventsRepo.add(db, 'screen_rung', '2026-10-21T00:00:00.000Z', {
      rung: 2,
      firedAt: '2026-10-20T23:30:00.000Z',
    });
    eventsRepo.add(db, 'screen_rung', '2026-10-21T03:00:00.000Z', {
      rung: 1,
      firedAt: '2026-10-21T02:50:00.000Z',
    });
    eventsRepo.add(db, 'play_bow_answered', '2026-10-21T03:30:00.000Z', null);
    eventsRepo.add(db, 'app_opened', '2026-10-21T00:05:00.000Z', null);
    eventsRepo.add(db, 'pet', '2026-10-21T04:30:00.000Z', null); // after now
    stepCacheRepo.upsert(db, '2026-10-21', [
      { bucket: 0, steps: 120 },
      { bucket: 29, steps: 80 },
      { bucket: 30, steps: 999 }, // the bucket still in progress
    ]);
    dayRepo.save(db, {
      day: '2026-10-20',
      steps: 6000,
      walks: 1,
      water: 8,
      screenRungMax: 0,
      moodCheckin: true,
      goodDay: true,
      finalized: true,
      pets: 1,
    });
    ledgerRepo.recordSent(db, '2026-10-21', 'leash', '2026-10-21T03:00:00.000Z');

    const input = buildEngineInput(db, NOON, { stepsAvailable: true, reduceMotion: true });
    expect(input).not.toBeNull();
    if (!input) return;
    expect(input.prefs).toMatchObject({ timezone: 'Asia/Manila', stepsAvailable: true });
    expect(input.prefs).not.toHaveProperty('locale');
    expect(input.today).toMatchObject({
      day: '2026-10-21',
      dayStart: DAY_START,
      water: 2,
      waterLastAt: '2026-10-21T02:00:00.000Z',
      screenRung: 1,
      screenRungAt: '2026-10-21T02:50:00.000Z',
      screenAckRung: 0,
      moodToday: 4,
      petsToday: 2,
      walks: [
        {
          start: '2026-10-21T01:00:00.000Z',
          end: '2026-10-21T01:30:00.000Z',
          steps: 2400,
          source: 'manual',
        },
      ],
    });
    expect(input.today.stepBuckets).toHaveLength(30);
    expect(input.today.stepBuckets[0]).toBe(120);
    expect(input.today.stepBuckets[29]).toBe(80);
    expect(input.history.map((d) => d.day)).toEqual(['2026-10-20']);
    expect(input.ledger).toMatchObject({ day: '2026-10-21', sentCount: 1 });
    expect(input.lastOpenedAt).toBe('2026-10-21T00:05:00.000Z');
    expect(input.lastPlayBowAt).toBe('2026-10-21T03:30:00.000Z');
    expect(input.reduceMotion).toBe(true);

    // The engine accepts it as is.
    expect(computeDog(input).state.contentment).toBeGreaterThanOrEqual(20);
  });

  it('counts a "Play" tap as acknowledging the rung', () => {
    onboard();
    eventsRepo.add(db, 'screen_rung', '2026-10-21T03:00:00.000Z', {
      rung: 2,
      firedAt: '2026-10-21T02:00:00.000Z',
    });
    eventsRepo.add(db, 'ball_played', '2026-10-21T03:05:00.000Z', { rung: 2 });
    const input = buildEngineInput(db, NOON, RUNTIME);
    expect(input?.today).toMatchObject({ screenRung: 2, screenAckRung: 2 });
    expect(input && computeDog(input).activeRequests).not.toContain('ball');
  });
});

describe('finalizePastDays', () => {
  // Adopted on the morning of 10-18 local; today is 10-21.
  const ADOPTED = '2026-10-18T00:00:00.000Z';

  function seedPastDays() {
    onboard(ADOPTED);
    // 10-19: a full water day and a check-in → a good day.
    for (let h = 0; h < 8; h++) {
      eventsRepo.add(db, 'water_logged', `2026-10-19T0${h}:00:00.000Z`, null);
    }
    eventsRepo.add(db, 'mood_checkin', '2026-10-19T09:00:00.000Z', { mood: 3 });
    eventsRepo.add(db, 'pet', '2026-10-19T09:05:00.000Z', null);
    // 10-20: steps with a walk the app never saw (600 + 600 steps in two buckets).
    stepCacheRepo.upsert(db, '2026-10-20', [
      { bucket: 12, steps: 600 },
      { bucket: 13, steps: 600 },
      { bucket: 20, steps: 300 },
    ]);
    ledgerRepo.recordSent(db, '2026-10-20', 'leash', '2026-10-20T06:00:00.000Z');
  }

  it('finalizes every past day since adoption, in order', () => {
    seedPastDays();
    const done = finalizePastDays(db, NOON, RUNTIME);
    expect(done.map((d) => d.day)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);

    const d19 = dayRepo.get(db, '2026-10-19');
    expect(d19).toMatchObject({
      water: 8,
      moodCheckin: true,
      moodMin: 3,
      pets: 1,
      finalized: true,
    });
    const d20 = dayRepo.get(db, '2026-10-20');
    expect(d20).toMatchObject({ steps: 1500, walks: 1, finalized: true, stepTarget: 5000 });
    expect(dayRepo.get(db, '2026-10-21')).toBeNull(); // today stays open

    const dog = dogRepo.get(db);
    expect(dog?.walksTotal).toBe(DOG.walksTotal + 1);
    expect(dog?.goodDaysTotal).toBe(DOG.goodDaysTotal + done.filter((d) => d.goodDay).length);
    expect(dog?.bondPoints).toBeGreaterThan(DOG.bondPoints);
    // 10-20 sent a push nobody opened: an ignored day.
    expect(ledgerRepo.find(db, '2026-10-20')?.ignoredStreakDays).toBe(1);
  });

  it('is idempotent: running it twice changes nothing the second time', () => {
    seedPastDays();
    finalizePastDays(db, NOON, RUNTIME);
    const dogAfterFirst = dogRepo.get(db);
    const daysAfterFirst = dayRepo.historyBefore(db, '2026-10-21');
    const walkEvents = () =>
      eventsRepo
        .between(db, '2026-10-01T00:00:00.000Z', NOON)
        .filter((e) => e.type === 'walk_detected');
    expect(walkEvents()).toHaveLength(1);

    expect(finalizePastDays(db, NOON, RUNTIME)).toEqual([]);
    expect(finalizePastDays(db, '2026-10-21T10:00:00.000Z', RUNTIME)).toEqual([]);
    expect(dogRepo.get(db)).toEqual(dogAfterFirst);
    expect(dayRepo.historyBefore(db, '2026-10-21')).toEqual(daysAfterFirst);
    expect(walkEvents()).toHaveLength(1);
  });

  it('picks up from the last finalized day the next morning', () => {
    seedPastDays();
    finalizePastDays(db, NOON, RUNTIME);
    const done = finalizePastDays(db, '2026-10-22T04:00:00.000Z', RUNTIME);
    expect(done.map((d) => d.day)).toEqual(['2026-10-21']);
  });

  it('does not detect walks from steps when steps are unavailable', () => {
    seedPastDays();
    finalizePastDays(db, NOON, { stepsAvailable: false });
    expect(dayRepo.get(db, '2026-10-20')?.walks).toBe(0);
  });

  it('caps backfill after a long absence', () => {
    onboard('2025-01-01T00:00:00.000Z');
    expect(finalizePastDays(db, NOON, RUNTIME)).toHaveLength(60);
  });
});

describe('recompute', () => {
  it('greets using the previous open and records this open after computing', () => {
    onboard();
    eventsRepo.add(db, 'app_opened', '2026-10-17T04:00:00.000Z', null);
    const first = recompute(db, NOON, RUNTIME, { opened: true });
    expect(first?.output.state.greeting).toBe('big');
    expect(eventsRepo.lastOfType(db, 'app_opened', '2026-10-22T00:00:00.000Z')?.at).toBe(NOON);
    const again = recompute(db, '2026-10-21T04:05:00.000Z', RUNTIME, { opened: false });
    expect(again?.output.state.greeting).toBe('none');
  });

  it('stores detected walks once', () => {
    onboard();
    stepCacheRepo.upsert(db, '2026-10-21', [
      { bucket: 10, steps: 700 },
      { bucket: 11, steps: 700 },
    ]);
    expect(recompute(db, NOON, RUNTIME, { opened: true })?.output.newWalks).toHaveLength(1);
    expect(recompute(db, NOON, RUNTIME, { opened: false })?.output.newWalks).toHaveLength(0);
    expect(buildEngineInput(db, NOON, RUNTIME)?.today.walks).toHaveLength(1);
  });

  it('returns null before onboarding', () => {
    expect(recompute(db, NOON, RUNTIME, { opened: true })).toBeNull();
  });
});

describe('deleteAllData', () => {
  it('clears every table and sends the app back to onboarding', () => {
    onboard();
    eventsRepo.add(db, 'pet', NOON, null);
    stepCacheRepo.upsert(db, '2026-10-21', [{ bucket: 0, steps: 5 }]);
    ledgerRepo.recordSent(db, '2026-10-21', 'leash', NOON);
    finalizePastDays(db, NOON, RUNTIME);

    deleteAllData(db);
    expect(prefsRepo.get(db)).toBeNull();
    expect(dogRepo.get(db)).toBeNull();
    expect(eventsRepo.firstAt(db)).toBeNull();
    expect(stepCacheRepo.total(db, '2026-10-21')).toBe(0);
    expect(ledgerRepo.find(db, '2026-10-21')).toBeNull();
    expect(dayRepo.lastFinalized(db)).toBeNull();
    expect(buildEngineInput(db, NOON, RUNTIME)).toBeNull();
  });
});
