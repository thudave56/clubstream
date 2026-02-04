import { pgEnum, pgTable, text, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const matchStatusEnum = pgEnum("match_status", [
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELED"
]);

export const streamStatusEnum = pgEnum("stream_status", [
  "AVAILABLE",
  "RESERVED",
  "IN_USE",
  "STUCK"
]);

export const oauthStatusEnum = pgEnum("oauth_status", [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "ERROR"
]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const streamPool = pgTable("stream_pool", {
  id: uuid("id").defaultRandom().primaryKey(),
  youtubeStreamId: text("youtube_stream_id").notNull().unique(),
  ingestAddress: text("ingest_address").notNull(),
  streamName: text("stream_name").notNull(),
  status: streamStatusEnum("status").default("AVAILABLE").notNull(),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, {
    onDelete: "set null"
  }),
  homeTeamId: uuid("home_team_id").notNull().references(() => teams.id, {
    onDelete: "restrict"
  }),
  awayTeamId: uuid("away_team_id").notNull().references(() => teams.id, {
    onDelete: "restrict"
  }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: matchStatusEnum("status").default("SCHEDULED").notNull(),
  youtubeBroadcastId: text("youtube_broadcast_id"),
  youtubeWatchUrl: text("youtube_watch_url"),
  streamPoolId: uuid("stream_pool_id").references(() => streamPool.id, {
    onDelete: "set null"
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const scores = pgTable("scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull().references(() => matches.id, {
    onDelete: "cascade"
  }),
  teamId: uuid("team_id").notNull().references(() => teams.id, {
    onDelete: "cascade"
  }),
  value: integer("value").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const adminSettings = pgTable("admin_settings", {
  id: integer("id").primaryKey().default(1),
  requireCreatePin: boolean("require_create_pin").default(false).notNull(),
  pinHash: text("pin_hash"),
  oauthStatus: oauthStatusEnum("oauth_status").default("DISCONNECTED").notNull(),
  channelId: text("channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});
