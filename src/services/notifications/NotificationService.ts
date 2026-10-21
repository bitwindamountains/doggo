// Local notifications (docs/ARCHITECTURE.md §4.5). The engine plans; this applies the plan.

import type { PlannedNudge } from '@/engine';

export interface ScheduledNudge extends PlannedNudge {
  title: string;
  body: string;
  action: string;
}

export interface NotificationService {
  requestPermissions(): Promise<boolean>;
  /** Cancels everything this app scheduled and schedules `nudges` instead. */
  replaceSchedule(nudges: ScheduledNudge[]): Promise<void>;
}
