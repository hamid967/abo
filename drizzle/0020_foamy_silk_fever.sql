CREATE TABLE `official_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorityNameAr` varchar(255) NOT NULL,
	`authorityNameEn` varchar(255),
	`sourceName` varchar(255) NOT NULL,
	`sourceType` enum('rss','api','webhook') NOT NULL,
	`officialUrl` varchar(2048) NOT NULL,
	`feedUrl` varchar(2048),
	`collectionMethod` enum('rss','api','webhook') NOT NULL,
	`verificationStatus` enum('pending','verified','disabled') NOT NULL DEFAULT 'pending',
	`collectionFrequency` enum('manual','daily','hourly') NOT NULL DEFAULT 'daily',
	`lastCheckedAt` timestamp,
	`lastSuccessAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `official_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_sources_feed_unique` UNIQUE(`feedUrl`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`externalReference` varchar(1024),
	`titleAr` varchar(1024),
	`titleEn` varchar(1024),
	`originalTitle` varchar(1024) NOT NULL,
	`officialUrl` varchar(2048) NOT NULL,
	`updateType` enum('system','regulation','decision','circular','procedural_guide','platform_update','deadline','new_requirement','fees','penalty','new_service','service_change','technical_alert','general_news','other') NOT NULL DEFAULT 'general_news',
	`publishedAt` timestamp,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`originalContent` text NOT NULL,
	`summaryAr` text,
	`summaryEn` text,
	`status` enum('collected','duplicate','processing','needs_review','verified','published','rejected','archived') NOT NULL DEFAULT 'collected',
	`importance` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`checksum` varchar(64) NOT NULL,
	`previousVersionId` int,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`publishedByUserId` int,
	`publishedAtSystem` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulatory_updates_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_updates_source_checksum_unique` UNIQUE(`sourceId`,`checksum`)
);
--> statement-breakpoint
CREATE TABLE `update_impacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`updateId` int NOT NULL,
	`audienceType` varchar(120),
	`businessActivity` varchar(255),
	`impactedServiceId` int,
	`impactLevel` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`impactSummary` text,
	`requiredAction` text,
	`actionDeadline` timestamp,
	`confidence` int,
	`reviewedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `update_impacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `update_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceId` int,
	`updateType` varchar(64),
	`activity` varchar(255),
	`city` varchar(120),
	`notificationChannel` enum('in_app','push') NOT NULL DEFAULT 'in_app',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `update_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `official_sources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_previous_version_fk` FOREIGN KEY (`previousVersionId`) REFERENCES `regulatory_updates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_reviewer_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_publisher_fk` FOREIGN KEY (`publishedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_impacts` ADD CONSTRAINT `update_impacts_update_fk` FOREIGN KEY (`updateId`) REFERENCES `regulatory_updates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_impacts` ADD CONSTRAINT `update_impacts_service_fk` FOREIGN KEY (`impactedServiceId`) REFERENCES `government_services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_impacts` ADD CONSTRAINT `update_impacts_reviewer_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_subscriptions` ADD CONSTRAINT `update_subscriptions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_subscriptions` ADD CONSTRAINT `update_subscriptions_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `official_sources`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `official_sources_active_idx` ON `official_sources` (`isActive`,`verificationStatus`);--> statement-breakpoint
CREATE INDEX `regulatory_updates_public_idx` ON `regulatory_updates` (`status`,`publishedAt`,`importance`);--> statement-breakpoint
CREATE INDEX `regulatory_updates_source_status_idx` ON `regulatory_updates` (`sourceId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `update_impacts_update_idx` ON `update_impacts` (`updateId`);--> statement-breakpoint
CREATE INDEX `update_subscriptions_user_active_idx` ON `update_subscriptions` (`userId`,`isActive`);