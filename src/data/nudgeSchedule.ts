// Keeps the nudge ledger honest across app kills (CLAUDE.md product rule 4). Local
// notifications fire while the app is closed, so every scheduled nudge is stored as a
// future-dated `nudge_scheduled` event; once its time has passed it is counted as sent.

import { dayKeyAt, type ISO, type NudgeType, type Prefs } from '@/engine';

import type { Db } from './db';
import { eventsRepo, ledgerRepo } from './repos';

/** Counts every scheduled nudge whose time has passed as sent (once). */
export function commitDeliveredNudges(db: Db, now: ISO, prefs: Prefs): void {
  db.transaction((tx) => {
    for (const e of eventsRepo.ofTypeUntil(tx, 'nudge_scheduled', now)) {
      ledgerRepo.recordSent(tx, dayKeyAt(Date.parse(e.at), prefs), e.payload.type, e.at);
      eventsRepo.setType(tx, e.id, 'nudge_sent');
    }
  });
}

/** Replaces the not-yet-fired schedule with `plan`. */
export function replaceScheduledNudges(
  db: Db,
  now: ISO,
  plan: { type: NudgeType; at: ISO }[],
): void {
  db.transaction((tx) => {
    eventsRepo.deleteTypeAfter(tx, 'nudge_scheduled', now);
    for (const n of plan) {
      if (Date.parse(n.at) > Date.parse(now)) {
        eventsRepo.add(tx, 'nudge_scheduled', n.at, { type: n.type });
      }
    }
  });
}
