// Event types and their payloads (docs/ARCHITECTURE.md §5). Mood values and notes stay in
// this table on the device; they are never synced.

import type { ISO, Mood, NudgeType, ScreenRung, TrickId } from '@/engine';

export interface EventPayloads {
  water_logged: null;
  walk_started: null;
  walk_ended: { start: ISO; steps: number }; // manual walk; `at` is its end
  walk_detected: { start: ISO; end: ISO; steps: number };
  pet: null;
  mood_checkin: { mood: Mood; note?: string };
  screen_rung: { rung: ScreenRung; firedAt: ISO }; // as read from the extension / worker
  ball_played: { rung: ScreenRung }; // user tapped "Play": acknowledges the rung (§6.3)
  play_bow_answered: null; // user tapped "Stretch with {name}" (§6.2)
  nudge_scheduled: { type: NudgeType }; // future-dated; becomes nudge_sent once its time passes
  nudge_sent: { type: NudgeType };
  nudge_opened: { type?: NudgeType };
  app_opened: null;
  trick_learned: { trick: TrickId };
  bedtime_kept: null;
}

export type EventType = keyof EventPayloads;

export interface StoredEvent<T extends EventType = EventType> {
  id: number;
  at: ISO;
  type: T;
  payload: EventPayloads[T];
}
