ALTER TABLE `supplier_payments` ADD `invoice_id` integer REFERENCES invoices(id);--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `estimated_tons` real;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `actual_tons` real;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `actual_amount` real;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `adjustment_amount` real;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `adjustment_status` text DEFAULT 'na';