// Local SQLite schema (docs/ARCHITECTURE.md §5). All timestamps are UTC ISO strings;
// `day` is the user-local day key from the engine (a day starts at wake time).
// After changing this file run `npx drizzle-kit generate` to add a migration.

import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Breed, NudgeType, QuietHours, TrickId } from '@/engine';

export const dog = sqliteTable('dog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  breed: text('breed').$type<Breed>().notNull(),
  adoptedAt: text('adopted_at').notNull(),
  adoptedAsSenior: integer('adopted_as_senior', { mode: 'boolean' }).notNull().default(false),
  bondPoints: integer('bond_points').notNull().default(0),
  goodDaysTotal: integer('good_days_total').notNull().default(0),
  walksTotal: integer('walks_total').notNull().default(0),
  tricks: text('tricks', { mode: 'json' }).$type<TrickId[]>().notNull().default([]),
  cosmetics: text('cosmetics', { mode: 'json' }).$type<string[]>().notNull().default([]),
  updatedAt: text('updated_at').notNull(),
});

/** One row (id = 1). */
export const prefs = sqliteTable('prefs', {
  id: integer('id').primaryKey(),
  timezone: text('timezone').notNull(),
  wakeTime: text('wake_time').notNull(),
  bedTime: text('bed_time').notNull(),
  weekendWakeTime: text('weekend_wake_time'),
  weekendBedTime: text('weekend_bed_time'),
  nudgesPerDay: integer('nudges_per_day').$type<0 | 1 | 2 | 3>().notNull(),
  walkCheckTime: text('walk_check_time'),
  waterGoal: integer('water_goal').notNull(),
  quietHours: text('quiet_hours', { mode: 'json' }).$type<QuietHours[]>().notNull().default([]),
  screenTimeEnabled: integer('screen_time_enabled', { mode: 'boolean' }).notNull().default(false),
  locale: text('locale').notNull(),
  onboardedAt: text('onboarded_at'),
});

export const event = sqliteTable(
  'event',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: text('at').notNull(),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }),
  },
  (t) => [index('event_at_idx').on(t.at), index('event_type_at_idx').on(t.type, t.at)],
);

export const daySummary = sqliteTable('day_summary', {
  day: text('day').primaryKey(),
  steps: integer('steps').notNull().default(0),
  walks: integer('walks').notNull().default(0),
  water: integer('water').notNull().default(0),
  screenRungMax: integer('screen_rung_max').$type<0 | 1 | 2 | 3>().notNull().default(0),
  bedtimeKept: integer('bedtime_kept', { mode: 'boolean' }),
  moodMin: integer('mood_min'),
  pets: integer('pets').notNull().default(0),
  stepTarget: integer('step_target'),
  goodDay: integer('good_day', { mode: 'boolean' }).notNull().default(false),
  finalized: integer('finalized', { mode: 'boolean' }).notNull().default(false),
});

/** 10-minute step buckets counted from the day's start. */
export const stepCache = sqliteTable(
  'step_cache',
  {
    day: text('day').notNull(),
    bucket: integer('bucket').notNull(),
    steps: integer('steps').notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.bucket] })],
);

export const nudgeLedger = sqliteTable('nudge_ledger', {
  day: text('day').primaryKey(),
  sentCount: integer('sent_count').notNull().default(0),
  lastSentAt: text('last_sent_at'),
  sentTypes: text('sent_types', { mode: 'json' }).$type<NudgeType[]>().notNull().default([]),
  openedCount: integer('opened_count').notNull().default(0),
  ignoredStreakDays: integer('ignored_streak_days').notNull().default(0),
});

export const schema = { dog, prefs, event, daySummary, stepCache, nudgeLedger };
