CREATE TABLE IF NOT EXISTS "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "youtube_oauth_access_token" text;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "youtube_oauth_refresh_token" text;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN IF NOT EXISTS "token_expires_at" timestamp with time zone;
