import { createTestDb } from '@/data/__tests__/testDb';
import { DEFAULT_PREFS } from '@/engine';
import { PERSONAS } from '@/engine/sim/personas';
import { createMockServices } from '@/services';
import type { MockNotificationService } from '@/services/notifications/mockNotifications';

import { applyPersona } from '../applyPersona';
import { scheduleTrialReminder, trialReminderAt } from '../trialReminder';

const PREFS = { ...DEFAULT_PREFS, stepsAvailable: false }; // Manila, wake 07:00
const NOW = '2026-10-01T00:00:00.000Z';

describe('trial reminder (PRD F12)', () => {
  it('fires two days before conversion, two hours after waking', () => {
    // Trial ends 2026-10-10 15:00 Manila → remind 2026-10-08 09:00 Manila.
    expect(trialReminderAt('2026-10-10T07:00:00.000Z', PREFS, NOW)).toBe(
      '2026-10-08T01:00:00.000Z',
    );
  });

  it('moves out of quiet hours', () => {
    const prefs = { ...PREFS, quietHours: [{ start: '08:00', end: '10:30' }] };
    expect(trialReminderAt('2026-10-10T07:00:00.000Z', prefs, NOW)).toBe(
      '2026-10-08T02:30:00.000Z',
    );
  });

  it('skips a reminder time that already passed', () => {
    expect(trialReminderAt('2026-10-02T00:00:00.000Z', PREFS, NOW)).toBeNull();
  });

  it('schedules through the notification service and clears without a trial', async () => {
    const db = await createTestDb();
    applyPersona(db, PERSONAS['desk-worker'], NOW);
    const services = createMockServices(
      () => PERSONAS['desk-worker'],
      () => Date.parse(NOW),
    );
    const notifications = services.notifications as MockNotificationService;
    services.purchases.getTrialEnd = async () => '2026-10-10T07:00:00.000Z';
    await scheduleTrialReminder(services, db, NOW);
    expect(notifications.trialReminder).toMatchObject({
      at: '2026-10-08T01:00:00.000Z',
      body: 'Your Premium trial ends in 2 days. Manage it in Settings.',
    });
    services.purchases.getTrialEnd = async () => null;
    await scheduleTrialReminder(services, db, NOW);
    expect(notifications.trialReminder).toBeNull();
  });
});
