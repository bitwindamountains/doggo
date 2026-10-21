import type { NotificationService, NudgeResponse, ScheduledNudge } from './NotificationService';

export interface MockNotificationService extends NotificationService {
  scheduled: ScheduledNudge[];
  /** Test helper: whether notifications are allowed. */
  permitted: boolean;
  trialReminder: { at: string; title: string; body: string } | null;
  /** Test helper: simulates the user responding to a delivered nudge. */
  respond(response: NudgeResponse): void;
}

export function createMockNotifications(): MockNotificationService {
  const listeners = new Set<(r: NudgeResponse) => void>();
  const service: MockNotificationService = {
    scheduled: [],
    permitted: true,
    trialReminder: null,
    setTrialReminder: async (r) => {
      service.trialReminder = r;
    },
    respond: (r) => listeners.forEach((l) => l(r)),
    onResponse: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    requestPermissions: async () => true,
    replaceSchedule: async (nudges) => {
      service.scheduled = service.permitted ? nudges : [];
      return service.scheduled;
    },
  };
  return service;
}
