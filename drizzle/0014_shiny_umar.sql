ALTER TABLE `tasks` ADD `sourceType` enum('manual','playbook_step','automation') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `sourceKey` varchar(160);--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_playbook_step_unique` UNIQUE(`transactionId`,`sourceType`,`sourceKey`);