// iOS Screen Time via react-native-device-activity 0.6.1 (ARCHITECTURE §4.2). Source: the
// library README and type definitions (requestAuthorization('individual'), persisted
// selection ids, startMonitoring with threshold events, getEvents history in the App Group).
// The monitor extension records `eventDidReachThreshold`; the app reads it on open.
// shortcut: the extension does not post notifications. The library's notification action
// cannot check the shared nudge ledger, quiet hours or bedtime (CLAUDE.md product rule 4),
// so rung pushes need custom extension code (needs Xcode). Until then the ball/bored
// reaction appears when the app is opened.

import * as DeviceActivity from 'react-native-device-activity';

import { dailySchedule, highestRung, RUNG_EVENTS, rungThreshold } from './rungs';
import { SOCIAL_GROUP, type ScreenTimeService } from './ScreenTimeService';
import { openAppPicker } from './pickerBridge';

const activityName = (groupId: string) => `dogyears_${groupId}`;

export function createIosScreenTime(): ScreenTimeService {
  const status = () => {
    switch (DeviceActivity.getAuthorizationStatus()) {
      case DeviceActivity.AuthorizationStatus.approved:
        return 'authorized' as const;
      case DeviceActivity.AuthorizationStatus.denied:
        return 'denied' as const;
      default:
        return 'notDetermined' as const;
    }
  };
  return {
    isSupported: () => DeviceActivity.isAvailable(),
    getAuthorizationStatus: async () => status(),
    async requestAuthorization() {
      await DeviceActivity.requestAuthorization('individual');
      return status() === 'authorized';
    },
    presentAppPicker: (groupId) => openAppPicker(groupId),
    async startDailyMonitoring(groupId, dayStartHHmm) {
      const selection = DeviceActivity.getFamilyActivitySelectionId(groupId);
      if (!selection) return;
      // Restarting mid-day makes iOS count usage from the restart (thresholds reset), so
      // only restart when the schedule or the picked apps changed.
      const name = activityName(groupId);
      const config = `${dayStartHHmm}|${selection}`;
      const configKey = `${name}_config`;
      if (
        DeviceActivity.getActivities().includes(name) &&
        DeviceActivity.userDefaultsGet<string>(configKey) === config
      ) {
        return;
      }
      DeviceActivity.userDefaultsSet(configKey, config);
      await DeviceActivity.startMonitoring(
        activityName(groupId),
        dailySchedule(dayStartHHmm),
        RUNG_EVENTS.map((eventName, i) => ({
          eventName,
          familyActivitySelection: selection,
          threshold: rungThreshold((i + 1) as 1 | 2 | 3),
        })),
      );
    },
    async stopMonitoring(groupId) {
      DeviceActivity.stopMonitoring([activityName(groupId)]);
    },
    async getRungsReachedToday(dayStartISO) {
      return highestRung(DeviceActivity.getEvents(activityName(SOCIAL_GROUP)), dayStartISO);
    },
  };
}
