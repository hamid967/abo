CREATE TABLE `expo_go_oauth_attempts` (
	`id` varchar(64) NOT NULL,
	`proofHash` varchar(64) NOT NULL,
	`callbackState` varchar(2048) NOT NULL,
	`authorizationCode` text,
	`status` enum('pending','ready','exchanging','failed') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expo_go_oauth_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `expo_go_oauth_attempts_expiry_idx` ON `expo_go_oauth_attempts` (`expiresAt`);