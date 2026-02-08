# Staging DB Maintenance Runbook

## Owner
- Primary: Release manager/on-call maintainer

## Purpose
- Keep staging database size bounded and reset it safely when needed.

## Preconditions
- Render access to run one-off jobs for the staging service.
- `DATABASE_URL` configured in the staging service.

## Weekly Cleanup (Manual or Cron)
1. Open the staging service in Render.
2. Run a one-off job with:
   - `RETENTION_DAYS=7 npm run db:cleanup`
3. Confirm logs show deleted row counts for `sessions`, `oauth_states`, `audit_log`, `matches`, `tournaments`, and `stream_pool`.

## Full Reset + Reseed (When staging is bloated)
1. Open the staging service in Render.
2. Run a one-off job with:
   - `CONFIRM_STAGING_RESET=true RENDER_ENV=staging npm run db:reset:staging`
3. Run a second one-off job:
   - `npm run db:seed`
4. Confirm the app boots and `/api/health` is healthy.

## One-Off Job Checklist (Copy/Paste)
1. Render dashboard → `clubstream` project → `staging` → `clubstream-staging` service.
2. Run a one-off job:
   - Command: `npm run db:reset:staging`
   - Env vars:
     - `CONFIRM_STAGING_RESET=true`
     - `RENDER_ENV=staging`
3. Wait for log line: `[db:reset-staging] Done`
4. Run a second one-off job:
   - Command: `npm run db:seed`
5. Verify staging:
   - `/api/health` returns OK
   - App loads

## If Disk Space Is Still Exhausted
1. In Render, delete and recreate the staging Postgres instance.
2. Update the staging service `DATABASE_URL` if needed.
3. Run one-off jobs:
   - `npm run db:migrate:staging`
   - `npm run db:seed`

## Safety Notes
- The reset script refuses to run unless `CONFIRM_STAGING_RESET=true` and either `RENDER_ENV=staging` or the `DATABASE_URL` contains "staging".
- Do not use the reset script against production.
