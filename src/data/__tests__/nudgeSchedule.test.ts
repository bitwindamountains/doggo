import { DEFAULT_PREFS } from '@/engine';

import type { Db } from '../db';
import { commitDeliveredNudges, replaceScheduledNudges } from '../nudgeSchedule';
import { eventsRepo, ledgerRepo } from '../repos';
import { createTestDb } from './testDb';

const PREFS = { ...DEFAULT_PREFS, stepsAvailable: true };
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('nudge schedule', () => {
  it('counts a scheduled nudge as sent once its time passes, exactly once', () => {
    replaceScheduledNudges(db, '2026-10-21T04:00:00.000Z', [
      { type: 'leash', at: '2026-10-21T06:00:00.000Z' },
      { type: 'bedtime', at: '2026-10-21T14:30:00.000Z' },
    ]);
    commitDeliveredNudges(db, '2026-10-21T05:00:00.000Z', PREFS);
    expect(ledgerRepo.find(db, '2026-10-21')).toBeNull();

    commitDeliveredNudges(db, '2026-10-21T07:00:00.000Z', PREFS);
    commitDeliveredNudges(db, '2026-10-21T07:05:00.000Z', PREFS);
    expect(ledgerRepo.find(db, '2026-10-21')).toMatchObject({
      sentCount: 1,
      sentTypes: ['leash'],
      lastSentAt: '2026-10-21T06:00:00.000Z',
    });
  });

  it('replacing drops future nudges but keeps the ones already counted', () => {
    replaceScheduledNudges(db, '2026-10-21T04:00:00.000Z', [
      { type: 'leash', at: '2026-10-21T06:00:00.000Z' },
      { type: 'ball', at: '2026-10-21T09:00:00.000Z' },
    ]);
    commitDeliveredNudges(db, '2026-10-21T07:00:00.000Z', PREFS);
    replaceScheduledNudges(db, '2026-10-21T07:00:00.000Z', [
      { type: 'bedtime', at: '2026-10-21T14:30:00.000Z' },
      { type: 'leash', at: '2026-10-21T06:30:00.000Z' }, // in the past: ignored
    ]);
    const all = eventsRepo.between(db, '2026-10-21T00:00:00.000Z', '2026-10-22T00:00:00.000Z');
    expect(all.map((e) => [e.type, e.at])).toEqual([
      ['nudge_sent', '2026-10-21T06:00:00.000Z'],
      ['nudge_scheduled', '2026-10-21T14:30:00.000Z'],
    ]);
  });
});
