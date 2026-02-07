# Secrets Rotation Runbook

## Owner
- Primary: Repository admin/platform owner

## Scope
- GitHub environment secrets (`staging`, `production`)
- Render service environment variables
- External provider credentials (Google OAuth, Render API, Discord webhook)
- Optional observability credentials (Sentry DSN/auth token)
- Repository governance audit token (`GOVERNANCE_AUDIT_TOKEN`)

## Rotation Triggers
- Scheduled rotation window.
- Suspected secret exposure.
- Team member offboarding.

## Rotation Procedure
1. Generate new credential in source provider.
2. Update `staging` secrets in GitHub and Render.
3. Run staging deploy and verify smoke checks.
4. Update `production` secrets in GitHub and Render.
5. Run production deploy during approved window.
6. Verify app health and deployment notifications.
7. Revoke old credential in provider.

## Required Secret Set
- `DATABASE_URL`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `RENDER_API_KEY`
- `RENDER_SERVICE_ID`
- `DISCORD_WEBHOOK_URL`
- `GOVERNANCE_AUDIT_TOKEN` (repository secret)

## Validation
1. Run deployment workflow (`staging` then `production`).
2. Confirm `deploy:validate-env` step passes.
3. Confirm smoke checks and Discord messages succeed.

## Emergency Rotation
1. Immediately revoke compromised credential.
2. Rotate affected secret in both environments.
3. Trigger redeploy to ensure new credential is active.
4. Review recent audit logs and workflow history.
