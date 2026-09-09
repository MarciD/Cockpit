CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`kind` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`url` text,
	`data_json` text,
	`dedupe_key` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`read_at` integer,
	`dismissed_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_dedupe_idx` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);