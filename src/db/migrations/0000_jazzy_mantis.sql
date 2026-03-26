CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`phone` text,
	`access_token` text NOT NULL,
	`portal_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_access_token_unique` ON `clients` (`access_token`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`quantity_tons` real NOT NULL,
	`unit` text DEFAULT 'Ton' NOT NULL,
	`sell_price_override` real,
	`buy_price_override` real,
	`shipment_date` text,
	`estimated_arrival` text,
	`shipment_status` text DEFAULT 'programado' NOT NULL,
	`customer_payment_status` text DEFAULT 'unpaid' NOT NULL,
	`supplier_payment_status` text DEFAULT 'unpaid' NOT NULL,
	`uses_factoring` integer DEFAULT false NOT NULL,
	`factoring_amount` real,
	`factoring_days` integer,
	`factoring_cost` real,
	`item` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_number` text NOT NULL,
	`po_date` text,
	`client_id` integer NOT NULL,
	`client_po_number` text,
	`supplier_id` integer NOT NULL,
	`sell_price` real NOT NULL,
	`buy_price` real NOT NULL,
	`product` text NOT NULL,
	`terms` text,
	`transport_type` text,
	`license_fsc` text,
	`chain_of_custody` text,
	`input_claim` text,
	`output_claim` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `shipment_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`comment` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`phone` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);