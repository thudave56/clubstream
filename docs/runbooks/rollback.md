# Rollback Runbook

## Owner
- Primary: On-call maintainer
- Secondary: DB owner (if data issues are involved)

## Trigger Conditions
- Smoke tests fail after deployment.
- Sustained elevated 5xx or severe latency.
- Critical user flow regression in production.

## Preconditions
- Identify last known-good SHA or Render deploy.
- Announce rollback start in team channel.
- Pause additional deploys until rollback is complete.

## Application Rollback
1. Open Render service deploy history.
2. Identify last known-good deploy.
3. Roll back/redeploy that version.
4. Monitor until service reports healthy.

## Post-Rollback Verification
1. Confirm `GET /api/health` is healthy.
2. Confirm key pages (`/`, `/admin`) load successfully.
3. Confirm error rate and latency return to baseline.
4. Post rollback status in Discord/team channel.

## If Schema Change Is Involved
- Prefer forward-fix migration when possible.
- Use snapshot restore only for severe data integrity incidents and explicit approval.
- Document blast radius and affected window before restore.

## Evidence to Record
- Incident timestamp.
- Failed deploy SHA and rollback SHA/deploy ID.
- Root cause summary.
- Follow-up action items.
