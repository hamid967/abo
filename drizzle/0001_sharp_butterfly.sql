CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int,
	`customerUserId` int NOT NULL,
	`assigneeUserId` int,
	`title` varchar(255) NOT NULL,
	`location` varchar(255),
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`outcome` text,
	`status` enum('scheduled','completed','cancelled','missed') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`transactionId` int,
	`ownerUserId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`fileSizeBytes` int NOT NULL,
	`documentType` varchar(120),
	`verificationStatus` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `government_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(120),
	`officialUrl` varchar(1024),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `government_entities_id` PRIMARY KEY(`id`),
	CONSTRAINT `government_entities_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `government_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`audience` varchar(120),
	`description` text,
	`requirements` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `government_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`type` varchar(64) NOT NULL,
	`data` json,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('owner','manager','representative','viewer') NOT NULL DEFAULT 'representative',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_member_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`organizationType` enum('establishment','company','association','nonprofit') NOT NULL,
	`commercialRegistration` varchar(64),
	`city` varchar(120),
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(32) NOT NULL,
	`customerUserId` int NOT NULL,
	`organizationId` int,
	`serviceId` int,
	`beneficiaryType` enum('individual','establishment','company','association','nonprofit','representative') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`city` varchar(120),
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('draft','submitted','under_review','converted','cancelled') NOT NULL DEFAULT 'draft',
	`desiredDueAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_requests_number_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int,
	`ownerUserId` int NOT NULL,
	`assigneeUserId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('new','in_progress','awaiting_customer','awaiting_external','completed','overdue','cancelled') NOT NULL DEFAULT 'new',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`previousStatus` varchar(64),
	`nextStatus` varchar(64) NOT NULL,
	`actorUserId` int NOT NULL,
	`customerNote` text,
	`internalNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaction_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`customerUserId` int NOT NULL,
	`organizationId` int,
	`entityId` int,
	`serviceId` int,
	`assigneeUserId` int,
	`referenceNumber` varchar(128),
	`status` enum('draft','received','under_review','awaiting_assignment','assigned','document_verification','awaiting_customer_documents','ready_for_submission','submitted_to_agency','under_agency_review','awaiting_appointment','beneficiary_attendance_required','payment_required','revision_required','suspended','overdue','completed','rejected','cancelled','archived') NOT NULL DEFAULT 'received',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`nextAction` text,
	`dueAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','employee','supervisor','admin','super_admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `appointments_customer_idx` ON `appointments` (`customerUserId`);--> statement-breakpoint
CREATE INDEX `appointments_starts_at_idx` ON `appointments` (`startsAt`);--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `documents_transaction_idx` ON `documents` (`transactionId`);--> statement-breakpoint
CREATE INDEX `government_services_entity_idx` ON `government_services` (`entityId`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipientUserId`,`readAt`);--> statement-breakpoint
CREATE INDEX `organization_members_user_idx` ON `organization_members` (`userId`);--> statement-breakpoint
CREATE INDEX `organizations_owner_idx` ON `organizations` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `service_requests_customer_idx` ON `service_requests` (`customerUserId`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_owner_idx` ON `tasks` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `tasks_transaction_idx` ON `tasks` (`transactionId`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `status_history_transaction_idx` ON `transaction_status_history` (`transactionId`);--> statement-breakpoint
CREATE INDEX `transactions_customer_idx` ON `transactions` (`customerUserId`);--> statement-breakpoint
CREATE INDEX `transactions_assignee_idx` ON `transactions` (`assigneeUserId`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);