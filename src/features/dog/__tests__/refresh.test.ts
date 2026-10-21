import { createTestDb } from '@/data/__tests__/testDb';
import { ledgerRepo, type Db } from '@/data';
import { PERSONAS } from '@/engine/sim/personas';
import { createMockServices, type Services } from '@/services';
import type { MockNotificationService } from '@/services/notifications/mockNotifications';
import { applyPersona } from '@/features/settings/applyPersona';
import { useDogStore } from '@/store/dogStore';

import { refreshDog } from '../refresh';

// Asia/Manila is UTC+8.
const local = (hhmm: string) => `2026-10-21T${hhmm}:00+08:00`;
const iso = (hhmm: string) => new Date(local(hhmm)).toISOString();

let db: Db;
let services: Services;
let clock = 0;

async function setup(personaId: keyof typeof PERSONAS, nowHHmm: string) {
  const persona = PERSONAS[personaId];
  db = await createTestDb();
  clock = Date.parse(local(nowHHmm));
  services = createMockServices(
    () => persona,
    () => clock,
  );
  await services.health.requestPermissions();
  applyPersona(db, persona, iso(nowHHmm));
}

async function at(hhmm: string, opened = true) {
  clock = Date.parse(local(hhmm));
  return refreshDog({ db, services, now: iso(hhmm), reduceMotion: false }, { opened });
}

describe('refreshDog with mock services (PRD F4 AC)', () => {
  it('desk-worker: leash at walk-check time, cleared after the detected walk', async () => {
    await setup('desk-worker', '08:00');
    expect((await at('13:30'))?.output.state.request).not.toBe('leash');
    const afternoon = await at('14:30');
    expect(afternoon?.output.state.request).toBe('leash');
    expect(useDogStore.getState().output?.state.request).toBe('leash');

    const evening = await at('18:00');
    expect(evening?.output.activeRequests).not.toContain('leash');
    expect(evening?.output.stepsToday).toBeGreaterThan(1600);
  });

  it('schedules pushes through the service and never more than the budget', async () => {
    await setup('desk-worker', '08:00');
    const notifications = services.notifications as MockNotificationService;
    for (let h = 8; h <= 22; h++) await at(`${String(h).padStart(2, '0')}:00`, false);
    const ledger = ledgerRepo.find(db, '2026-10-21');
    expect((ledger?.sentCount ?? 0) + notifications.scheduled.length).toBeLessThanOrEqual(3);
    for (const n of notifications.scheduled) {
      expect(n.body.length).toBeLessThanOrEqual(60);
      expect(n.title).toBe('Biscuit');
    }
  });

  it.each(Object.keys(PERSONAS) as (keyof typeof PERSONAS)[])(
    '%s: never more pushes than the budget through the real pipeline',
    async (id) => {
      await setup(id, '00:00');
      const notifications = services.notifications as MockNotificationService;
      const budget = PERSONAS[id].prefs.nudgesPerDay;
      for (let m = 0; m < 24 * 60; m += 30) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        await at(`${hh}:${mm}`, false);
        const sent = ledgerRepo.find(db, '2026-10-21')?.sentCount ?? 0;
        const pending = notifications.scheduled.filter((n) => n.at.startsWith('2026-10-21')).length;
        expect(sent).toBeLessThanOrEqual(budget);
        expect(sent + pending).toBeLessThanOrEqual(3);
      }
    },
  );

  it('returns null and clears the store before onboarding', async () => {
    db = await createTestDb();
    services = createMockServices(
      () => PERSONAS['desk-worker'],
      () => clock,
    );
    expect(await at('10:00')).toBeNull();
    expect(useDogStore.getState().dog).toBeNull();
  });
});
