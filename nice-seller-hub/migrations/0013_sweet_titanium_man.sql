ALTER TABLE `sellers` ADD `plan_status` text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `sellers` ADD `plan_price_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sellers` ADD `plan_paid_until` text;