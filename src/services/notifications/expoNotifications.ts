// expo-notifications implementation (MILESTONES M5). Local notifications only.
// Source: https://github.com/expo/expo/blob/main/docs/pages/versions/v57.0.0/sdk/notifications.mdx
// (scheduleNotificationAsync with a DATE trigger, categories, Android channel, response
// listener + getLastNotificationResponse for the notification that launched the app).

import * as Notifications from 'expo-notifications';

import { t } from '@/copy';
import type { NudgeType } from '@/engine';

import type { NotificationService, NudgeResponse } from './NotificationService';

const CHANNEL = 'dog';
const ACTION = 'dog-action';
const TRIAL_ID = 'trial-reminder';
const TYPES: NudgeType[] = ['leash', 'playBow', 'ball', 'bored', 'bedtime'];
const ACTION_COPY: Record<NudgeType, string> = {
  leash: 'push.action.leash',
  playBow: 'push.action.playBow',
  ball: 'push.action.ball',
  bored: 'push.action.ball',
  bedtime: 'push.action.bedtime',
};

function toResponse(r: Notifications.NotificationResponse): NudgeResponse | null {
  const data = r.notification.request.content.data as { type?: string; deepLink?: string };
  if (!data?.type || !TYPES.includes(data.type as NudgeType)) return null;
  return {
    type: data.type as NudgeType,
    action: r.actionIdentifier === ACTION ? 'action' : 'open',
    deepLink: data.deepLink ?? 'dogyears://home',
  };
}

/** `toDeviceMs` maps app-clock times to real times (the dev clock may run ahead). */
export function createExpoNotifications(toDeviceMs: (ms: number) => number): NotificationService {
  let setUp: Promise<void> | null = null;
  const setup = () =>
    (setUp ??= (async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      // Android 8+: every notification needs a channel; Android 13 shows the permission
      // prompt only once a channel exists.
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Your dog',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      // One action per notification (PRD §7 rule 3).
      for (const type of TYPES) {
        await Notifications.setNotificationCategoryAsync(type, [
          {
            identifier: ACTION,
            buttonTitle: t(ACTION_COPY[type]),
            options: { opensAppToForeground: true },
          },
        ]);
      }
    })());

  return {
    async requestPermissions() {
      await setup();
      const status = await Notifications.requestPermissionsAsync();
      const ios = status.ios?.status;
      return (
        status.granted ||
        ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        ios === Notifications.IosAuthorizationStatus.AUTHORIZED
      );
    },

    async replaceSchedule(nudges) {
      await setup();
      // Cancel only the dog's nudges; the trial reminder stays.
      for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
        if (n.identifier !== TRIAL_ID) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }
      for (const n of nudges) {
        const date = toDeviceMs(Date.parse(n.at));
        if (date <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: n.title,
            body: n.body,
            categoryIdentifier: n.type,
            data: { type: n.type, deepLink: n.deepLink },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            channelId: CHANNEL,
          },
        });
      }
    },

    async setTrialReminder(reminder) {
      await setup();
      await Notifications.cancelScheduledNotificationAsync(TRIAL_ID);
      if (!reminder || Date.parse(reminder.at) <= Date.now()) return;
      await Notifications.scheduleNotificationAsync({
        identifier: TRIAL_ID,
        content: { title: reminder.title, body: reminder.body, data: { kind: 'trial' } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: Date.parse(reminder.at),
          channelId: CHANNEL,
        },
      });
    },

    onResponse(listener) {
      const launch = Notifications.getLastNotificationResponse();
      if (launch) {
        Notifications.clearLastNotificationResponse();
        const r = toResponse(launch);
        if (r) listener(r);
      }
      const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        const r = toResponse(resp);
        if (r) listener(r);
      });
      return () => sub.remove();
    },
  };
}
