PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_loyalty_programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`name` text DEFAULT 'Club de puntos' NOT NULL,
	`cents_per_point` integer DEFAULT 1000 NOT NULL,
	`welcome_points` integer DEFAULT 0 NOT NULL,
	`terms` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_loyalty_programs`("id", "seller_id", "enabled", "name", "cents_per_point", "welcome_points", "terms", "created_at", "updated_at") SELECT "id", "seller_id", "enabled", "name", "cents_per_point", "welcome_points", "terms", "created_at", "updated_at" FROM `loyalty_programs`;--> statement-breakpoint
DROP TABLE `loyalty_programs`;--> statement-breakpoint
ALTER TABLE `__new_loyalty_programs` RENAME TO `loyalty_programs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_programs_seller_idx` ON `loyalty_programs` (`seller_id`);--> statement-breakpoint
ALTER TABLE `sellers` ADD `order_greeting_template` text;--> statement-breakpoint
ALTER TABLE `sellers` ADD `order_closing_template` text;--> statement-breakpoint
ALTER TABLE `sellers` ADD `share_message_template` text;--> statement-breakpoint
ALTER TABLE `sellers` ADD `payment_reminder_template` text;--> statement-breakpoint
ALTER TABLE `sellers` ADD `coupon_message_template` text;