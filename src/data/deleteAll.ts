// "Delete all data" (PRD, Settings → Your data): clears every table. With no prefs or dog
// left, the app is back to onboarding.

import type { Db } from './db';
import { schema } from './schema';

export function deleteAllData(db: Db): void {
  db.transaction((tx) => {
    for (const table of Object.values(schema)) tx.delete(table).run();
  });
}
