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
  /**
   * Cancels the scheduled nudges and schedules `nudges` instead. Returns the ones the OS
   * actually scheduled (none without permission, none in the past), so only those count
   * toward the ledger once their time passes.
   */
  replaceSchedule(nudges: ScheduledNudge[]): Promise<ScheduledNudge[]>;
  /**
   * The trial reminder (PRD F12). Separate from the dog's nudges and their budget;
   * `null` cancels it. replaceSchedule() never touches it.
   */
  setTrialReminder(reminder: { at: string; title: string; body: string } | null): Promise<void>;
  /** Calls `listener` for each response, including the one that cold-started the app. */
  onResponse(listener: (response: NudgeResponse) => void): () => void;
}
