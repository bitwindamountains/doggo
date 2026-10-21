CREATE TABLE `day_summary` (
	`day` text PRIMARY KEY NOT NULL,
	`steps` integer DEFAULT 0 NOT NULL,
	`walks` integer DEFAULT 0 NOT NULL,
	`water` integer DEFAULT 0 NOT NULL,
	`screen_rung_max` integer DEFAULT 0 NOT NULL,
	`bedtime_kept` integer,
	`mood_min` integer,
	`pets` integer DEFAULT 0 NOT NULL,
	`step_target` integer,
	`good_day` integer DEFAULT false NOT NULL,
	`finalized` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`breed` text NOT NULL,
	`adopted_at` text NOT NULL,
	`adopted_as_senior` integer DEFAULT false NOT NULL,
	`bond_points` integer DEFAULT 0 NOT NULL,
	`good_days_total` integer DEFAULT 0 NOT NULL,
	`walks_total` integer DEFAULT 0 NOT NULL,
	`tricks` text DEFAULT '[]' NOT NULL,
	`cosmetics` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`type` text NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE INDEX `event_at_idx` ON `event` (`at`);--> statement-breakpoint
CREATE INDEX `event_type_at_idx` ON `event` (`type`,`at`);--> statement-breakpoint
CREATE TABLE `nudge_ledger` (
	`day` text PRIMARY KEY NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`last_sent_at` text,
	`sent_types` text DEFAULT '[]' NOT NULL,
	`opened_count` integer DEFAULT 0 NOT NULL,
	`ignored_streak_days` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prefs` (
	`id` integer PRIMARY KEY NOT NULL,
	`timezone` text NOT NULL,
	`wake_time` text NOT NULL,
	`bed_time` text NOT NULL,
	`weekend_wake_time` text,
	`weekend_bed_time` text,
	`nudges_per_day` integer NOT NULL,
	`walk_check_time` text,
	`water_goal` integer NOT NULL,
	`quiet_hours` text DEFAULT '[]' NOT NULL,
	`screen_time_enabled` integer DEFAULT false NOT NULL,
	`locale` text NOT NULL,
	`onboarded_at` text
);
--> statement-breakpoint
CREATE TABLE `step_cache` (
	`day` text NOT NULL,
	`bucket` integer NOT NULL,
	`steps` integer NOT NULL,
	PRIMARY KEY(`day`, `bucket`)
);
