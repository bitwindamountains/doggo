// Public surface of the local data layer. The app opens the database with ./openDb.

export { migrate, type Db } from './db';
export * from './repos';
export type { EventPayloads, EventType, StoredEvent } from './events';
export { buildEngineInput, enginePrefs, type RuntimeState } from './buildEngineInput';
export { finalizePastDays, MAX_BACKFILL_DAYS, type FinalizedDay } from './finalizePastDays';
export { recompute, type RecomputeResult } from './recompute';
export { deleteAllData } from './deleteAll';
