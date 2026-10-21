// Screen time (docs/ARCHITECTURE.md §4.1–4.3). Real implementations arrive in M6 (iOS)
// and M7 (Android).

import type { ISO, ScreenRung } from '@/engine';

export type ScreenTimeAuth = 'authorized' | 'denied' | 'notDetermined';

export interface RungReading {
  rung: ScreenRung;
  firedAt: ISO; // needed by the early-fire guard
}

export interface ScreenTimeService {
  isSupported(): boolean;
  getAuthorizationStatus(): Promise<ScreenTimeAuth>;
  requestAuthorization(): Promise<boolean>;
  /** iOS never returns app names to JS; only how many were picked. */
  presentAppPicker(groupId: string): Promise<{ count: number }>;
  startDailyMonitoring(groupId: string, dayStartHHmm: string): Promise<void>;
  stopMonitoring(groupId: string): Promise<void>;
  /** Highest rung reached since the day start, read from shared storage. */
  getRungsReachedToday(dayStartISO: ISO): Promise<RungReading | null>;
}
