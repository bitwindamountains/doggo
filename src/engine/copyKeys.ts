// §10 Copy key selection. Deterministic: the same day and request give the same line.

import { LINE_VARIANTS, LOW_MOOD_MAX, type LineBase } from './constants';
import type { DayKey, DogState, Greeting, Mood, ScreenRung } from './types';

/** 32-bit FNV-1a. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function variantFor(day: DayKey, base: string, count: number): number {
  return count <= 1 ? 0 : hashString(day + base) % count;
}

export interface LineInput {
  day: DayKey;
  state: Pick<DogState, 'isAsleep' | 'request' | 'pose'>;
  greeting: Greeting;
  moodToday?: Mood;
  screenRung: ScreenRung;
}

/** Which line base to show: sleep, then greeting, request, head rest, ears perked, pose. */
export function lineBaseFor({ state, greeting, moodToday, screenRung }: LineInput): LineBase {
  if (state.isAsleep) return 'sleeping';
  if (greeting === 'big') return 'greetBig';
  if (greeting === 'small') return 'greetSmall';
  if (state.request !== 'none') return state.request;
  if (moodToday !== undefined && moodToday <= LOW_MOOD_MAX) return 'headRest';
  if (screenRung === 1) return 'rung1';
  return state.pose;
}

export function lineKeyFor(input: LineInput): string {
  const base = lineBaseFor(input);
  return `${base}.${variantFor(input.day, base, LINE_VARIANTS[base])}`;
}

/** Screen-reader description key: the request if any, else the pose. */
export function a11yKeyFor(state: Pick<DogState, 'request' | 'pose'>): string {
  return `a11y.${state.request !== 'none' ? state.request : state.pose}`;
}
