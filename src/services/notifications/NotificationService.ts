// Local notifications (docs/ARCHITECTURE.md §4.5). The engine plans; this applies the plan.

import type { NudgeType, PlannedNudge } from '@/engine';

export interface ScheduledNudge extends PlannedNudge {
  title: string;
  body: string;
  action: string;
}

/** The user tapped a nudge (`action: 'open'`) or its one action button (`'action'`). */
export interface NudgeResponse {
  type: NudgeType;
  action: 'open' | 'action';
  deepLink: string;
}

export interface NotificationService {
  requestPermissions(): Promise<boolean>;
  /** Cancels everything this app scheduled and schedules `nudges` instead. */
  replaceSchedule(nudges: ScheduledNudge[]): Promise<void>;
  /** Calls `listener` for each response, including the one that cold-started the app. */
  onResponse(listener: (response: NudgeResponse) => void): () => void;
}
