ALTER TABLE "matches" ADD COLUMN "tournament_name" text;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "youtube_title_override" text;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "youtube_description_override" text;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "rules_best_of" integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "rules_points_to_win" integer DEFAULT 25 NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "rules_final_set_points" integer DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "rules_win_by" integer DEFAULT 2 NOT NULL;
