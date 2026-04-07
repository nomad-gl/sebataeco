ALTER TABLE `lesson_plans` ADD `isTemplate` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD `templateName` varchar(255);