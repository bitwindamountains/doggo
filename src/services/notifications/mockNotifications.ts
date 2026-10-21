import type { NotificationService, ScheduledNudge } from './NotificationService';

export interface MockNotificationService extends NotificationService {
  scheduled: ScheduledNudge[];
}

export function createMockNotifications(): MockNotificationService {
  const service: MockNotificationService = {
    scheduled: [],
    requestPermissions: async () => true,
    replaceSchedule: async (nudges) => {
      service.scheduled = nudges;
    },
  };
  return service;
}
