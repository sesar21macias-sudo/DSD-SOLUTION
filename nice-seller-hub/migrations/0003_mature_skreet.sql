CREATE TABLE `loyalty_programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`name` text DEFAULT 'Club NICE' NOT NULL,
	`cents_per_point` integer DEFAULT 1000 NOT NULL,
	`welcome_points` integer DEFAULT 0 NOT NULL,
	`terms` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_programs_seller_idx` ON `loyalty_programs` (`seller_id`);--> statement-breakpoint
CREATE TABLE `loyalty_redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`reward_id` integer,
	`code` text NOT NULL,
	`points_spent` integer NOT NULL,
	`name_snapshot` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`order_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`used_at` text,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_redemptions_code_idx` ON `loyalty_redemptions` (`code`);--> statement-breakpoint
CREATE INDEX `loyalty_redemptions_seller_idx` ON `loyalty_redemptions` (`seller_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `loyalty_redemptions_customer_idx` ON `loyalty_redemptions` (`customer_id`);--> statement-breakpoint
CREATE TABLE `loyalty_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`points_cost` integer NOT NULL,
	`kind` text DEFAULT 'percent' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loyalty_rewards_seller_idx` ON `loyalty_rewards` (`seller_id`,`position`);--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `lifetime_points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `redemption_code` text;