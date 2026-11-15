ALTER TABLE `games` ADD `version_group_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `regions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `species` ADD `evolution_methods` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `species` ADD `hp` integer;--> statement-breakpoint
ALTER TABLE `species` ADD `attack` integer;--> statement-breakpoint
ALTER TABLE `species` ADD `defense` integer;--> statement-breakpoint
ALTER TABLE `species` ADD `special_attack` integer;--> statement-breakpoint
ALTER TABLE `species` ADD `special_defense` integer;--> statement-breakpoint
ALTER TABLE `species` ADD `speed` integer;