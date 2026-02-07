# Deployment Runbook

## Owner
- Primary: Release manager/on-call maintainer

## Preconditions
- PR is merged and `CI` is green (`test`, `build`, `e2e`, `regression`, `release-gate`).
- Required GitHub environment secrets exist for target environment.
- Render service and database are healthy.
- Initial environment setup is completed per `docs/runbooks/platform-setup.md`.
- For production deploys, migration maintenance window (if needed) is communicated.

## Staging Deployment
1. Merge approved change into `main`.
2. Confirm `CI` workflow succeeds on merged SHA.
3. Confirm `Deploy Staging` workflow starts automatically.
4. Verify reusable deploy steps complete:
   - `deploy:validate-env`
   - migration command (`db:migrate:staging`)
   - Render trigger/poll
   - smoke checks
   - Discord notification

## Production Deployment
1. Confirm target SHA has successful `release-gate`.
2. Capture a database backup/snapshot identifier immediately before migration (for example, managed backup ID in Render Postgres).
3. Open `Deploy Production` workflow and run `workflow_dispatch`.
4. Enter:
   - `ref` (SHA or tag)
   - `backup_checkpoint` (the backup/snapshot identifier from step 2)
5. Approve production environment protection if prompted.
6. Verify reusable deploy steps complete:
   - `deploy:validate-env`
   - `deploy:verify-backup`
   - migration command (`db:migrate:prod`)
   - Render trigger/poll
   - smoke checks
   - Discord notification

## Verification Checklist
- `GET /api/health` returns healthy.
- Home and admin pages load.
- No new 5xx spikes in logs.
- Discord success message posted.
- Sentry project shows no new untriaged critical errors after deploy (if Sentry is configured).
- Scheduled uptime checks (`Uptime Check` workflow) are configured with `STAGING_APP_BASE_URL` and `PRODUCTION_APP_BASE_URL`.
- `Governance Check` workflow is green on latest run.

## Failure Path
- If migration fails, follow `docs/runbooks/migration-failure.md`.
- If app checks fail post-deploy, follow `docs/runbooks/rollback.md`.

## Game-Day Rehearsal
1. Use `Rehearsal Deploy` workflow for a full staging -> production -> staging rollback drill.
2. Provide:
   - `ref` (release candidate SHA)
   - `rollback_ref` (known-good SHA)
   - `backup_checkpoint` (captured before rehearsal production migration)
   - `ci_run_url` (link to successful release-gate run)
3. Download `rehearsal-evidence` artifact from the workflow and archive with release notes.
