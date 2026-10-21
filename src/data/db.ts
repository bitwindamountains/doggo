// The Drizzle database type shared by the app (expo-sqlite) and tests (better-sqlite3).
// Both drivers are synchronous, so repos call .all() / .get() / .run() directly.

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { migrate as expoMigrate } from 'drizzle-orm/expo-sqlite/migrator';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import migrations from './migrations/migrations';
import { schema } from './schema';

export type Schema = typeof schema;
export type Db = BaseSQLiteDatabase<'sync', unknown, Schema>;

/**
 * Applies pending migrations. Drizzle's Expo migrator only needs the SQLite dialect and
 * session, which every sync driver has, so tests run the same bundled migrations.
 */
export function migrate(db: Db): Promise<void> {
  return expoMigrate(db as unknown as ExpoSQLiteDatabase<Schema>, migrations);
}
