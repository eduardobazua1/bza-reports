ALTER TABLE `invoices` ADD `invoice_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payment_terms_days` integer;--> statement-breakpoint
ALTER TABLE `invoices` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_paid_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `supplier_invoice_number` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `supplier_paid_date` text;