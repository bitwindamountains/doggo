import type { Db } from '../db';
import {
  dayRepo,
  dogRepo,
  eventsRepo,
  ledgerRepo,
  prefsRepo,
  stepCacheRepo,
  type StoredDaySummary,
} from '../repos';
import { DOG, PREFS } from './fixtures';
import { createTestDb } from './testDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const NOW = '2026-10-21T04:00:00.000Z';

describe('dogRepo', () => {
  it('returns null before adoption and round-trips a dog', () => {
    expect(dogRepo.get(db)).toBeNull();
    dogRepo.save(db, DOG, NOW);
    expect(dogRepo.get(db)).toEqual(DOG);
  });

  it('never lowers lifetime totals', () => {
    dogRepo.save(db, DOG, NOW);
    dogRepo.save(db, { ...DOG, bondPoints: 1, goodDaysTotal: 0, walksTotal: 0, name: 'Bis' }, NOW);
    expect(dogRepo.get(db)).toMatchObject({
      name: 'Bis',
      bondPoints: 40,
      goodDaysTotal: 5,
      walksTotal: 7,
    });
  });
});

describe('prefsRepo', () => {
  it('round-trips prefs, including optional fields', () => {
    expect(prefsRepo.get(db)).toBeNull();
    const value = {
      ...PREFS,
      weekendWakeTime: '09:00',
      quietHours: [{ start: '12:00', end: '13:00' }],
    };
    prefsRepo.save(db, value);
    prefsRepo.save(db, value);
    expect(prefsRepo.get(db)).toEqual(value);
  });
});

describe('eventsRepo', () => {
  it('stores typed payloads and queries a half-open time range in order', () => {
    eventsRepo.add(db, 'water_logged', '2026-10-21T01:00:00Z', null);
    eventsRepo.add(db, 'mood_checkin', '2026-10-21T02:00:00.000+08:00', { mood: 2 });
    eventsRepo.add(db, 'pet', '2026-10-21T03:00:00.000Z', null);
    const events = eventsRepo.between(db, '2026-10-20T18:00:00.000Z', '2026-10-21T03:00:00.000Z');
    expect(events.map((e) => [e.type, e.at])).toEqual([
      ['mood_checkin', '2026-10-20T18:00:00.000Z'],
      ['water_logged', '2026-10-21T01:00:00.000Z'],
    ]);
    expect(events[0]?.payload).toEqual({ mood: 2 });
  });

  it('finds the latest event of a type before a time', () => {
    eventsRepo.add(db, 'app_opened', '2026-10-20T01:00:00.000Z', null);
    eventsRepo.add(db, 'app_opened', '2026-10-21T01:00:00.000Z', null);
    expect(eventsRepo.lastOfType(db, 'app_opened', '2026-10-21T00:00:00.000Z')?.at).toBe(
      '2026-10-20T01:00:00.000Z',
    );
    expect(eventsRepo.lastOfType(db, 'pet', NOW)).toBeNull();
    expect(eventsRepo.firstAt(db)).toBe('2026-10-20T01:00:00.000Z');
  });

  it('rejects invalid timestamps', () => {
    expect(() => eventsRepo.add(db, 'pet', 'yesterday', null)).toThrow('Invalid timestamp');
  });
});

describe('stepCacheRepo', () => {
  it('returns a dense array and lets later writes replace buckets', () => {
    stepCacheRepo.upsert(db, '2026-10-21', [
      { bucket: 0, steps: 10 },
      { bucket: 3, steps: 400 },
      { bucket: 9, steps: 5 },
    ]);
    stepCacheRepo.upsert(db, '2026-10-21', [{ bucket: 3, steps: 450 }]);
    expect(stepCacheRepo.buckets(db, '2026-10-21', 5)).toEqual([10, 0, 0, 450, 0]);
    expect(stepCacheRepo.total(db, '2026-10-21')).toBe(465);
    expect(stepCacheRepo.buckets(db, '2026-10-22', 2)).toEqual([0, 0]);
  });
});

describe('dayRepo', () => {
  const day = (d: string, finalized: boolean): StoredDaySummary => ({
    day: d,
    steps: 5000,
    walks: 1,
    water: 6,
    screenRungMax: 1,
    moodCheckin: true,
    moodMin: 3,
    goodDay: finalized,
    finalized,
    pets: 2,
    stepTarget: 4000,
  });

  it('round-trips summaries and lists history most recent first', () => {
    dayRepo.save(db, day('2026-10-18', true));
    dayRepo.save(db, day('2026-10-19', true));
    dayRepo.save(db, day('2026-10-20', false));
    expect(dayRepo.get(db, '2026-10-19')).toEqual(day('2026-10-19', true));
    expect(dayRepo.historyBefore(db, '2026-10-20').map((d) => d.day)).toEqual([
      '2026-10-19',
      '2026-10-18',
    ]);
    expect(dayRepo.lastFinalized(db)).toBe('2026-10-19');
  });

  it('derives moodCheckin from moodMin', () => {
    dayRepo.save(db, { ...day('2026-10-18', false), moodCheckin: false, moodMin: undefined });
    expect(dayRepo.get(db, '2026-10-18')?.moodCheckin).toBe(false);
  });
});

describe('ledgerRepo', () => {
  it('starts a fresh day and carries the ignored streak only from yesterday', () => {
    ledgerRepo.save(db, { ...ledgerRepo.forDay(db, '2026-10-19'), ignoredStreakDays: 2 });
    expect(ledgerRepo.forDay(db, '2026-10-20').ignoredStreakDays).toBe(2);
    expect(ledgerRepo.forDay(db, '2026-10-21').ignoredStreakDays).toBe(0);
    expect(ledgerRepo.find(db, '2026-10-21')).toBeNull(); // forDay does not write
  });

  it('records pushes and counts opens only within 60 minutes', () => {
    ledgerRepo.recordSent(db, '2026-10-21', 'leash', '2026-10-21T06:00:00.000Z');
    ledgerRepo.recordOpened(db, '2026-10-21', '2026-10-21T07:01:00.000Z'); // too late
    ledgerRepo.recordOpened(db, '2026-10-21', '2026-10-21T06:30:00.000Z');
    expect(ledgerRepo.find(db, '2026-10-21')).toMatchObject({
      sentCount: 1,
      sentTypes: ['leash'],
      lastSentAt: '2026-10-21T06:00:00.000Z',
      openedCount: 1,
    });
  });

  it('ignores an open when nothing was sent', () => {
    expect(ledgerRepo.recordOpened(db, '2026-10-21', NOW).openedCount).toBe(0);
  });
});
