ALTER TABLE `playbook_steps` ADD `assignmentRule` enum('transaction_assignee','least_loaded_staff','request_owner','unassigned') DEFAULT 'transaction_assignee' NOT NULL;--> statement-breakpoint
ALTER TABLE `playbook_steps` ADD `slaMinutes` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignmentSource` enum('manual','transaction_assignee','least_loaded_staff','request_owner','unassigned') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `slaMinutes` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `slaDueAt` timestamp;--> statement-breakpoint
CREATE INDEX `tasks_sla_due_idx` ON `tasks` (`slaDueAt`,`status`);