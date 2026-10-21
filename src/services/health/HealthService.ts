// Steps (docs/ARCHITECTURE.md §4.1, §4.4). Real implementations arrive in M4.

export type PermissionResult = 'granted' | 'denied' | 'partial';

export interface HealthService {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<PermissionResult>;
  getStepsBetween(startISO: string, endISO: string): Promise<number>;
  /** Steps per completed 10-minute bucket from start to end. */
  getStepBuckets(startISO: string, endISO: string, bucketMinutes: 10): Promise<number[]>;
  enableBackgroundUpdates(onUpdate: () => Promise<void>): Promise<void>;
}
