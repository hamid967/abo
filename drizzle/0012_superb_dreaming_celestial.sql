ALTER TABLE `support_tickets` ADD `channel` enum('support','abu_mishal_chat') DEFAULT 'support' NOT NULL;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD `readAt` timestamp;--> statement-breakpoint
CREATE INDEX `support_tickets_channel_updated_idx` ON `support_tickets` (`channel`,`updatedAt`);