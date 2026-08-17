CREATE TABLE `mobile_push_devices` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`platform` enum('ios','android') NOT NULL,
	`expoPushToken` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mobile_push_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobile_push_device_user_unique` UNIQUE(`userId`,`deviceId`),
	CONSTRAINT `mobile_push_device_token_unique` UNIQUE(`expoPushToken`)
);
--> statement-breakpoint
ALTER TABLE `notification_delivery_logs` MODIFY COLUMN `channel` enum('in_app','push') NOT NULL DEFAULT 'in_app';--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `pushEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `taskAlertsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `calendarSyncEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `taskReminderMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `mobile_push_devices` ADD CONSTRAINT `mobile_push_device_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobile_push_device_user_enabled_idx` ON `mobile_push_devices` (`userId`,`enabled`);