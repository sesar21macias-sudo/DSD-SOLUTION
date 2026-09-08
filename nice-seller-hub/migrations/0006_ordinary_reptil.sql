CREATE TABLE `sale_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`sale_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text DEFAULT 'efectivo' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sale_payments_sale_idx` ON `sale_payments` (`sale_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sale_payments_seller_idx` ON `sale_payments` (`seller_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `reception_items` ADD `cost_cents` integer;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `unit_cost_cents` integer;--> statement-breakpoint
ALTER TABLE `sales` ADD `status` text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `paid_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `points_awarded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_inventory` ADD `cost_cents` integer;--> statement-breakpoint
ALTER TABLE `sellers` ADD `distributor_discount_pct` integer DEFAULT 0 NOT NULL;