CREATE TABLE `xdcc_seen` (
	`watch_id` text NOT NULL,
	`release_key` text NOT NULL,
	`headline` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`offers_json` text NOT NULL,
	`notified_at` integer,
	`seen_by_user_at` integer,
	PRIMARY KEY(`watch_id`, `release_key`),
	FOREIGN KEY (`watch_id`) REFERENCES `xdcc_watches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `xdcc_seen_unseen_idx` ON `xdcc_seen` (`watch_id`,`seen_by_user_at`);--> statement-breakpoint
CREATE TABLE `xdcc_watches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`label` text NOT NULL,
	`query` text NOT NULL,
	`filter_json` text NOT NULL,
	`sources_json` text NOT NULL,
	`preferred_networks_json` text NOT NULL,
	`interval_hours` integer DEFAULT 12 NOT NULL,
	`series_mode` integer DEFAULT false NOT NULL,
	`series_from_season` integer,
	`series_from_episode` integer,
	`newness` text DEFAULT 'indexed-after' NOT NULL,
	`notify_mode` text DEFAULT 'default' NOT NULL,
	`digest` integer DEFAULT true NOT NULL,
	`command_in_body` integer DEFAULT true NOT NULL,
	`one_shot` integer DEFAULT false NOT NULL,
	`auto_pause_days` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_run_at` integer,
	`last_match_at` integer,
	`paused_at` integer,
	`snoozed_until` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `xdcc_watches_profile_idx` ON `xdcc_watches` (`profile_id`);