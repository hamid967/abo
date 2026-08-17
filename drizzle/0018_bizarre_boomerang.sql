CREATE TABLE `task_checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`isRequired` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`completedByUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`dependsOnTaskId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_dependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_dependencies_unique` UNIQUE(`taskId`,`dependsOnTaskId`)
);
--> statement-breakpoint
ALTER TABLE `task_checklist_items` ADD CONSTRAINT `task_checklist_items_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_checklist_items` ADD CONSTRAINT `task_checklist_items_completed_by_fk` FOREIGN KEY (`completedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_checklist_items` ADD CONSTRAINT `task_checklist_items_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_predecessor_fk` FOREIGN KEY (`dependsOnTaskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `task_checklist_items_task_idx` ON `task_checklist_items` (`taskId`,`position`);--> statement-breakpoint
CREATE INDEX `task_dependencies_task_idx` ON `task_dependencies` (`taskId`);--> statement-breakpoint
CREATE INDEX `task_dependencies_predecessor_idx` ON `task_dependencies` (`dependsOnTaskId`);