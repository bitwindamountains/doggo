// What a tap on a nudge does (MILESTONES M5): count the open for the back-off rule (an
// open counts within 60 minutes of the push), apply the action button, pick the screen.

import {
  commitDeliveredNudges,
  enginePrefs,
  eventsRepo,
  ledgerRepo,
  prefsRepo,
  type Db,
} from '@/data';
import { dayKeyAt, type ISO } from '@/engine';
import type { NudgeResponse } from '@/services/notifications/NotificationService';

/** Records the response and returns the in-app route to show. */
export function handleNudgeResponse(db: Db, r: NudgeResponse, now: ISO): string {
  const prefs = prefsRepo.get(db);
  if (prefs) {
    // The tapped push may have fired while the app was closed: count it as sent first, so
    // the open is measured against it.
    commitDeliveredNudges(db, now, enginePrefs(prefs, false));
    db.transaction((tx) => {
      eventsRepo.add(tx, 'nudge_opened', now, { type: r.type });
      ledgerRepo.recordOpened(tx, dayKeyAt(Date.parse(now), enginePrefs(prefs, false)), now);
      if (r.action === 'action') {
        if (r.type === 'playBow') eventsRepo.add(tx, 'play_bow_answered', now, null);
        if (r.type === 'ball') eventsRepo.add(tx, 'ball_played', now, { rung: 2 });
        if (r.type === 'bored') eventsRepo.add(tx, 'ball_played', now, { rung: 3 });
      }
    });
  }
  return routeFor(r.deepLink);
}

/** `dogyears://walk` → `/walk`; `dogyears://home?play=1` → `/`. */
export function routeFor(deepLink: string): string {
  const path = deepLink.replace(/^dogyears:\/\//, '').split('?')[0] ?? '';
  return path === 'walk' ? '/walk' : '/';
}
