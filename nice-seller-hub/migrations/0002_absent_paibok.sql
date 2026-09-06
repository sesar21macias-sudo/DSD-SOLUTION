ALTER TABLE `reception_items` ADD `catalog_price_cents` integer;--> statement-breakpoint
ALTER TABLE `reception_items` ADD `name_hint` text;--> statement-breakpoint
ALTER TABLE `receptions` ADD `declared_items` integer;