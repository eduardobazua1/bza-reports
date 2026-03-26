CREATE TABLE `supplier_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`purchase_order_id` integer,
	`amount_usd` real NOT NULL,
	`payment_date` text NOT NULL,
	`tons` real,
	`price_per_ton` real,
	`payment_method` text,
	`reference` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
