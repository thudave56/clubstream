import { pgEnum, pgTable, text, timestamp, uuid, integer, boolean, jsonb, date, primaryKey } from "drizzle-orm/pg-core";

// Enums
export const matchStatusEnum = pgEnum("match_status", [
  "draft",
  "scheduled",
  "ready",
  "live",
  "ended",
  "canceled",
  "error"
]);

export const streamStatusEnum = pgEnum("stream_status", [
  "available",
  "reserved",
  "in_use",
  "stuck",
  "disabled"
]);

export const oauthStatusEnum = pgEnum("oauth_status", [
  "disconnected",
  "connecting",
  "connected",
  "error"
]);

// Tables
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const streamPool = pgTable("stream_pool", {
  id: uuid("id").defaultRandom().primaryKey(),
  youtubeStreamId: text("youtube_stream_id").notNull().unique(),
  ingestAddress: text("ingest_address").notNull(),
  streamName: text("stream_name").notNull(),
  status: streamStatusEnum("status").default("available").notNull(),
  reservedMatchId: uuid("reserved_match_id").references((): any => matches.id, {
    onDelete: "set null"
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, {
    onDelete: "restrict"
  }),
  opponentName: text("opponent_name").notNull(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, {
    onDelete: "set null"
  }),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  courtLabel: text("court_label"),
  status: matchStatusEnum("status").default("draft").notNull(),
  youtubeBroadcastId: text("youtube_broadcast_id"),
  youtubeWatchUrl: text("youtube_watch_url"),
  streamPoolId: uuid("stream_pool_id").references(() => streamPool.id, {
    onDelete: "set null"
  }),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const scores = pgTable("scores", {
  matchId: uuid("match_id").notNull().references(() => matches.id, {
    onDelete: "cascade"
  }),
  setNumber: integer("set_number").notNull(),
  homeScore: integer("home_score").default(0).notNull(),
  awayScore: integer("away_score").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.setNumber] })
}));

export const adminSettings = pgTable("admin_settings", {
  id: integer("id").primaryKey().default(1),
  requireCreatePin: boolean("require_create_pin").default(false).notNull(),
  adminPinHash: text("admin_pin_hash"),
  createPinHash: text("create_pin_hash"),
  oauthStatus: oauthStatusEnum("oauth_status").default("disconnected").notNull(),
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
