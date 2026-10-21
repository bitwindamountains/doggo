// Pure aggregation of one day's stored events into the shapes the engine wants.
// Shared by buildEngineInput (today, up to now) and finalization (a whole past day).

import {
  MINUTE_MS,
  SCREEN_RUNG_MINUTES,
  type DayWindow,
  type ISO,
  type Mood,
  type ScreenRung,
  type WalkEvent,
} from '@/engine';

import type { StoredEvent } from './events';

export interface DayEvents {
  walks: WalkEvent[];
  water: number;
  waterLastAt?: ISO;
  screenRung: ScreenRung;
  screenRungAt?: ISO;
  screenAckRung: ScreenRung;
  moodLatest?: Mood;
  moodMin?: Mood;
  pets: number;
  bedtimeKept: boolean;
}

/**
 * Early-fire guard (ARCHITECTURE §4.2): a rung that fired sooner after the day's start than
 * its own threshold cannot be real, so it is ignored.
 */
export function rungIsValid(rung: ScreenRung, firedAtMs: number, w: DayWindow): boolean {
  return (
    rung > 0 && firedAtMs < w.end && firedAtMs - w.start >= SCREEN_RUNG_MINUTES[rung] * MINUTE_MS
  );
}

export function aggregateDay(events: StoredEvent[], w: DayWindow): DayEvents {
  const out: DayEvents = {
    walks: [],
    water: 0,
    screenRung: 0,
    screenAckRung: 0,
    pets: 0,
    bedtimeKept: false,
  };
  for (const e of events) {
    switch (e.type) {
      case 'water_logged':
        out.water += 1;
        out.waterLastAt = e.at;
        break;
      case 'walk_detected': {
        const p = (e as StoredEvent<'walk_detected'>).payload;
        out.walks.push({ start: p.start, end: p.end, steps: p.steps, source: 'detected' });
        break;
      }
      case 'walk_ended': {
        const p = (e as StoredEvent<'walk_ended'>).payload;
        out.walks.push({ start: p.start, end: e.at, steps: p.steps, source: 'manual' });
        break;
      }
      case 'pet':
        out.pets += 1;
        break;
      case 'mood_checkin': {
        const { mood } = (e as StoredEvent<'mood_checkin'>).payload;
        out.moodLatest = mood;
        out.moodMin = out.moodMin === undefined ? mood : (Math.min(out.moodMin, mood) as Mood);
        break;
      }
      case 'screen_rung': {
        const { rung, firedAt } = (e as StoredEvent<'screen_rung'>).payload;
        if (rung > out.screenRung && rungIsValid(rung, Date.parse(firedAt), w)) {
          out.screenRung = rung;
          out.screenRungAt = firedAt;
        }
        break;
      }
      case 'ball_played': {
        const { rung } = (e as StoredEvent<'ball_played'>).payload;
        out.screenAckRung = Math.max(out.screenAckRung, rung) as ScreenRung;
        break;
      }
      case 'bedtime_kept':
        out.bedtimeKept = true;
        break;
      default:
        break;
    }
  }
  return out;
}
