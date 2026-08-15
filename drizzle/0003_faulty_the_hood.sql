CREATE TABLE `cloud_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`recordType` enum('transactions','workspace','inquiries') NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cloud_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `cloud_records_owner_type_unique` UNIQUE(`ownerUserId`,`recordType`)
);
--> statement-breakpoint
ALTER TABLE `cloud_records` ADD CONSTRAINT `cloud_records_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;