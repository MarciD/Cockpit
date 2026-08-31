CREATE TABLE `learning_score` (
	`profile_id` text NOT NULL,
	`language` text NOT NULL,
	`daily_goal_items` integer DEFAULT 10 NOT NULL,
	`last_active_day` text,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`streak_freezes` integer DEFAULT 2 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`profile_id`, `language`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learning_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`language` text NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`items_answered` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`mode` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vocab_items` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`language` text NOT NULL,
	`category` text NOT NULL,
	`term` text NOT NULL,
	`translation` text NOT NULL,
	`notes` text,
	`seen` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`item_streak` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer,
	`source` text DEFAULT 'csv' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
