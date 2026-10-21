// Pure helpers shared by the iOS Screen Time service and its tests.

import { SCREEN_RUNG_MINUTES, type ScreenRung } from '@/engine';

import type { RungReading } from './ScreenTimeService';

export const RUNG_EVENTS = ['rung1', 'rung2', 'rung3'] as const;

/** Daily schedule from wake time to one minute before the next wake time (crosses midnight). */
export function dailySchedule(dayStartHHmm: string) {
  const [h = 0, m = 0] = dayStartHHmm.split(':').map(Number);
  const end = (h * 60 + m + 1439) % 1440;
  return {
    intervalStart: { hour: h, minute: m },
    intervalEnd: { hour: Math.floor(end / 60), minute: end % 60 },
    repeats: true,
  };
}

/** Threshold for rung n (45 / 60 / 120 minutes, DOG_ENGINE constants). */
export function rungThreshold(rung: 1 | 2 | 3) {
  const minutes = SCREEN_RUNG_MINUTES[rung];
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}

/** Highest rung whose threshold event fired at or after the day start. */
export function highestRung(
  events: { callbackName: string; eventName?: string; lastCalledAt: Date }[],
  dayStartISO: string,
): RungReading | null {
  const start = Date.parse(dayStartISO);
  let best: RungReading | null = null;
  for (const e of events) {
    const rung = (RUNG_EVENTS as readonly string[]).indexOf(e.eventName ?? '') + 1;
    const at = e.lastCalledAt.getTime();
    if (e.callbackName !== 'eventDidReachThreshold' || rung === 0 || at < start) continue;
    if (!best || rung > best.rung)
      best = { rung: rung as ScreenRung, firedAt: e.lastCalledAt.toISOString() };
  }
  return best;
}
