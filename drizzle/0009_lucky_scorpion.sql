CREATE TABLE `notification_delivery_logs` (
	`id` varchar(36) NOT NULL,
	`notificationId` int NOT NULL,
	`channel` enum('in_app') NOT NULL DEFAULT 'in_app',
	`status` enum('queued','delivered','suppressed','failed') NOT NULL DEFAULT 'queued',
	`idempotencyKey` varchar(160) NOT NULL,
	`details` json,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_delivery_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_delivery_logs_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`userId` int NOT NULL,
	`inAppEnabled` boolean NOT NULL DEFAULT true,
	`digestFrequency` enum('immediate','daily') NOT NULL DEFAULT 'immediate',
	`quietHoursEnabled` boolean NOT NULL DEFAULT false,
	`quietStartHour` int,
	`quietEndHour` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `notification_delivery_logs` ADD CONSTRAINT `notification_delivery_logs_notification_fk` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_delivery_logs_notification_idx` ON `notification_delivery_logs` (`notificationId`,`createdAt`);