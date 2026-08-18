CREATE TABLE `document_field_extractions` (
	`id` varchar(36) NOT NULL,
	`documentId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`status` enum('preview','confirmed') NOT NULL DEFAULT 'preview',
	`documentType` varchar(120),
	`extractedFields` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `document_field_extractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_field_extractions` ADD CONSTRAINT `document_field_extractions_document_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_field_extractions` ADD CONSTRAINT `document_field_extractions_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_field_extractions_document_idx` ON `document_field_extractions` (`documentId`);--> statement-breakpoint
CREATE INDEX `document_field_extractions_owner_idx` ON `document_field_extractions` (`ownerUserId`,`createdAt`);