import { BUCKET_MINUTES, MINUTE_MS } from '@/engine';
import type { Persona } from '@/engine/sim/personas';
import { personaStepsAt } from '@/engine/sim/simulate';

import type { HealthService, PermissionResult } from './HealthService';

const BUCKET_MS = BUCKET_MINUTES * MINUTE_MS;

/** Steps from the active dev persona's step segments, so simulators show real behavior. */
export function createMockHealth(getPersona: () => Persona): HealthService {
  let granted = false;
  const buckets = (startISO: string, endISO: string) => {
    // Aligned to the 10-minute clock grid, like health samples (day starts already are).
    const start = Math.floor(Date.parse(startISO) / BUCKET_MS) * BUCKET_MS;
    const count = Math.max(0, Math.floor((Date.parse(endISO) - start) / BUCKET_MS));
    return Array.from({ length: count }, (_, i) =>
      personaStepsAt(getPersona(), start + i * BUCKET_MS),
    );
  };
  return {
    isAvailable: async () => granted && getPersona().prefs.stepsAvailable,
    requestPermissions: async (): Promise<PermissionResult> => {
      granted = getPersona().prefs.stepsAvailable;
      return granted ? 'granted' : 'denied';
    },
    getStepsBetween: async (s, e) => buckets(s, e).reduce((a, b) => a + b, 0),
    getStepBuckets: async (s, e) => buckets(s, e),
    enableBackgroundUpdates: async () => {},
  };
}
