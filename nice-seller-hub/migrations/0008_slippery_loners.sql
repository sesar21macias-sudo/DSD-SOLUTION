CREATE TABLE `stock_reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`visitor_id` text NOT NULL,
	`source` text DEFAULT 'cart' NOT NULL,
	`order_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_reservations_unique_idx` ON `stock_reservations` (`seller_id`,`product_id`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `stock_reservations_lookup_idx` ON `stock_reservations` (`seller_id`,`product_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `stock_reservations_visitor_idx` ON `stock_reservations` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `stock_reservations_order_idx` ON `stock_reservations` (`order_id`);