import { createTestDb } from '@/data/__tests__/testDb';
import { eventsRepo, ledgerRepo, type Db } from '@/data';
import { PERSONAS } from '@/engine/sim/personas';
import { applyPersona } from '@/features/settings/applyPersona';

import { handleNudgeResponse, routeFor } from '../nudgeResponse';

const NOW = '2026-10-21T07:00:00.000Z'; // 15:00 in Manila
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  applyPersona(db, PERSONAS['desk-worker'], NOW);
});

describe('handleNudgeResponse (M5)', () => {
  it('maps deep links to routes', () => {
    expect(routeFor('dogyears://walk')).toBe('/walk');
    expect(routeFor('dogyears://home?play=1')).toBe('/');
    expect(routeFor('dogyears://home')).toBe('/');
  });

  it('counts an open within the hour and leads to the walk screen', () => {
    ledgerRepo.recordSent(db, '2026-10-21', 'leash', '2026-10-21T06:30:00.000Z');
    const route = handleNudgeResponse(
      db,
      { type: 'leash', action: 'open', deepLink: 'dogyears://walk' },
      NOW,
    );
    expect(route).toBe('/walk');
    expect(ledgerRepo.find(db, '2026-10-21')?.openedCount).toBe(1);
    expect(eventsRepo.lastOfType(db, 'nudge_opened', '2026-10-22T00:00:00.000Z')?.payload).toEqual({
      type: 'leash',
    });
  });

  it('the action button answers the request', () => {
    handleNudgeResponse(
      db,
      { type: 'bored', action: 'action', deepLink: 'dogyears://home?play=1' },
      NOW,
    );
    handleNudgeResponse(
      db,
      { type: 'playBow', action: 'action', deepLink: 'dogyears://home' },
      NOW,
    );
    const later = '2026-10-22T00:00:00.000Z';
    expect(eventsRepo.lastOfType(db, 'ball_played', later)?.payload).toEqual({ rung: 3 });
    expect(eventsRepo.lastOfType(db, 'play_bow_answered', later)).not.toBeNull();
  });

  it('a tap on the body does not answer the request', () => {
    handleNudgeResponse(
      db,
      { type: 'ball', action: 'open', deepLink: 'dogyears://home?play=1' },
      NOW,
    );
    expect(eventsRepo.lastOfType(db, 'ball_played', '2026-10-22T00:00:00.000Z')).toBeNull();
  });
});
