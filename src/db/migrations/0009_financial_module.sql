-- Financial module: bank accounts, transactions, OpEx, capital movements,
-- period close, period snapshots, and auto-categorization rules.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `bank_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`bank` text NOT NULL,
	`account_number_masked` text NOT NULL,
	`account_type` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transaction_category_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`match_type` text DEFAULT 'contains' NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`vendor_name` text,
	`default_reconcile_type` text DEFAULT 'none' NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `accounting_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_at` text,
	`closed_by_user_id` integer,
	`published_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bank_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bank_account_id` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`amount` real NOT NULL,
	`balance_after` real,
	`description_raw` text NOT NULL,
	`vendor_name` text,
	`category` text DEFAULT 'Uncategorized' NOT NULL,
	`subcategory` text,
	`manually_categorized` integer DEFAULT false NOT NULL,
	`reconciled_invoice_id` integer,
	`reconciled_supplier_payment_id` integer,
	`reconciled_op_expense_id` integer,
	`reconciled_capital_id` integer,
	`internal_transfer_pair_id` integer,
	`imported_from` text,
	`imported_at` text NOT NULL,
	`accounting_period_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reconciled_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reconciled_supplier_payment_id`) REFERENCES `supplier_payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operating_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_date` text NOT NULL,
	`category` text NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`bank_transaction_id` integer,
	`purchase_order_id` integer,
	`invoice_id` integer,
	`accounting_period_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `capital_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movement_date` text NOT NULL,
	`movement_type` text NOT NULL,
	`member_name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`bank_transaction_id` integer,
	`accounting_period_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `period_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accounting_period_id` integer NOT NULL,
	`line_item` text NOT NULL,
	`line_category` text NOT NULL,
	`amount` real NOT NULL,
	`source` text DEFAULT 'computed' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_tx_account_date` ON `bank_transactions` (`bank_account_id`, `transaction_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_tx_category` ON `bank_transactions` (`category`, `subcategory`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_tx_period` ON `bank_transactions` (`accounting_period_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_op_expense_date` ON `operating_expenses` (`expense_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_op_expense_period` ON `operating_expenses` (`accounting_period_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_capital_date` ON `capital_movements` (`movement_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_period_year_month` ON `accounting_periods` (`period_year`, `period_month`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_snapshot_period_category` ON `period_snapshots` (`accounting_period_id`, `line_category`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_category_rule_priority` ON `transaction_category_rules` (`priority` DESC, `active`);
