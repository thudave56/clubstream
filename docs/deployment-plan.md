# Deployment & CI/CD Implementation Plan

## 1) Current state assessment

The project is a Next.js 14 application with PostgreSQL + Drizzle, with unit tests (Vitest), E2E tests (Playwright), linting, and a GitHub Actions CI workflow already in place.

What already exists:
- CI triggers on pull requests and on push to `main`.
- CI currently runs three jobs (`test`, `build`, `e2e`) and provisions PostgreSQL service containers for test and e2e jobs.
- App lifecycle scripts are available for `build`, `start`, `lint`, tests, database migrations, and seeding.

What is missing for automated deployment:
- No cloud deployment workflow (staging/production) in GitHub Actions.
- No IaC or deployment runbook per environment.
- No gated release flow (promote after all checks + branch/tag policy).
- No smoke-test verification after deploy.
- No rollback procedure encoded in CI.

---

## 2) Target deployment architecture (selected baseline)

Selected stack for fastest time-to-production:
- **App hosting:** Render Web Service (Dockerless Node build/start).
- **Database:** Render PostgreSQL (selected for initial rollout).
- **CI/CD orchestrator:** GitHub Actions.
- **Secrets:** GitHub Environments (`staging`, `production`) + Render secret env vars.
- **DNS/SSL:** Managed by Render custom domain + automatic TLS.

Why this baseline:
- Works cleanly with current Next.js + Node runtime scripts.
- Minimal operational overhead.
- Supports preview/staging + production promotion.
- Easy CLI/API integration from GitHub Actions.

Alternative (if priorities change later): Vercel + managed Postgres provider. The CI structure below still applies with different deploy commands.

### Decision log (updated via clarification answers)

- **Q1 (cloud platform):** Chosen platform is **Render** for initial rollout.
  - **Reasoning:** best overall balance of setup simplicity, predictable cost, and low ongoing maintenance for this codebase.
- **Q2 (production promotion):** Chosen release model is **manual production promotion** only.
  - **Reasoning:** simplest and safest operational control, lower risk of accidental deploys/cost spikes, and easiest ongoing maintenance/audit trail for a small team.
- **Q3 (staging source branch):** Chosen model is **staging deploys from every merge to `main`**.
  - **Reasoning:** lowest workflow complexity, lower ongoing maintenance burden, and keeps staging aligned with the next production candidate.
- **Q4 (migration maintenance mode):** Chosen policy is **allow short read-only maintenance windows** for production migrations.
  - **Reasoning:** simplest safe migration path early on, lower implementation/operational cost, and reduced maintenance complexity versus full zero-downtime orchestration.
- **Q5 (migration tooling strategy):** Chosen strategy is to **move away from `drizzle-kit push` and use one migration-file-based workflow across all environments**.
  - **Reasoning:** highest consistency across dev/staging/prod, lower drift risk, simpler operations, and better long-term maintenance/auditability.
- **Q6 (managed PostgreSQL provider):** Chosen provider is **Render Postgres** for initial rollout.
  - **Reasoning:** simplest integration on the selected platform, predictable early cost profile, and lowest ongoing maintenance overhead.
- **Q7 (PR preview environments):** Chosen policy is **no preview environments**; validation remains local + existing CI checks.
  - **Reasoning:** lowest cost and ongoing maintenance burden, with no additional environment lifecycle complexity.
- **Q8 (deployment notification channel):** Chosen channel is **Discord** via webhook notifications.
  - **Reasoning:** simple to implement, low cost, and low ongoing maintenance for team-visible deploy alerts.
- **Q9 (compliance constraints):** **No formal compliance requirements** currently (simple app, no PII processing).
  - **Reasoning:** keep controls lightweight to minimize operational overhead while retaining core CI/CD safety guardrails.
- **Q10 (infrastructure management approach):** Chosen approach is a **lighter initial setup** (manual platform configuration + runbook), with IaC deferred.
  - **Reasoning:** fastest delivery path with lowest upfront complexity/cost; introduce Terraform/Pulumi after platform choices stabilize.

---

## 3) Environment strategy

Create three environments with explicit config isolation:

1. **Local**
   - Developer machine and ephemeral test DB.
2. **Staging**
   - Auto-deploy from every merge to `main` after CI passes.
   - Mirrors production config shape.
3. **Production**
   - Deploy via manual workflow approval only (`workflow_dispatch`).

Key variables per environment:
- `DATABASE_URL`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NODE_ENV=production`
- `DEFAULT_ADMIN_PIN` (only if used for first-time bootstrap)

Guardrails:
- Never seed production in every deployment.
- Split one-time bootstrap tasks from routine deploys.
- Pin environment secrets to GitHub Environment scope.

---

## 4) CI pipeline updates (GitHub Actions)

### 4.1 Keep existing CI as quality gate
No change in intent: PRs and pushes must pass lint, unit, build, and e2e.

### 4.2 Add deployment workflows
Create two new workflows:

1. `.github/workflows/deploy-staging.yml`
   - Trigger: `workflow_run` on successful CI completion for `main` (merge-to-main driven staging deploys).
   - Steps:
     1. Checkout
     2. Setup Node
     3. Install dependencies
     4. Build app
     5. Run database migrations against staging DB
     6. Trigger Render deploy (API or deploy hook)
     7. Poll deployment status until healthy
     8. Run smoke test (`/`, `/admin`, health endpoint)

2. `.github/workflows/deploy-production.yml`
   - Trigger: manual `workflow_dispatch` only (no automatic tag trigger).
   - Use `environment: production` with required reviewers.
   - Steps same as staging but against production secrets.
   - Add post-deploy notification (Discord webhook).

### 4.3 Add reusable workflow/action for deployment
To avoid duplication:
- Create `.github/workflows/_deploy.yml` as `workflow_call` reusable workflow.
- Parameterize:
  - target environment name
  - base URL
  - DB URL secret key
  - Render service ID / deploy hook

### 4.4 Concurrency + safety
Add:
- `concurrency: deploy-${{ github.ref }}-${{ inputs.environment }}`
- Cancel older in-flight staging deploys.
- Keep production deployments serialized.

### 4.6 PR preview policy
- Do not create PR preview environments initially.
- Keep validation workflow as local testing + CI gates (unit/lint/build/e2e).

### 4.5 Required status checks in branch protection
Enforce before merge:
- `test`
- `build`
- `e2e`
- Optional: security scan workflow

---

## 5) Database migration strategy

Current repo uses `drizzle-kit push`, which is convenient but risky for production drift.

Recommended evolution:
1. Replace `drizzle-kit push` as the default path in all environments (dev/staging/prod).
2. Introduce generated SQL migration artifacts as the single deployment source of truth.
3. Add explicit scripts (for example `db:migrate:dev`, `db:migrate:staging`, `db:migrate:prod`) that all apply reviewed migration files.
4. Run migrations in CI deploy jobs before app rollout.
5. Fail deploy if migration fails; no app rollout on failure.
6. Optionally keep `db:push:local` as a non-default emergency/prototyping command only.

Rollback policy:
- Keep backward-compatible migrations where possible.
- Use expand/contract for destructive schema changes.
- Maintain DB backup snapshots before production migration.
- For now, production migrations may run in a brief read-only maintenance window (announced ahead of time).

---

## 6) Release management

### Branch model
- Feature branches -> PR -> merge to `main`.
- `main` auto-deploys to staging.
- Production deploy via manual promotion only.

### Versioning
- Semver tags (`v0.2.0`, `v0.2.1`).
- Annotated tag contains release notes.

### Change windows
- Define production deployment windows and rollback owner.
- Include a short, pre-announced read-only window for migrations when required.

---

## 7) Observability and operations

Minimum day-1 controls:
- Uptime checks for staging and production.
- Centralized logs (Render logs + optional third-party aggregator).
- Error tracking (Sentry for Next.js server/client).
- Alerting thresholds:
  - 5xx rate
  - elevated latency
  - failed deploys

Operational runbooks:
- Failed deployment triage
- Migration failure handling
- Emergency rollback
- Secret rotation

---

## 8) Security hardening for CI/CD

Given no formal compliance constraints and no PII processing, apply a lightweight baseline:
- Use GitHub OIDC for cloud auth where supported (prefer over long-lived tokens).
- Limit production deploy permissions to maintainers.
- Store secrets only in GitHub Environment scopes.
- Add secret scanning and dependency vulnerability scan.
- Restrict who can trigger production workflow.
- Keep deployment/audit logs and CI artifacts with practical retention (for example 30–90 days).

---

## 9) Step-by-step implementation plan (2-week outline)

### Phase 1 (Days 1-2): Foundations
- Confirm cloud provider and environment topology.
- Create staging/production services and databases (manual platform setup).
- Set environment variables in both cloud and GitHub Environments, and document the runbook steps.
- Add `/api/health` endpoint for smoke checks.

### Phase 2 (Days 3-5): CI/CD wiring
- Add reusable deployment workflow.
- Add staging deploy workflow tied to CI success.
- Add production deploy workflow with manual approval.
- Add smoke test script and deploy status polling.

### Phase 3 (Days 6-8): Migration safety + rollback
- Shift to explicit migration artifacts and migration-file applies for all environments.
- Add pre-deploy DB snapshot step (or managed backup checkpoint).
- Document and test rollback procedure in staging.

### Phase 4 (Days 9-10): Observability + hardening
- Add Sentry and uptime checks.
- Add release notifications (Discord webhook).
- Add branch protection requirements and environment approval policy.
- Final game-day deploy rehearsal: staging -> production drill.

---

## 10) Definition of done

Deployment system is complete when:
- Every merge to `main` deploys automatically to staging after CI passes.
- Production deploys require explicit approval and are traceable to a tag/commit.
- Migrations run automatically and safely during deploy.
- Smoke tests verify service availability post-deploy.
- Rollback procedure is documented and has been rehearsed.
- Monitoring and alerting are active.

---

## 11) Clarifying questions before implementation

1. Which cloud provider do you want as the primary target (Render, Fly.io, Railway, Vercel, AWS/GCP/Azure)?
2. Do you want **automatic production deploys** from tags, or **manual promotion only**?
3. Should staging deploy from every merge to `main`, or from a dedicated `develop` branch?
4. Is brief read-only maintenance mode acceptable during production migrations?
5. Confirmed: move now from `drizzle-kit push` to migration-file-based applies in all environments?
6. Confirmed: managed PostgreSQL provider is Render Postgres for initial rollout.
7. Confirmed: no preview environments for pull requests (local testing + CI only).
8. Confirmed: deployment alerts will use Discord webhook notifications.
9. Confirmed: no formal compliance constraints currently; use lightweight CI/CD security baseline.
10. Confirmed: lighter initial setup now (manual config + runbook); defer IaC to a later hardening phase.
