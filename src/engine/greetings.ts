// §7 Greeting on app open. Scales with time away, then caps: never sulking.

import { GREETING, MINUTE_MS } from './constants';
import { toMs } from './time';
import type { Greeting, ISO } from './types';

export function greetingFor(lastOpenedAt: ISO | undefined, now: ISO, isAsleep: boolean): Greeting {
  if (isAsleep || lastOpenedAt === undefined) return 'none';
  const away = (toMs(now) - toMs(lastOpenedAt)) / MINUTE_MS;
  if (away >= GREETING.BIG_AFTER_MIN) return 'big';
  if (away >= GREETING.SMALL_AFTER_MIN) return 'small';
  return 'none';
}
