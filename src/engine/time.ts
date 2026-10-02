// §3 Time model. A user "day" runs from wake time to the next wake time in the user's
// timezone. All instants are epoch milliseconds internally and UTC ISO strings at the edges.

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { DAY_MS, LEASH, MINUTE_MS } from './constants';
import type { DayKey, HHmm, ISO, Prefs } from './types';

export function toMs(iso: ISO): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return ms;
}

export function toISO(ms: number): ISO {
  return new Date(ms).toISOString();
}

/** '07:30' → 450 minutes after midnight. */
export function parseHHmm(value: HHmm): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Invalid HH:mm time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 450 → '07:30'. Wraps around midnight. */
export function formatHHmm(minutes: number): HHmm {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Local calendar date of an instant. */
export function localDateKey(ms: number, timezone: string): DayKey {
  return formatInTimeZone(ms, timezone, 'yyyy-MM-dd');
}

/** Local minutes after midnight (0–1439) of an instant. */
export function localMinutes(ms: number, timezone: string): number {
  return parseHHmm(formatInTimeZone(ms, timezone, 'HH:mm'));
}

/** Local time of day as decimal hours (0–24), for room lighting. */
export function localHours(ms: number, timezone: string): number {
  const seconds = Number(formatInTimeZone(ms, timezone, 's'));
  return (localMinutes(ms, timezone) + seconds / 60) / 60;
}

export function addDays(day: DayKey, days: number): DayKey {
  const ms = Date.parse(`${day}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekdayOf(day: DayKey): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** The instant of a local wall-clock time on a local calendar date. */
export function zonedInstant(day: DayKey, minutes: number, timezone: string): number {
  return fromZonedTime(`${day}T${formatHHmm(minutes)}:00`, timezone).getTime();
}

/** First instant at or after `fromMs` whose local wall-clock time is `minutes`. */
export function nextLocalTime(fromMs: number, minutes: number, timezone: string): number {
  const day = localDateKey(fromMs, timezone);
  const sameDay = zonedInstant(day, minutes, timezone);
  return sameDay >= fromMs ? sameDay : zonedInstant(addDays(day, 1), minutes, timezone);
}

/** Wake and bed time (minutes after midnight) for a day; weekend times apply on Sat/Sun. */
export function scheduleFor(day: DayKey, prefs: Prefs): { wake: number; bed: number } {
  const weekday = weekdayOf(day);
  const weekend = weekday === 0 || weekday === 6;
  return {
    wake: parseHHmm(weekend && prefs.weekendWakeTime ? prefs.weekendWakeTime : prefs.wakeTime),
    bed: parseHHmm(weekend && prefs.weekendBedTime ? prefs.weekendBedTime : prefs.bedTime),
  };
}

export interface DayWindow {
  day: DayKey;
  timezone: string;
  start: number; // wake time
  bedAt: number; // bedtime (start of sleep)
  end: number; // next day's wake time
}

export function dayWindow(day: DayKey, prefs: Prefs): DayWindow {
  const { wake, bed } = scheduleFor(day, prefs);
  const tz = prefs.timezone;
  const start = zonedInstant(day, wake, tz);
  const next = addDays(day, 1);
  const end = zonedInstant(next, scheduleFor(next, prefs).wake, tz);
  // Bedtime is the first occurrence of bed time after waking (crossing midnight allowed).
  const bedAt = Math.min(
    bed > wake ? zonedInstant(day, bed, tz) : zonedInstant(next, bed, tz),
    end,
  );
  return { day, timezone: tz, start, bedAt, end };
}

/** The user-day an instant belongs to. Before today's wake time it is still yesterday. */
export function dayKeyAt(ms: number, prefs: Prefs): DayKey {
  const date = localDateKey(ms, prefs.timezone);
  return ms >= dayWindow(date, prefs).start ? date : addDays(date, -1);
}

export function wakingDurationMs(w: DayWindow): number {
  return w.bedAt - w.start;
}

/** Elapsed waking time / waking duration, clamped 0–1. */
export function wakingFraction(ms: number, w: DayWindow): number {
  const duration = wakingDurationMs(w);
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (ms - w.start) / duration));
}

export function isAsleepAt(ms: number, w: DayWindow): boolean {
  return ms < w.start || ms >= w.bedAt;
}

/** True when the local time of `ms` falls in any quiet-hours range (end exclusive). */
export function inQuietHours(ms: number, prefs: Prefs): boolean {
  if (prefs.quietHours.length === 0) return false;
  const m = localMinutes(ms, prefs.timezone);
  return prefs.quietHours.some(({ start, end }) => {
    const s = parseHHmm(start);
    const e = parseHHmm(end);
    if (s === e) return false;
    return s < e ? m >= s && m < e : m >= s || m < e;
  });
}

/**
 * §6.1 The leash check time. Default: wake + 45% of the waking day, rounded down to the
 * local half hour (07:00–23:00 → 14:00; 15:00–07:00 → 22:00).
 */
export function walkCheckAt(w: DayWindow, prefs: Prefs): number {
  if (prefs.walkCheckTime) {
    return nextLocalTime(w.start, parseHHmm(prefs.walkCheckTime), w.timezone);
  }
  const raw = w.start + LEASH.CHECK_FRACTION * wakingDurationMs(w);
  const wholeMinute = Math.floor(raw / MINUTE_MS) * MINUTE_MS;
  const over = localMinutes(wholeMinute, w.timezone) % LEASH.CHECK_ROUND_MIN;
  return wholeMinute - over * MINUTE_MS;
}

export function minutesBetween(fromMs: number, toMs: number): number {
  return (toMs - fromMs) / MINUTE_MS;
}
