// Opens the on-device database. Kept apart from db.ts so tests never load expo-sqlite.
// Source: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/ (openDatabaseSync, WAL tip)

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import type { Db } from './db';
import { schema } from './schema';

export const DB_NAME = 'dogyears.db';

export function openDb(): Db {
  const sqlite = openDatabaseSync(DB_NAME);
  sqlite.execSync('PRAGMA journal_mode = WAL');
  return drizzle(sqlite, { schema });
}
