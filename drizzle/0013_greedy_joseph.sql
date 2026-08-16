CREATE TABLE `playbook_steps` (
	`id` varchar(36) NOT NULL,
	`versionId` varchar(36) NOT NULL,
	`stepKey` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`instructions` text,
	`actionType` enum('instruction','document','approval','task') NOT NULL DEFAULT 'instruction',
	`stepOrder` int NOT NULL,
	`isRequired` boolean NOT NULL DEFAULT true,
	`expectedDurationMinutes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `playbook_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `playbook_steps_key_unique` UNIQUE(`versionId`,`stepKey`),
	CONSTRAINT `playbook_steps_order_unique` UNIQUE(`versionId`,`stepOrder`)
);
--> statement-breakpoint
CREATE TABLE `playbook_versions` (
	`id` varchar(36) NOT NULL,
	`playbookId` varchar(36) NOT NULL,
	`versionNumber` int NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`title` varchar(255) NOT NULL,
	`description` text,
	`requirements` json,
	`exceptions` json,
	`createdByUserId` int NOT NULL,
	`publishedByUserId` int,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playbook_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `playbook_versions_unique` UNIQUE(`playbookId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `request_playbook_assignments` (
	`id` varchar(36) NOT NULL,
	`requestId` int NOT NULL,
	`playbookId` varchar(36) NOT NULL,
	`versionId` varchar(36) NOT NULL,
	`snapshot` json NOT NULL,
	`assignedByUserId` int,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `request_playbook_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_playbook_assignment_request_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `service_playbooks` (
	`id` varchar(36) NOT NULL,
	`serviceId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_playbooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `playbook_steps` ADD CONSTRAINT `playbook_steps_version_fk` FOREIGN KEY (`versionId`) REFERENCES `playbook_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `playbook_versions` ADD CONSTRAINT `playbook_versions_playbook_fk` FOREIGN KEY (`playbookId`) REFERENCES `service_playbooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `playbook_versions` ADD CONSTRAINT `playbook_versions_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `playbook_versions` ADD CONSTRAINT `playbook_versions_publisher_fk` FOREIGN KEY (`publishedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_playbook_assignments` ADD CONSTRAINT `request_playbook_assignment_request_fk` FOREIGN KEY (`requestId`) REFERENCES `service_requests`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_playbook_assignments` ADD CONSTRAINT `request_playbook_assignment_playbook_fk` FOREIGN KEY (`playbookId`) REFERENCES `service_playbooks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_playbook_assignments` ADD CONSTRAINT `request_playbook_assignment_version_fk` FOREIGN KEY (`versionId`) REFERENCES `playbook_versions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_playbook_assignments` ADD CONSTRAINT `request_playbook_assignment_actor_fk` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_playbooks` ADD CONSTRAINT `service_playbooks_service_fk` FOREIGN KEY (`serviceId`) REFERENCES `government_services`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_playbooks` ADD CONSTRAINT `service_playbooks_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `playbook_versions_active_idx` ON `playbook_versions` (`playbookId`,`status`);--> statement-breakpoint
CREATE INDEX `request_playbook_assignment_version_idx` ON `request_playbook_assignments` (`versionId`);--> statement-breakpoint
CREATE INDEX `service_playbooks_service_idx` ON `service_playbooks` (`serviceId`,`status`);