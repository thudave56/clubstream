# Migration Failure Runbook

## Owner
- Primary: DB owner/on-call maintainer

## Trigger
- Any deploy workflow fails during migration step (`db:migrate:*`).

## Immediate Actions
1. Stop further deploy attempts for the same environment.
2. Capture failing workflow URL and error output.
3. Announce migration incident to team channel.

## Triage Checklist
1. Confirm target database and environment match intended deploy.
2. Identify failing migration tag from logs/journal.
3. Validate current migration state:
   - confirm `drizzle.__drizzle_migrations` entries
   - confirm target schema objects and constraints
4. Determine class of failure:
   - idempotency conflict
   - permission/connection issue
   - data/state incompatibility

## Recovery Paths

### Path A: Non-destructive Fix (Preferred)
1. Patch migration or add follow-up migration to resolve conflict.
2. Validate on staging with fresh and existing-state DB.
3. Re-run deploy for target SHA (or forward-fix SHA).

### Path B: Production Emergency
1. Keep app in read-only maintenance mode if needed.
2. Restore from managed snapshot only with explicit approval.
3. Redeploy last known-good app build.

## Exit Criteria
- Migration step succeeds in workflow.
- App smoke checks pass.
- Incident summary documented.

## Preventive Follow-Up
- Add/adjust regression migration checks for this failure pattern.
- Ensure migration SQL uses safe guards (`IF NOT EXISTS`, expand/contract where needed).
