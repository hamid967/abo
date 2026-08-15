CREATE TABLE `automation_events` (
	`id` varchar(36) NOT NULL,
	`eventName` varchar(96) NOT NULL,
	`aggregateType` varchar(64) NOT NULL,
	`aggregateId` varchar(96) NOT NULL,
	`ownerUserId` int,
	`payload` json NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_events_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `automation_rules` (
	`id` varchar(36) NOT NULL,
	`key` varchar(96) NOT NULL,
	`name` varchar(180) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`triggerEvent` varchar(96) NOT NULL,
	`conditions` json NOT NULL,
	`actions` json NOT NULL,
	`priority` int NOT NULL DEFAULT 100,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_rules_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` varchar(36) NOT NULL,
	`ruleId` varchar(36) NOT NULL,
	`eventId` varchar(36) NOT NULL,
	`status` enum('pending','running','succeeded','failed','skipped') NOT NULL DEFAULT 'pending',
	`idempotencyKey` varchar(160) NOT NULL,
	`result` json,
	`errorCode` varchar(96),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_runs_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `automation_events` ADD CONSTRAINT `automation_events_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automation_runs` ADD CONSTRAINT `automation_runs_rule_fk` FOREIGN KEY (`ruleId`) REFERENCES `automation_rules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automation_runs` ADD CONSTRAINT `automation_runs_event_fk` FOREIGN KEY (`eventId`) REFERENCES `automation_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automation_events_name_occurred_idx` ON `automation_events` (`eventName`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `automation_events_owner_occurred_idx` ON `automation_events` (`ownerUserId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `automation_rules_trigger_enabled_idx` ON `automation_rules` (`triggerEvent`,`enabled`,`priority`);--> statement-breakpoint
CREATE INDEX `automation_runs_rule_status_idx` ON `automation_runs` (`ruleId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `automation_runs_event_idx` ON `automation_runs` (`eventId`);