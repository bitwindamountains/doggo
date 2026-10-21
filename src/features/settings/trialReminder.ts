// PRD F12: remind 2 days before a trial converts, at a waking hour outside quiet hours.
// Not a dog nudge: it does not use or count against the nudge budget.

import { t } from '@/copy';
import { enginePrefs, prefsRepo, type Db } from '@/data';
import { HOUR_MS, MINUTE_MS, dayKeyAt, dayWindow, type ISO, type Prefs } from '@/engine';
import type { Services } from '@/services';
import { inQuietHours, toISO } from '@/engine/time';

const REMIND_BEFORE_MS = 2 * 24 * HOUR_MS;

export function trialReminderAt(trialEnd: ISO, prefs: Prefs, now: ISO): ISO | null {
  const target = Date.parse(trialEnd) - REMIND_BEFORE_MS;
  const w = dayWindow(dayKeyAt(target, prefs), prefs);
  // Two hours after waking that day, moved past any quiet hours, never after bedtime.
  let at = w.start + 2 * HOUR_MS;
  while (inQuietHours(at, prefs) && at < w.bedAt - HOUR_MS) at += 30 * MINUTE_MS;
  if (inQuietHours(at, prefs)) at = w.start + HOUR_MS;
  return at > Date.parse(now) ? toISO(at) : null;
}

/** Schedules (or cancels) the reminder from the current trial state. */
export async function scheduleTrialReminder(services: Services, db: Db, now: ISO): Promise<void> {
  const stored = prefsRepo.get(db);
  const end = stored ? await services.purchases.getTrialEnd().catch(() => null) : null;
  const at = end && stored ? trialReminderAt(end, enginePrefs(stored, false), now) : null;
  await services.notifications.setTrialReminder(
    at ? { at, title: t('ui.paywall.trialTitle'), body: t('push.trial.reminder') } : null,
  );
}
