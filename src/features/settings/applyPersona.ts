// Dev menu: replaces all local data with a persona from src/engine/sim/personas.ts,
// shifted so the persona's "today" is the dev clock's today.

import { dayRepo, deleteAllData, dogRepo, eventsRepo, prefsRepo, type Db } from '@/data';
import { DAY_MS, MINUTE_MS, dayKeyAt, dayWindow, type ISO } from '@/engine';
import type { Persona } from '@/engine/sim/personas';
import { initialDog, initialHistory } from '@/engine/sim/simulate';
import { addDays, nextLocalTime, parseHHmm, toISO } from '@/engine/time';

export function applyPersona(db: Db, persona: Persona, now: ISO): void {
  const { prefs } = persona;
  const nowMs = Date.parse(now);
  const today = dayKeyAt(nowMs, prefs);
  const w = dayWindow(today, prefs);
  const at = (hhmm: string) => nextLocalTime(w.start, parseHHmm(hhmm), prefs.timezone);
  const dog = initialDog(persona);

  deleteAllData(db);
  db.transaction((tx) => {
    prefsRepo.save(tx, {
      timezone: prefs.timezone,
      wakeTime: prefs.wakeTime,
      bedTime: prefs.bedTime,
      weekendWakeTime: prefs.weekendWakeTime,
      weekendBedTime: prefs.weekendBedTime,
      walkCheckTime: prefs.walkCheckTime,
      nudgesPerDay: prefs.nudgesPerDay,
      quietHours: prefs.quietHours,
      waterGoal: prefs.waterGoal,
      screenTimeEnabled: prefs.screenTimeEnabled,
      locale: 'en',
      onboardedAt: toISO(w.start - persona.dog.adoptedDaysBeforeStart * DAY_MS),
    });
    dogRepo.save(
      tx,
      { ...dog, adoptedAt: toISO(w.start - persona.dog.adoptedDaysBeforeStart * DAY_MS) },
      now,
    );
    const shift = (day: string) =>
      addDays(today, Math.round((Date.parse(day) - Date.parse(persona.startDay)) / DAY_MS));
    for (const s of initialHistory(persona)) dayRepo.save(tx, { ...s, day: shift(s.day) });

    // Today's own actions that already happened by `now`.
    const past = (ms: number) => ms <= nowMs;
    for (const ms of (persona.water ?? []).map(at).filter(past)) {
      eventsRepo.add(tx, 'water_logged', toISO(ms), null);
    }
    for (const ms of (persona.pets ?? []).map(at).filter(past)) {
      eventsRepo.add(tx, 'pet', toISO(ms), null);
    }
    if (persona.mood && past(at(persona.mood.at))) {
      eventsRepo.add(tx, 'mood_checkin', toISO(at(persona.mood.at)), { mood: persona.mood.value });
    }
    for (const m of persona.manualWalks ?? []) {
      const end = at(m.start) + m.minutes * MINUTE_MS;
      if (past(end)) {
        eventsRepo.add(tx, 'walk_ended', toISO(end), { start: toISO(at(m.start)), steps: m.steps });
      }
    }
    if (persona.lastOpenedDaysAgo !== undefined) {
      eventsRepo.add(tx, 'app_opened', toISO(nowMs - persona.lastOpenedDaysAgo * DAY_MS), null);
    }
  });
}
