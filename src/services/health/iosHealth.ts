// HealthKit (ARCHITECTURE §4.4): read stepCount only, 10-minute statistics collections,
// hourly background delivery. Source: @kingstinct/react-native-healthkit 16.2.0 README and
// type definitions (queryStatisticsCollectionForQuantity, enableBackgroundDelivery,
// subscribeToChanges).

import {
  UpdateFrequency,
  enableBackgroundDelivery,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  requestAuthorization,
  subscribeToChanges,
} from '@kingstinct/react-native-healthkit';

import { toBuckets } from './buckets';
import type { HealthService } from './HealthService';

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const READ = { toRead: [STEPS] } as const;
const WEEK_MS = 7 * 24 * 3600_000;

async function sumBetween(startISO: string, endISO: string): Promise<number> {
  const r = await queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
    filter: { date: { startDate: new Date(startISO), endDate: new Date(endISO) } },
    unit: 'count',
  });
  return Math.round(r.sumQuantity?.quantity ?? 0);
}

export function createIosHealth(): HealthService {
  return {
    // HealthKit never says whether read access was denied (privacy), so "available" means
    // we asked and some steps exist in the last week; otherwise the dog would keep asking
    // for walks a denied user can never make count.
    async isAvailable() {
      if (!isHealthDataAvailable()) return false;
      // 1 = shouldRequest, 2 = unnecessary (already asked); see AuthorizationRequestStatus.
      if ((await getRequestStatusForAuthorization(READ)) !== 2) return false;
      const now = new Date();
      return (
        (await sumBetween(new Date(now.getTime() - WEEK_MS).toISOString(), now.toISOString())) > 0
      );
    },
    async requestPermissions() {
      if (!isHealthDataAvailable()) return 'denied';
      return (await requestAuthorization(READ)) ? 'granted' : 'denied';
    },
    getStepsBetween: sumBetween,
    async getStepBuckets(startISO, endISO) {
      const rows = await queryStatisticsCollectionForQuantity(
        STEPS,
        ['cumulativeSum'],
        new Date(startISO),
        { minute: 10 },
        {
          filter: { date: { startDate: new Date(startISO), endDate: new Date(endISO) } },
          unit: 'count',
        },
      );
      return toBuckets(
        startISO,
        endISO,
        rows.flatMap((r) =>
          r.startDate ? [{ start: r.startDate, steps: r.sumQuantity?.quantity ?? 0 }] : [],
        ),
      );
    },
    async enableBackgroundUpdates(onUpdate) {
      // `hourly` is the most often iOS delivers step updates; delivery may be later.
      await enableBackgroundDelivery(STEPS, UpdateFrequency.hourly);
      subscribeToChanges(STEPS, () => {
        onUpdate().catch((e: unknown) => console.error('Health update failed', e));
      });
    },
  };
}
