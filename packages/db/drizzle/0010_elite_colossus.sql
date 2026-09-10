CREATE TABLE `kitchen_cook_log` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`recipe_id` text,
	`title` text NOT NULL,
	`cooked_at` integer DEFAULT (unixepoch()) NOT NULL,
	`rating` integer,
	`notes` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `kitchen_recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kitchen_cook_log_profile_idx` ON `kitchen_cook_log` (`profile_id`,`cooked_at`);--> statement-breakpoint
CREATE TABLE `kitchen_profiles` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`profile_json` text NOT NULL,
	`options_json` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kitchen_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`title` text NOT NULL,
	`recipe_json` text NOT NULL,
	`tags_json` text NOT NULL,
	`servings` integer DEFAULT 2 NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`times_cooked` integer DEFAULT 0 NOT NULL,
	`last_cooked_at` integer,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kitchen_recipes_profile_idx` ON `kitchen_recipes` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `kitchen_techniques` (
	`query` text PRIMARY KEY NOT NULL,
	`card_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
