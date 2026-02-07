CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
DO $$ BEGIN
 IF to_regtype('public.match_status') IS NULL THEN
  CREATE TYPE "public"."match_status" AS ENUM('draft', 'scheduled', 'ready', 'live', 'ended', 'canceled', 'error');
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF to_regtype('public.oauth_status') IS NULL THEN
  CREATE TYPE "public"."oauth_status" AS ENUM('disconnected', 'connecting', 'connected', 'error');
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF to_regtype('public.stream_status') IS NULL THEN
  CREATE TYPE "public"."stream_status" AS ENUM('available', 'reserved', 'in_use', 'stuck', 'disabled');
 END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"require_create_pin" boolean DEFAULT false NOT NULL,
	"admin_pin_hash" text,
	"create_pin_hash" text,
	"oauth_status" "oauth_status" DEFAULT 'disconnected' NOT NULL,
	"channel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"opponent_name" text NOT NULL,
	"tournament_id" uuid,
	"scheduled_start" timestamp with time zone,
	"court_label" text,
	"status" "match_status" DEFAULT 'draft' NOT NULL,
	"youtube_broadcast_id" text,
	"youtube_watch_url" text,
	"stream_pool_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scores" (
	"match_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_match_id_set_number_pk" PRIMARY KEY("match_id","set_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stream_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_stream_id" text NOT NULL,
	"ingest_address" text NOT NULL,
	"stream_name" text NOT NULL,
	"status" "stream_status" DEFAULT 'available' NOT NULL,
	"reserved_match_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stream_pool_youtube_stream_id_unique" UNIQUE("youtube_stream_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_stream_pool_id_stream_pool_id_fk" FOREIGN KEY ("stream_pool_id") REFERENCES "public"."stream_pool"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scores" ADD CONSTRAINT "scores_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stream_pool" ADD CONSTRAINT "stream_pool_reserved_match_id_matches_id_fk" FOREIGN KEY ("reserved_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
