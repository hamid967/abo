CREATE TABLE `ai_conversations` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`draftId` varchar(36),
	`status` enum('active','paused','submitted','needs_human_review','cancelled','expired') NOT NULL DEFAULT 'active',
	`currentState` enum('started','identifying_intent','selecting_beneficiary','selecting_service','selecting_entity','collecting_information','collecting_documents','validating_information','reviewing_summary','awaiting_confirmation','submitting','submitted','needs_human_review','cancelled','expired') NOT NULL DEFAULT 'started',
	`detectedIntent` varchar(64),
	`language` enum('ar','en') NOT NULL DEFAULT 'ar',
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`role` enum('user','assistant','tool') NOT NULL,
	`content` text NOT NULL,
	`toolName` varchar(120),
	`toolCallId` varchar(96),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handoff_requests` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`draftId` varchar(36),
	`ticketId` int,
	`assignedToUserId` int,
	`reason` varchar(255) NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('pending','assigned','resolved','cancelled') NOT NULL DEFAULT 'pending',
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handoff_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_draft_documents` (
	`id` varchar(36) NOT NULL,
	`draftId` varchar(36) NOT NULL,
	`documentId` int NOT NULL,
	`requirementKey` varchar(120),
	`classificationStatus` enum('pending','confirmed','unclear','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `request_draft_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_draft_documents_unique` UNIQUE(`draftId`,`documentId`)
);
--> statement-breakpoint
CREATE TABLE `request_drafts` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`organizationId` int,
	`serviceId` int,
	`entityId` int,
	`submittedRequestId` int,
	`beneficiaryType` enum('individual','establishment','company','association','nonprofit','representative'),
	`structuredData` json NOT NULL,
	`completionPercentage` int NOT NULL DEFAULT 0,
	`validationStatus` enum('pending','errors','warnings','passed') NOT NULL DEFAULT 'pending',
	`status` enum('draft','reviewing','awaiting_confirmation','submitting','submitted','needs_human_review','cancelled','expired') NOT NULL DEFAULT 'draft',
	`summaryVersion` int NOT NULL DEFAULT 0,
	`idempotencyKey` varchar(96) NOT NULL,
	`expiresAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `request_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_drafts_owner_idempotency_unique` UNIQUE(`ownerUserId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `user_consents` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`draftId` varchar(36) NOT NULL,
	`consentType` enum('terms','privacy','request_submission') NOT NULL,
	`policyVersion` varchar(64) NOT NULL,
	`summaryVersion` int NOT NULL,
	`consentTextHash` varchar(128) NOT NULL,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `user_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `request_drafts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_messages` ADD CONSTRAINT `ai_messages_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_requests` ADD CONSTRAINT `handoff_requests_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_requests` ADD CONSTRAINT `handoff_requests_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_requests` ADD CONSTRAINT `handoff_requests_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `request_drafts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_requests` ADD CONSTRAINT `handoff_requests_ticket_fk` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_requests` ADD CONSTRAINT `handoff_requests_assignee_fk` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_draft_documents` ADD CONSTRAINT `request_draft_documents_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `request_drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_draft_documents` ADD CONSTRAINT `request_draft_documents_document_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_drafts` ADD CONSTRAINT `request_drafts_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_drafts` ADD CONSTRAINT `request_drafts_organization_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_drafts` ADD CONSTRAINT `request_drafts_service_fk` FOREIGN KEY (`serviceId`) REFERENCES `government_services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_drafts` ADD CONSTRAINT `request_drafts_entity_fk` FOREIGN KEY (`entityId`) REFERENCES `government_entities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_drafts` ADD CONSTRAINT `request_drafts_submitted_request_fk` FOREIGN KEY (`submittedRequestId`) REFERENCES `service_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_consents` ADD CONSTRAINT `user_consents_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_consents` ADD CONSTRAINT `user_consents_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `request_drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_conversations_owner_activity_idx` ON `ai_conversations` (`ownerUserId`,`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `ai_conversations_draft_idx` ON `ai_conversations` (`draftId`);--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_created_idx` ON `ai_messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `handoff_requests_owner_status_idx` ON `handoff_requests` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `handoff_requests_assignee_status_idx` ON `handoff_requests` (`assignedToUserId`,`status`);--> statement-breakpoint
CREATE INDEX `request_draft_documents_document_idx` ON `request_draft_documents` (`documentId`);--> statement-breakpoint
CREATE INDEX `request_drafts_owner_status_idx` ON `request_drafts` (`ownerUserId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `user_consents_owner_draft_idx` ON `user_consents` (`ownerUserId`,`draftId`,`consentType`);