CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_channel_idx` ON `notification_deliveries` (`channel`,`at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`kind` text PRIMARY KEY NOT NULL,
	`channels_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`quiet_from` text,
	`quiet_to` text,
	`public_url` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scheduled_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`fire_at` integer NOT NULL,
	`payload_json` text NOT NULL,
	`fired_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_notifications_fire_idx` ON `scheduled_notifications` (`fire_at`);