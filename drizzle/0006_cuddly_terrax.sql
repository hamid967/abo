CREATE TABLE `automation_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`heartbeatTaskUid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastRunAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastSummary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_schedules_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `due_notification_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`resourceType` varchar(32) NOT NULL,
	`resourceId` varchar(120) NOT NULL,
	`notifiedForDate` varchar(10) NOT NULL,
	`notificationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `due_notification_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `due_notification_runs_unique` UNIQUE(`recipientUserId`,`resourceType`,`resourceId`,`notifiedForDate`)
);
--> statement-breakpoint
ALTER TABLE `due_notification_runs` ADD CONSTRAINT `due_notification_runs_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `due_notification_runs` ADD CONSTRAINT `due_notification_runs_notification_fk` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automation_schedules_task_uid_idx` ON `automation_schedules` (`heartbeatTaskUid`);--> statement-breakpoint
CREATE INDEX `due_notification_runs_date_idx` ON `due_notification_runs` (`notifiedForDate`);