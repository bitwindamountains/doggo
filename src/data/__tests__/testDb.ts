// In-memory SQLite for data-layer tests, migrated with the app's own migration bundle.

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { migrate, type Db } from '../db';
import { schema } from '../schema';

export async function createTestDb(): Promise<Db> {
  const db = drizzle(new Database(':memory:'), { schema });
  await migrate(db);
  return db;
}
