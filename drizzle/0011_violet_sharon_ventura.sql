CREATE TABLE `login_security_devices` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`deviceFingerprint` varchar(128) NOT NULL,
	`networkFingerprint` varchar(128) NOT NULL,
	`platform` varchar(32),
	`userAgent` varchar(512),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_security_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `login_security_device_unique` UNIQUE(`userId`,`deviceFingerprint`)
);
--> statement-breakpoint
ALTER TABLE `expo_go_oauth_attempts` ADD `deviceId` varchar(128);--> statement-breakpoint
ALTER TABLE `expo_go_oauth_attempts` ADD `platform` varchar(32);--> statement-breakpoint
ALTER TABLE `login_security_devices` ADD CONSTRAINT `login_security_device_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `login_security_device_user_idx` ON `login_security_devices` (`userId`);