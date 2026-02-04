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
- Visit `/admin` for the admin login placeholder.
- GET `/api/teams` should return seeded teams.
- GET `/api/matches?date=YYYY-MM-DD` returns an object with a `matches` array (e.g. `{ "matches": [] }` when there are no matches).

## Troubleshooting npm install

If `npm install` returns a 403 error, ensure the project is using the public npm registry:

```bash
npm install --registry=https://registry.npmjs.org/
```

This repository includes a `.npmrc` with the registry set to `https://registry.npmjs.org/`. If your environment enforces a private registry, update it to allow the public registry for this project.
