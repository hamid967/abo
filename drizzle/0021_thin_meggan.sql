CREATE TABLE `admin_settings` (
	`id` int NOT NULL,
	`approvalAlertWindowHours` int NOT NULL DEFAULT 24,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_settings` ADD CONSTRAINT `admin_settings_updated_by_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;