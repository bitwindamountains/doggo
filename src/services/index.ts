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
 * Services for the running app. Notifications are always real (local notifications work
 * in simulators). Steps are real on a physical device and persona mocks in simulators,
 * where HealthKit / Health Connect have no real data (CLAUDE.md engineering rule 8).
 * Screen time is real on iPhones (M6), off on Android devices until M7. Purchases stay
 * RevenueCat once its keys are configured (M9). `toDeviceMs` maps the dev
 * clock back to real time for the notification scheduler.
 */
export function createAppServices(
  getPersona: () => Persona,
  nowMs: () => number,
  toDeviceMs: (ms: number) => number,
): Services {
  // Loaded lazily so Jest never imports native modules.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Platform } = require('react-native') as typeof import('react-native');
  const { isDevice } = require('expo-device') as typeof import('expo-device');
  const notifications = (
    require('./notifications/expoNotifications') as typeof import('./notifications/expoNotifications')
  ).createExpoNotifications(toDeviceMs);
  const realHealth = (): HealthService =>
    Platform.OS === 'ios'
      ? (require('./health/iosHealth') as typeof import('./health/iosHealth')).createIosHealth()
      : (
          require('./health/androidHealth') as typeof import('./health/androidHealth')
        ).createAndroidHealth();
  const realScreenTime = (): ScreenTimeService =>
    Platform.OS === 'ios'
      ? (
          require('./screentime/iosScreenTime') as typeof import('./screentime/iosScreenTime')
        ).createIosScreenTime()
      : (
          require('./screentime/unsupportedScreenTime') as typeof import('./screentime/unsupportedScreenTime')
        ).createUnsupportedScreenTime();
  const Constants = (require('expo-constants') as typeof import('expo-constants')).default;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | null>;
  const rcKey = Platform.OS === 'ios' ? extra.revenueCatIosKey : extra.revenueCatAndroidKey;
  const mocks = createMockServices(getPersona, nowMs);
  // No keys yet: the mock in dev builds, nothing to buy in release builds.
  const purchases: PurchaseService = rcKey
    ? (
        require('./purchases/revenueCat') as typeof import('./purchases/revenueCat')
      ).createRevenueCat(rcKey)
    : __DEV__
      ? mocks.purchases
      : (
          require('./purchases/mockPurchases') as typeof import('./purchases/mockPurchases')
        ).createUnavailablePurchases();
  /* eslint-enable @typescript-eslint/no-require-imports */
  if (!isDevice) return { ...mocks, notifications, purchases };
  return {
    ...mocks,
    notifications,
    purchases,
    health: realHealth(),
    screenTime: realScreenTime(),
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
