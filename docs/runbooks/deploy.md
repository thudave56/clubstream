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
2. Open `Deploy Production` workflow and run `workflow_dispatch`.
3. Enter `ref` (SHA or tag) and start run.
4. Approve production environment protection if prompted.
5. Verify reusable deploy steps complete:
   - `deploy:validate-env`
   - migration command (`db:migrate:prod`)
   - Render trigger/poll
   - smoke checks
   - Discord notification

## Verification Checklist
- `GET /api/health` returns healthy.
- Home and admin pages load.
- No new 5xx spikes in logs.
- Discord success message posted.

## Failure Path
- If migration fails, follow `docs/runbooks/migration-failure.md`.
- If app checks fail post-deploy, follow `docs/runbooks/rollback.md`.
