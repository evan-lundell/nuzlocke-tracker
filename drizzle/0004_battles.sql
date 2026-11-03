CREATE TABLE `battle_completions` (
	`run_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`completed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`run_id`, `location_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `locations` ADD `kind` text DEFAULT 'location' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `level_cap` integer;