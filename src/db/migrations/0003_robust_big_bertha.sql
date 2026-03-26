CREATE TABLE `report_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`format` text DEFAULT 'excel' NOT NULL,
	`columns` text NOT NULL,
	`subject` text,
	`message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scheduled_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`template_id` integer NOT NULL,
	`send_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `report_templates`(`id`) ON UPDATE no action ON DELETE no action
);
