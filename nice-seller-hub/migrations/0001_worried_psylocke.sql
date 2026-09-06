CREATE TABLE `reception_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reception_id` integer NOT NULL,
	`nice_code` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`product_id` integer,
	`price_cents` integer,
	`status` text DEFAULT 'matched' NOT NULL,
	`raw_line` text,
	`confidence` text DEFAULT 'high' NOT NULL,
	FOREIGN KEY (`reception_id`) REFERENCES `receptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reception_items_reception_idx` ON `reception_items` (`reception_id`);--> statement-breakpoint
CREATE TABLE `receptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text DEFAULT 'photo' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `receptions_seller_idx` ON `receptions` (`seller_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `products` ADD `suggested_price_cents` integer;