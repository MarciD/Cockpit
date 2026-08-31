CREATE TABLE `conjugations` (
	`language` text NOT NULL,
	`verb` text NOT NULL,
	`table_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`language`, `verb`)
);
--> statement-breakpoint
ALTER TABLE `vocab_items` ADD `topic` text;