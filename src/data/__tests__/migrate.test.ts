import { sql } from 'drizzle-orm';

import { migrate } from '../db';
import { createTestDb } from './testDb';

describe('migrations', () => {
  it('creates every table from ARCHITECTURE §5', async () => {
    const db = await createTestDb();
    const rows = db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );
    const tables = rows
      .map((r) => r.name)
      .filter((n) => !n.startsWith('_') && !n.startsWith('sqlite'));
    expect(tables).toEqual(['day_summary', 'dog', 'event', 'nudge_ledger', 'prefs', 'step_cache']);
  });

  it('is safe to run again', async () => {
    const db = await createTestDb();
    await expect(migrate(db)).resolves.toBeUndefined();
  });
});
