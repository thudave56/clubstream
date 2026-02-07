# Deployment Rehearsal Runbook

## Owner
- Primary: Release manager/on-call maintainer

## Purpose
- Rehearse staging-to-production deployment and rollback flow.
- Capture evidence with workflow run URLs and outcome notes.

## Preconditions
- `CI` is green for the target SHA.
- `staging` and `production` environments are configured.
- A production DB backup/snapshot can be created on demand.

## Drill Steps
1. Choose target commit SHA and verify `release-gate` is successful.
2. Trigger or confirm staging deploy for the same SHA.
3. Execute smoke checks and verify:
   - `/`
   - `/admin`
   - `/api/health`
4. Trigger production deployment with:
   - `ref=<target-sha>`
   - `backup_checkpoint=<snapshot-id>`
5. Validate production smoke checks and Discord success notification.
6. Run rollback drill (safe simulation or actual rollback in a controlled window) and confirm recovery steps from `docs/runbooks/rollback.md`.

## Evidence Capture
- Use this command after the drill:
  - `npm run deploy:record-rehearsal`
- Required environment variables:
  - `REHEARSAL_CI_RUN_URL`
  - `REHEARSAL_STAGING_RUN_URL`
  - `REHEARSAL_OUTCOME`
- Optional environment variables:
  - `REHEARSAL_DATE` (default: UTC date)
  - `REHEARSAL_COMMIT` (default: `GITHUB_SHA`)
  - `REHEARSAL_PRODUCTION_RUN_URL`
  - `REHEARSAL_ROLLBACK_RUN_URL`
  - `REHEARSAL_NOTES`
  - `REHEARSAL_OUTPUT_PATH` (default: `docs/rehearsals/<date>.md`)

## Example
```powershell
$env:REHEARSAL_CI_RUN_URL = "https://github.com/<org>/<repo>/actions/runs/123"
$env:REHEARSAL_STAGING_RUN_URL = "https://github.com/<org>/<repo>/actions/runs/124"
$env:REHEARSAL_PRODUCTION_RUN_URL = "https://github.com/<org>/<repo>/actions/runs/125"
$env:REHEARSAL_ROLLBACK_RUN_URL = "https://github.com/<org>/<repo>/actions/runs/126"
$env:REHEARSAL_OUTCOME = "Pass"
$env:REHEARSAL_NOTES = "Rollback drill completed in 12 minutes."
npm run deploy:record-rehearsal
```
