import { parseHHmm, nextLocalTime, toISO } from '@/engine/time';
import type { Persona } from '@/engine/sim/personas';

import type { RungReading, ScreenTimeService, ScreenTimeAuth } from './ScreenTimeService';

/** Rungs at the active persona's local times, as of the dev clock. */
export function createMockScreenTime(
  getPersona: () => Persona,
  nowMs: () => number,
): ScreenTimeService {
  let auth: ScreenTimeAuth = 'notDetermined';
  let picked = 0;
  return {
    isSupported: () => true,
    getAuthorizationStatus: async () => auth,
    requestAuthorization: async () => {
      auth = 'authorized';
      return true;
    },
    presentAppPicker: async () => {
      picked = 3;
      return { count: picked };
    },
    startDailyMonitoring: async () => {},
    stopMonitoring: async () => {},
    getRungsReachedToday: async (dayStartISO): Promise<RungReading | null> => {
      if (auth !== 'authorized' || picked === 0) return null;
      const p = getPersona();
      const start = Date.parse(dayStartISO);
      const reached = (p.screen ?? [])
        .map((r) => ({ rung: r.rung, at: nextLocalTime(start, parseHHmm(r.at), p.prefs.timezone) }))
        .filter((r) => r.at <= nowMs())
        .sort((a, b) => b.rung - a.rung)[0];
      return reached ? { rung: reached.rung, firedAt: toISO(reached.at) } : null;
    },
  };
}
