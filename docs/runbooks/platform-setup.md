# Platform Setup Runbook

## Owner
- Primary: Platform owner/repository admin

## Purpose
- Manual setup checklist for initial `staging` and `production` deployment foundations on Render + GitHub.

## Preconditions
- Access to Render dashboard with permission to create services/databases.
- GitHub repository admin access (environments, secrets, branch protection).
- Discord webhook endpoint ready for deploy notifications.

## Fast Path: Render Blueprint
1. Ensure `render.yaml` exists on the target branch (recommended: `main`).
2. In Render Dashboard, create a new Blueprint from the GitHub repo.
3. Apply the Blueprint and provide any prompted secrets (notably `ENCRYPTION_KEY`).
4. For production, set a secure `DEFAULT_ADMIN_PIN` in the `clubstream-production` service environment.
5. Run `npm run db:seed` as a Render one-off job.

## Staging Setup
1. Create Render Web Service for staging from repository.
   - Runtime: `Node`
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start`
   - Health check path: `/api/health`
   - Auto-deploy: Disabled (if using GitHub Actions to trigger deploys)
   - Node version: `20` (set `NODE_VERSION=20` in Render if needed)
2. Create Render Postgres instance for staging.
3. Set Render staging environment variables:
   - `DATABASE_URL` (use the Render Postgres connection string)
   - `APP_BASE_URL`
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN` (optional but recommended)
   - `SENTRY_TRACES_SAMPLE_RATE` (optional, default `0`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NODE_ENV=production`
4. Capture staging service ID for CI (`RENDER_SERVICE_ID`).
5. In GitHub, create `staging` environment.
6. Add `staging` environment secrets:
   - `DATABASE_URL`
   - `APP_BASE_URL`
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID`
   - `DISCORD_WEBHOOK_URL`
7. Add `STAGING_APP_BASE_URL` environment variable in GitHub Environment variables.

## Production Setup
1. Create Render Web Service for production.
   - Runtime: `Node`
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start`
   - Health check path: `/api/health`
   - Auto-deploy: Disabled (if using GitHub Actions to trigger deploys)
   - Node version: `20` (set `NODE_VERSION=20` in Render if needed)
2. Create Render Postgres instance for production.
3. Set Render production environment variables:
   - `DATABASE_URL` (use the Render Postgres connection string)
   - `APP_BASE_URL`
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN` (optional but recommended)
   - `SENTRY_TRACES_SAMPLE_RATE` (optional, default `0`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NODE_ENV=production`
4. Capture production service ID for CI (`RENDER_SERVICE_ID`).
5. In GitHub, create `production` environment.
6. Add `production` environment secrets:
   - `DATABASE_URL`
   - `APP_BASE_URL`
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID`
   - `DISCORD_WEBHOOK_URL`
7. Add `PRODUCTION_APP_BASE_URL` environment variable in GitHub Environment variables.
8. Enable required reviewers on `production` environment.

## Branch Protection Baseline
1. Protect `main` branch.
2. Require passing checks:
   - `test`
   - `build`
   - `e2e`
   - `regression`
   - `release-gate`
3. Restrict direct pushes to `main`.
4. Add repository secret `GOVERNANCE_AUDIT_TOKEN` (PAT with repo admin read/write scope) for scheduled governance checks.
5. Run `Governance Check` workflow at least once and verify success.

## Validation
1. Trigger a staging deployment path by merging to `main`.
2. Confirm `Deploy Staging` runs and passes smoke tests.
3. Trigger `Deploy Production` manually with a SHA that has successful `release-gate`.
4. Confirm production approval prompt appears and deployment succeeds.

## Evidence to Record
- Render service IDs and database instance identifiers.
- Screenshot/export of GitHub environment secret keys (names only, no values).
- Workflow run IDs for first successful staging and production deployments.
