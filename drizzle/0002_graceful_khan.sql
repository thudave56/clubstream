ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "tournament_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "youtube_title_override" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "youtube_description_override" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "rules_best_of" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "rules_points_to_win" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "rules_final_set_points" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "rules_win_by" integer DEFAULT 2 NOT NULL;
