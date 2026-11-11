CREATE TABLE `hall_of_fame` (
	`run_id` integer PRIMARY KEY NOT NULL,
	`members` text NOT NULL,
	`battles_won` integer DEFAULT 0 NOT NULL,
	`deaths` integer DEFAULT 0 NOT NULL,
	`inducted_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
