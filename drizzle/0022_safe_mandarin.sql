CREATE TABLE `mobile_app_releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('android_apk','android_aab','ios_ipa') NOT NULL,
	`status` enum('pending','building','ready','failed','archived') NOT NULL DEFAULT 'pending',
	`versionLabel` varchar(80) NOT NULL,
	`buildReference` varchar(255),
	`downloadUrl` varchar(2048),
	`releaseNotes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mobile_app_releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mobile_app_releases` ADD CONSTRAINT `mobile_app_releases_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobile_app_releases_status_idx` ON `mobile_app_releases` (`status`,`platform`);