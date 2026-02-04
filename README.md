# Clubstream

Clubstream is a Next.js App Router application for managing live sports streams and score overlays.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
3. Run Prisma migrations and seed data:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   npm run prisma:seed
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
- `npm run prisma:migrate` - Apply Prisma migrations in development.
- `npm run prisma:seed` - Seed example teams.

## What to test

- Visit `/` to see the match list placeholder.
- Visit `/m/[id]` to see match detail placeholder.
- Visit `/admin` for the admin login placeholder.
- GET `/api/teams` should return seeded teams.
- GET `/api/matches?date=YYYY-MM-DD` returns an empty array.
