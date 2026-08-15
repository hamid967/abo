CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`resourceType` varchar(120) NOT NULL,
	`resourceId` varchar(120),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faq_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` varchar(500) NOT NULL,
	`answer` text NOT NULL,
	`category` varchar(120),
	`language` enum('ar','en') NOT NULL DEFAULT 'ar',
	`isPublished` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `faq_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` text,
	`content` text NOT NULL,
	`category` varchar(120),
	`language` enum('ar','en') NOT NULL DEFAULT 'ar',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`sourceLabel` varchar(255),
	`sourceUrl` varchar(1024),
	`publishedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerUserId` int NOT NULL,
	`transactionId` int,
	`assignedUserId` int,
	`subject` varchar(255) NOT NULL,
	`status` enum('open','in_progress','awaiting_customer','resolved','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`body` text NOT NULL,
	`isInternal` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faq_items` ADD CONSTRAINT `faq_items_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customer_fk` FOREIGN KEY (`customerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_transaction_fk` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assignee_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_fk` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_author_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resourceType`,`resourceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `faq_items_public_idx` ON `faq_items` (`isPublished`,`language`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `knowledge_articles_status_language_idx` ON `knowledge_articles` (`status`,`language`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `support_tickets_customer_idx` ON `support_tickets` (`customerUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `support_tickets_assignee_idx` ON `support_tickets` (`assignedUserId`,`status`);--> statement-breakpoint
CREATE INDEX `support_tickets_transaction_idx` ON `support_tickets` (`transactionId`);--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_idx` ON `ticket_messages` (`ticketId`,`createdAt`);