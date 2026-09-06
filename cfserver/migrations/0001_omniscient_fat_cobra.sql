ALTER TABLE `posts` ADD `pin_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_pinned_post_idx` ON `posts` (`pin_order`) WHERE "posts"."pin_order" > 0;