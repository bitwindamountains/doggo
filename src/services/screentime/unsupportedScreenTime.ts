import type { ScreenTimeService } from './ScreenTimeService';

/** Real Android devices until the usage-stats module lands (M7): screen time is off. */
export function createUnsupportedScreenTime(): ScreenTimeService {
  return {
    isSupported: () => false,
    getAuthorizationStatus: async () => 'denied',
    requestAuthorization: async () => false,
    presentAppPicker: async () => ({ count: 0 }),
    startDailyMonitoring: async () => {},
    stopMonitoring: async () => {},
    getRungsReachedToday: async () => null,
  };
}
