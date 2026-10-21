// Service registry. Until each platform milestone lands (M4–M9), every build uses the
// mocks, driven by the dev persona and dev clock (src/store/dev.ts).

import type { HealthService } from './health/HealthService';
import { createMockHealth } from './health/mockHealth';
import type { NotificationService } from './notifications/NotificationService';
import { createMockNotifications } from './notifications/mockNotifications';
import type { PurchaseService } from './purchases/PurchaseService';
import { createMockPurchases } from './purchases/mockPurchases';
import type { ScreenTimeService } from './screentime/ScreenTimeService';
import { createMockScreenTime } from './screentime/mockScreenTime';
import type { Persona } from '@/engine/sim/personas';

export interface Services {
  health: HealthService;
  screenTime: ScreenTimeService;
  notifications: NotificationService;
  purchases: PurchaseService;
}

/**
 * Services for the running app: real notifications (local notifications work in
 * simulators too); everything else stays on mocks until its milestone. `toDeviceMs`
 * maps the dev clock back to real time for the notification scheduler.
 */
export function createAppServices(
  getPersona: () => Persona,
  nowMs: () => number,
  toDeviceMs: (ms: number) => number,
): Services {
  // Loaded lazily so Jest never imports native modules.
  type Module = typeof import('./notifications/expoNotifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createExpoNotifications } = require('./notifications/expoNotifications') as Module;
  return {
    ...createMockServices(getPersona, nowMs),
    notifications: createExpoNotifications(toDeviceMs),
  };
}

export function createMockServices(getPersona: () => Persona, nowMs: () => number): Services {
  return {
    health: createMockHealth(getPersona),
    screenTime: createMockScreenTime(getPersona, nowMs),
    notifications: createMockNotifications(),
    purchases: createMockPurchases(),
  };
}
