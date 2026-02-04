# Clubstream

Clubstream is a Next.js App Router application for managing live sports streams and score overlays.

Note: The Codex sandbox may not be able to install dependencies. CI is the validation path.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
3. Run Drizzle migrations and seed data:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Environment variables

- `DATABASE_URL` - Postgres connection string.
- `APP_BASE_URL` - Base URL for constructing absolute links (e.g. `http://localhost:3000`).

## How to run

- `npm run dev` - Start the Next.js dev server.
- `npm run db:generate` - Generate Drizzle migrations from schema changes.
- `npm run db:migrate` - Apply Drizzle migrations to the database.
- `npm run db:seed` - Seed example teams.

## What to test

- Visit `/` to see the match list placeholder.
- Visit `/m/[id]` to see match detail placeholder.
- Visit `/admin` for admin login (use PIN `1234`).
- Visit `/admin/dashboard` after logging in to see admin dashboard.
- Test admin logout and session management.
- GET `/api/teams` should return seeded teams (only enabled teams).
- GET `/api/matches?date=YYYY-MM-DD` returns an object with a `matches` array (e.g. `{ "matches": [] }` when there are no matches).

## Schema Changes (PR: Align with PRD)

The database schema has been updated to align with the PRD specifications:

### Key Changes:

**teams table:**
- Added `slug` field for URL-friendly identifiers
- Renamed `name` to `display_name` for clarity
- Added `enabled` flag for soft-deleting teams

**matches table:**
- Changed from `homeTeamId + awayTeamId` to `teamId + opponentName` model
  - `teamId`: References one of our club teams
  - `opponentName`: Free-form text for external opponents
- Removed `title` field (can be computed from team + opponent)
- Added `idempotencyKey` for preventing duplicate match creation
- Added `courtLabel` for multi-court tournament support
- Renamed `scheduledAt` to `scheduledStart`
- Enhanced status enum: `draft`, `scheduled`, `ready`, `live`, `ended`, `canceled`, `error`

**scores table:**
- Complete redesign to set-based volleyball scoring
- Composite primary key: `(matchId, setNumber)`
- Fields: `homeScore`, `awayScore` (replaces per-team tracking)
- Supports volleyball's 3-5 set structure

**stream_pool table:**
- Added `reservedMatchId` to track which match reserved a stream
- Added `disabled` state to status enum

**tournaments table:**
- Changed from single `startsAt` timestamp to `startDate` and `endDate` (date fields)

**admin_settings table:**
- Split `pinHash` into `adminPinHash` and `createPinHash` for dual PIN security model

### Migration Notes:

This is a breaking schema change. If you have existing data:
1. Back up your database
2. Identify which teams are "club teams" vs "opponents"
3. For each match, keep one club team as `teamId`, convert opponent to `opponentName`
4. Scores will need to be restructured into set-based format

## Admin Authentication (PR #2)

Admin PIN authentication system with session management.

### Features:

**Security:**
- Admin PIN authentication with secure hashing (scrypt)
- HTTP-only secure session cookies (24-hour duration)
- Rate limiting (5 attempts per 15 minutes)
- Audit logging for all admin actions

**Admin Dashboard:**
- OAuth status display (connected/disconnected)
- Stream pool health metrics (available/reserved/in_use/stuck)
- Security settings toggle (`requireCreatePin` feature flag)
- Recent activity audit log viewer (placeholder)

**API Endpoints:**
- `POST /api/admin/login` - Authenticate with admin PIN
- `POST /api/admin/logout` - End admin session
- `GET /api/admin/settings` - Get admin settings (protected)
- `PATCH /api/admin/settings` - Update settings (protected)

### Default Admin PIN:

⚠️ **Default PIN:** `1234` (for development only)

**IMPORTANT:** Change this PIN in production! The seed script initializes the admin settings with this default PIN. You should change it through the database or implement a PIN change feature.

### Testing Admin Auth:

1. Run seed script: `npm run db:seed`
2. Visit `/admin` and login with PIN `1234`
3. You'll be redirected to `/admin/dashboard`
4. Try toggling the "Require PIN for Match Creation" setting
5. Test logout functionality

## Troubleshooting npm install

If `npm install` returns a 403 error, ensure the project is using the public npm registry:

```bash
npm install --registry=https://registry.npmjs.org/
```

This repository includes a `.npmrc` with the registry set to `https://registry.npmjs.org/`. If your environment enforces a private registry, update it to allow the public registry for this project.
