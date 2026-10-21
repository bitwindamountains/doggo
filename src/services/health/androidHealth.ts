// Health Connect (ARCHITECTURE §4.4): READ_STEPS only, aggregated in 10-minute groups with
// no data-origin filter (since the June 2026 update, on-device steps use a device-specific
// synthetic package name). Source: react-native-health-connect 4.1.3 README and types.
// shortcut: the Recording API fallback for Android 13 and lower is not built (no
// maintained RN binding); those phones need Health Connect installed. Revisit in M4 device
// testing.

import {
  SdkAvailabilityStatus,
  aggregateGroupByDuration,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
} from 'react-native-health-connect';

import { toBuckets } from './buckets';
import type { HealthService } from './HealthService';

let ready: Promise<boolean> | null = null;
async function init(): Promise<boolean> {
  ready ??= (async () =>
    (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE && (await initialize()))();
  return ready;
}

async function hasStepsPermission(): Promise<boolean> {
  const granted = await getGrantedPermissions();
  return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
}

export function createAndroidHealth(): HealthService {
  return {
    async isAvailable() {
      return (await init()) && (await hasStepsPermission());
    },
    async requestPermissions() {
      if (!(await init())) return 'denied';
      await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      return (await hasStepsPermission()) ? 'granted' : 'denied';
    },
    async getStepsBetween(startISO, endISO) {
      const r = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      return r.COUNT_TOTAL;
    },
    async getStepBuckets(startISO, endISO) {
      const groups = await aggregateGroupByDuration({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
        timeRangeSlicer: { duration: 'MINUTES', length: 10 },
      });
      return toBuckets(
        startISO,
        endISO,
        groups.map((g) => ({ start: g.startTime, steps: g.result.COUNT_TOTAL })),
      );
    },
    // Android has no step observer; the usage worker (M7) and recompute-on-open cover it.
    async enableBackgroundUpdates() {},
  };
}
