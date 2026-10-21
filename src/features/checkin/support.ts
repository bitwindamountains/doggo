import { eventsRepo, type Db } from '@/data';
import { DAY_MS, LOW_MOOD_MAX, type ISO } from '@/engine';

/** PRD F9: show the Support link when 3 of the last 5 check-ins were low. */
export function needsSupport(db: Db, now: ISO): boolean {
  const nowMs = Date.parse(now);
  const recent = eventsRepo
    .between(db, new Date(nowMs - 60 * DAY_MS).toISOString(), new Date(nowMs + 1).toISOString())
    .filter((e) => e.type === 'mood_checkin')
    .slice(-5)
    .map((e) => (e.payload as { mood: number }).mood);
  return recent.filter((m) => m <= LOW_MOOD_MAX).length >= 3;
}
