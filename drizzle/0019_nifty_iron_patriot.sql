CREATE TABLE `approval_requests` (
	`id` varchar(36) NOT NULL,
	`resourceType` enum('task','service_request') NOT NULL,
	`resourceId` varchar(64) NOT NULL,
	`ownerUserId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`routingMode` enum('sequential','parallel') NOT NULL DEFAULT 'sequential',
	`status` enum('pending','approved','rejected','changes_requested','information_requested','cancelled','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`approvalRequestId` varchar(36) NOT NULL,
	`stepOrder` int NOT NULL,
	`requiredRole` enum('user','employee','supervisor','admin','super_admin') NOT NULL,
	`assignedUserId` int,
	`label` varchar(255) NOT NULL,
	`status` enum('pending','approved','rejected','changes_requested','information_requested','skipped') NOT NULL DEFAULT 'pending',
	`decisionNote` text,
	`decidedByUserId` int,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_steps_order_unique` UNIQUE(`approvalRequestId`,`stepOrder`)
);
--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_request_fk` FOREIGN KEY (`approvalRequestId`) REFERENCES `approval_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_assignee_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_decider_fk` FOREIGN KEY (`decidedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_requests_resource_idx` ON `approval_requests` (`resourceType`,`resourceId`,`status`);--> statement-breakpoint
CREATE INDEX `approval_requests_owner_idx` ON `approval_requests` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `approval_steps_assignee_idx` ON `approval_steps` (`assignedUserId`,`status`);--> statement-breakpoint
CREATE INDEX `approval_steps_role_idx` ON `approval_steps` (`requiredRole`,`status`);