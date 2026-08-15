ALTER TABLE `service_requests` ADD `customerPhone` varchar(32);--> statement-breakpoint
CREATE INDEX `service_requests_phone_idx` ON `service_requests` (`customerPhone`);