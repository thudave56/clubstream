# Product Requirements Document (PRD)

## Feature
Deployment and CI/CD Automation for Clubstream (Render + GitHub Actions)

## Document Metadata
- Status: Approved for implementation planning
- Version: 1.0
- Date: 2026-02-07
- Source plan: `docs/deployment-plan.md`
- Repository baseline branch at authoring: `main`
- Planning branch: `feature/deployment-prd`

## 1. Problem Statement
Clubstream has a solid CI pipeline for tests/build/e2e but does not yet have an end-to-end automated deployment flow for staging and production. This creates manual release risk, unclear rollback execution, and inconsistent post-deploy verification.

## 2. Product Objective
Deliver a safe, repeatable, low-maintenance deployment system that:
- Automatically deploys staging after successful CI on `main`.
- Requires explicit human approval for production deployment.
- Applies database migrations safely as part of deployment.
- Runs smoke checks and sends deployment notifications.
- Provides clear operational runbooks for failure handling and rollback.

## 3. Context and Decisions (Fixed Inputs)
This PRD codifies previously confirmed decisions from `docs/deployment-plan.md`:
- Platform: Render (app + managed Postgres).
- Production model: Manual promotion only.
- Staging source: Every merge to `main`.
- Migration policy: Migration-file-based workflow (no default `drizzle-kit push` in deployment paths).
- Maintenance window: Short read-only window allowed for production migrations.
- Preview environments: Not in scope.
- Alerts: Discord webhook.
- Compliance: No formal compliance requirement currently; apply lightweight CI/CD hardening.
- Infra management: Manual platform setup + runbook first; Infrastructure-as-Code deferred.

## 4. Goals and Non-Goals

### 4.1 Goals
- G1: Staging deploy automation tied to CI success.
- G2: Production deploy gated by manual approval and GitHub environment protections.
- G3: Deterministic schema migration flow using migration artifacts.
- G4: Automated post-deploy verification and alerting.
- G5: Operational clarity through runbooks and deploy audit trail.
- G6: Explicit quality gates for unit, end-to-end, and regression testing before release promotion.

### 4.2 Non-Goals
- NG1: Terraform/Pulumi implementation in this phase.
- NG2: Pull request preview environments.
- NG3: Full blue/green or canary release infrastructure.
- NG4: Advanced compliance controls beyond current needs.

## 5. Success Metrics
- M1: 100 percent of successful merges to `main` trigger staging deployment within 10 minutes after CI completion.
- M2: 100 percent of production deployments are initiated by manual dispatch and recorded in GitHub Actions logs.
- M3: 100 percent of deployments execute smoke checks; failed smoke checks produce failed workflow and Discord alert.
- M4: 0 production deployments using `drizzle-kit push` in deployment workflows.
- M5: Mean time to rollback (MTTR) under 20 minutes during game-day rehearsal.
- M6: 100 percent of production deployments are preceded by passing unit, E2E, and regression gates on the same commit SHA.
- M7: Regression suite pass rate >= 95 percent excluding quarantined flaky tests.

## 6. Users and Stakeholders
- Primary users:
  - Engineers shipping features.
  - Maintainers approving production deployments.
- Stakeholders:
  - Product owner requiring predictable release cadence.
  - Operations owner requiring low-overhead observability and rollback.

## 7. Scope

### 7.1 In Scope
- GitHub Actions deployment workflows (`staging`, `production`, reusable core).
- Migration execution in deploy workflows using migration files.
- Deploy status polling against Render.
- Smoke tests against deployed app endpoints.
- Discord webhook notifications for deploy status.
- CI quality-gate enforcement for unit, E2E, and regression suites.
- Documentation: deployment runbook and rollback runbook.
- Branch protection and environment guardrail configuration instructions.

### 7.2 Out of Scope
- IaC automation for Render resources.
- Dynamic ephemeral environments.
- Multi-region failover.
- Automated rollback orchestration at platform layer.

## 8. Baseline Technical State (Current Repository)
- Framework: Next.js 14 (`next build`, `next start`).
- Database: PostgreSQL with Drizzle.
- Current migration command: `db:migrate` mapped to `drizzle-kit push` (must evolve).
- Existing CI workflow: `.github/workflows/ci.yml` with jobs:
  - `test` (includes DB migration + seed for tests)
  - `build` (lint + build)
  - `e2e` (includes DB migration + seed + Playwright)
- Existing health endpoint: `app/api/health/route.ts` (usable for smoke checks).

## 9. Functional Requirements

### FR-001 Staging Deployment Trigger
- Description: Deploy staging automatically after successful CI workflow completion for `main`.
- Trigger mechanism: `workflow_run` on CI success for branch `main`.
- Acceptance criteria:
  - Deploy workflow does not run for failed CI runs.
  - Deploy workflow references the commit SHA from successful CI run.
  - Previous in-flight staging deploys are canceled if superseded.

### FR-002 Production Deployment Trigger
- Description: Deploy production only by manual dispatch.
- Trigger mechanism: `workflow_dispatch`.
- Guardrails:
  - GitHub Environment `production` must require reviewers.
  - Only maintainers can trigger.
- Acceptance criteria:
  - No automatic production deployment path exists.
  - Workflow records actor and SHA.

### FR-003 Reusable Deployment Workflow
- Description: Centralize deployment logic in one reusable workflow.
- File: `.github/workflows/_deploy.yml`.
- Inputs:
  - `environment` (`staging` or `production`)
  - `app_base_url`
  - `render_service_id` or `render_deploy_hook_url`
  - `run_discord_notify` (boolean)
- Secrets:
  - `DATABASE_URL`
  - `RENDER_API_KEY` or hook secret
  - `DISCORD_WEBHOOK_URL`
  - app runtime secrets
- Acceptance criteria:
  - Staging and production wrapper workflows use only this reusable workflow.
  - No duplication of migration/poll/smoke logic across environment workflows.

### FR-004 Migration Execution Contract
- Description: Deployment must apply migration files before app verification.
- Requirements:
  - Migration command uses migration artifacts, not `drizzle-kit push`.
  - Deployment aborts if migration step fails.
  - Production migration can be run in brief read-only window.
- Acceptance criteria:
  - Deployment fails fast on migration error.
  - Migration artifact location is versioned in repo and reviewed in PRs.

### FR-005 Render Deployment Polling
- Description: After deploy trigger, poll Render API until deploy reaches terminal state.
- Terminal states:
  - Success: continue to smoke tests.
  - Failure/timeout: fail workflow and notify.
- Acceptance criteria:
  - Poll timeout and interval are configurable.
  - Logs include Render deploy ID and final status.

### FR-006 Smoke Test Verification
- Description: Run smoke tests after deploy success.
- Minimum endpoints:
  - `/`
  - `/admin`
  - `/api/health`
- Acceptance criteria:
  - Non-2xx response fails deployment workflow.
  - Health response must indicate service health (`ok: true` or equivalent).

### FR-007 Deployment Notifications
- Description: Send Discord message for deploy start/success/failure.
- Minimum payload:
  - environment
  - commit SHA
  - actor
  - workflow run URL
  - final status
- Acceptance criteria:
  - Production notifications always enabled.
  - Staging notifications enabled at least for failure.

### FR-008 Release Traceability
- Description: Production deploy must be traceable to commit and optional semver tag.
- Acceptance criteria:
  - Workflow logs include deployed SHA.
  - Runbook documents mapping of release tag to workflow run.

### FR-009 Safety and Concurrency
- Description: Prevent overlapping unsafe deployments.
- Rules:
  - Staging: cancel prior in-progress runs for same branch.
  - Production: serialized, no cancel-in-progress for active release.
- Acceptance criteria:
  - Concurrency keys enforce above behavior.

### FR-010 Operations Runbooks
- Description: Provide operational documentation for setup and incident handling.
- Required runbooks:
  - Manual platform setup checklist (staging and production).
  - Deployment execution runbook.
  - Migration failure runbook.
  - Rollback runbook.
  - Secret rotation runbook.
- Acceptance criteria:
  - Runbooks are present in `docs/runbooks/`.
  - Each runbook includes owner, preconditions, and verification steps.

### FR-011 Unit and E2E Release Gates
- Description: Unit and E2E tests must be mandatory release gates for both staging and production deploy eligibility.
- Requirements:
  - Unit tests pass in CI for the target SHA.
  - E2E tests pass in CI for the target SHA.
  - Failed unit or E2E results block staging deploy trigger and production manual promotion.
- Acceptance criteria:
  - Branch protection requires passing unit and E2E checks.
  - Deploy workflows validate required checks for selected SHA before deployment actions.

### FR-012 Regression Test Requirement
- Description: A regression suite must validate critical user flows and deployment-sensitive behaviors.
- Minimum coverage areas:
  - Authentication and admin access path.
  - Match lifecycle and stream status APIs.
  - Database migration compatibility checks on representative data.
- Execution policy:
  - Run on merge to `main` (or immediately post-merge on same SHA).
  - Run before production promotion.
- Acceptance criteria:
  - Regression suite failure blocks production deployment.
  - Regression results are retained as CI artifacts for at least 30 days.

## 10. Non-Functional Requirements

### NFR-001 Reliability
- Staging deployment success target: >= 95 percent within first 30 days.
- Production deployment success target: >= 99 percent with manual approval.

### NFR-002 Performance
- Staging deploy end-to-end (trigger to smoke pass) should complete in <= 15 minutes under normal conditions.

### NFR-003 Security
- Secrets stored only in GitHub Environment and Render service settings.
- No secrets in repository, workflow logs, or plaintext docs.
- Principle of least privilege for production deploy permissions.

### NFR-004 Auditability
- Workflow logs retained for at least 30 days.
- Artifact retention for Playwright and deploy logs for at least 30 days.

### NFR-005 Maintainability
- Shared deployment logic centralized and parameterized.
- Scripts executable locally for dry-run validation where practical.

### NFR-006 Test Signal Quality
- Flaky tests must be tracked and quarantined with owner and remediation date.
- Non-quarantined regression suite should maintain >= 95 percent pass rate over rolling 14 days.
- Test failures must be actionable with clear logs/artifacts (unit, E2E, regression).

## 11. Architecture and Workflow Design

### 11.1 High-Level Flow
1. Engineer merges PR into `main`.
2. CI workflow (`.github/workflows/ci.yml`) completes successfully.
3. Staging deploy workflow triggers via `workflow_run`.
4. Reusable deploy workflow applies migrations, triggers Render deployment, polls status, and runs smoke tests.
5. Discord notification is posted with outcome.
6. For production, maintainer manually dispatches production workflow, then same reusable path executes under production environment protections.

### 11.2 Workflow Files to Implement
- `.github/workflows/_deploy.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

### 11.3 Script Files to Implement
- `scripts/deploy/render-trigger.mjs`
- `scripts/deploy/render-poll.mjs`
- `scripts/deploy/smoke-test.mjs`
- `scripts/deploy/notify-discord.mjs`
- `scripts/deploy/validate-env.mjs`

### 11.4 Package Script Contract (Target)
- `deploy:validate-env`
- `deploy:trigger`
- `deploy:poll`
- `deploy:smoke`
- `deploy:notify`
- `db:migrate:ci`
- `db:migrate:staging`
- `db:migrate:prod`

### 11.5 Environment and Secret Contract
Required in both `staging` and `production` GitHub Environments:
- `DATABASE_URL`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RENDER_API_KEY` (if API path used)
- `RENDER_SERVICE_ID` (if API path used)
- `RENDER_DEPLOY_HOOK_URL` (if hook path used)
- `DISCORD_WEBHOOK_URL`

Required in Render service environment:
- Runtime app vars equivalent to above app-level secrets.
- `NODE_ENV=production`
- Optional one-time `DEFAULT_ADMIN_PIN` (never part of regular deployment flow).

## 12. Migration Strategy Detail

### 12.1 Target Model
- Use checked-in migration artifacts as source of truth.
- Deployment runs migration apply command against target DB before deploy verification.

### 12.2 Transition Plan
1. Introduce migration artifact generation command and directory policy.
2. Update team workflow to generate migration files in PRs.
3. Replace `db:migrate` usage in CI/CD with environment-specific migration apply scripts.
4. Retain `db:push:local` only as optional local prototyping command if needed.

### 12.3 Backward-Compatible Change Pattern
- Prefer expand/contract:
  - Expand schema (additive changes).
  - Deploy app compatible with both old and new schema.
  - Backfill data.
  - Contract old fields in later release.

## 13. Rollback Strategy
- Application rollback:
  - Trigger Render rollback/redeploy to previous known-good version.
- Database rollback:
  - Favor forward-fix.
  - Use backup snapshot restore only for severe incidents with explicit approval.
- Incident criteria:
  - Repeated 5xx post-deploy.
  - Critical user-path failure in smoke checks.
  - Data integrity risk from migration.

## 14. Detailed Implementation Plan (Execution-Ready)

### Phase 1: Deployment Foundation
- Deliverables:
  - Create GitHub environments `staging` and `production` with scoped secrets.
  - Configure production required reviewers.
  - Verify Render service/database existence and document manual setup in runbook.
- Exit criteria:
  - Environment secrets validated via `deploy:validate-env`.
  - Runbook checklist completed.

### Phase 2: Reusable Deployment Workflow
- Deliverables:
  - Implement `.github/workflows/_deploy.yml`.
  - Add deploy helper scripts under `scripts/deploy/`.
  - Implement deploy status polling and timeout behavior.
- Exit criteria:
  - Reusable workflow can run from manual test dispatch in staging context.

### Phase 3: Environment-Specific Wrappers
- Deliverables:
  - Implement `.github/workflows/deploy-staging.yml` with `workflow_run` trigger.
  - Implement `.github/workflows/deploy-production.yml` with `workflow_dispatch`.
  - Add concurrency policies and permissions constraints.
- Exit criteria:
  - Staging auto-deploys from successful CI on `main`.
  - Production requires reviewer approval and manual dispatch.

### Phase 4: Migration Safety Conversion
- Deliverables:
  - Add migration-file-based scripts and pipeline usage.
  - Remove deployment dependency on `drizzle-kit push`.
  - Document read-only maintenance window process.
- Exit criteria:
  - Deployment logs confirm migration artifact apply path.

### Phase 5: Smoke, Notify, and Hardening
- Deliverables:
  - Smoke tests for `/`, `/admin`, `/api/health`.
  - Discord notifications for deploy lifecycle.
  - Add dependency/secret scan workflow if absent.
- Exit criteria:
  - Failed smoke check fails workflow and posts alert.

### Phase 6: Runbooks and Rehearsal
- Deliverables:
  - Publish runbooks in `docs/runbooks/`.
  - Execute staging-to-production rehearsal and rollback simulation.
- Exit criteria:
  - Rehearsal evidence captured with run IDs and outcomes.

## 15. Programmatic Backlog (Machine-Readable)
```yaml
epic: deploy-cicd-render
tasks:
  - id: DEPLOY-001
    title: Add reusable deployment workflow
    files:
      - .github/workflows/_deploy.yml
    depends_on: []
    acceptance:
      - accepts environment and base URL inputs
      - runs migrate, deploy, poll, smoke, notify steps

  - id: DEPLOY-002
    title: Add staging deploy wrapper
    files:
      - .github/workflows/deploy-staging.yml
    depends_on: [DEPLOY-001]
    acceptance:
      - triggers on successful CI workflow_run for main
      - cancels older in-flight staging runs

  - id: DEPLOY-003
    title: Add production deploy wrapper
    files:
      - .github/workflows/deploy-production.yml
    depends_on: [DEPLOY-001]
    acceptance:
      - manual workflow_dispatch only
      - uses production environment approvals

  - id: DEPLOY-004
    title: Implement Render trigger and polling scripts
    files:
      - scripts/deploy/render-trigger.mjs
      - scripts/deploy/render-poll.mjs
    depends_on: []
    acceptance:
      - returns non-zero on timeout or failed deploy status
      - logs deploy id and status transitions

  - id: DEPLOY-005
    title: Implement smoke test script
    files:
      - scripts/deploy/smoke-test.mjs
    depends_on: []
    acceptance:
      - checks /, /admin, /api/health
      - fails on non-2xx or unhealthy health payload

  - id: DEPLOY-006
    title: Implement Discord notify script
    files:
      - scripts/deploy/notify-discord.mjs
    depends_on: []
    acceptance:
      - posts start/success/failure message with run metadata

  - id: DEPLOY-007
    title: Move to migration-file deployment path
    files:
      - package.json
      - drizzle.config.ts
      - src/db/migrations/*
    depends_on: []
    acceptance:
      - deploy workflows do not call drizzle-kit push
      - migration artifacts are reviewed in PRs

  - id: DEPLOY-008
    title: Add runbooks
    files:
      - docs/runbooks/deploy.md
      - docs/runbooks/rollback.md
      - docs/runbooks/migration-failure.md
      - docs/runbooks/secrets-rotation.md
    depends_on: [DEPLOY-001, DEPLOY-002, DEPLOY-003]
    acceptance:
      - each runbook has preconditions, steps, and verification

  - id: DEPLOY-009
    title: Enforce unit, E2E, and regression release gates
    files:
      - .github/workflows/ci.yml
      - .github/workflows/deploy-staging.yml
      - .github/workflows/deploy-production.yml
      - package.json
    depends_on: [DEPLOY-002, DEPLOY-003]
    acceptance:
      - unit and E2E checks are required in branch protection
      - regression suite runs on main and before production promotion
      - deployment is blocked when any required suite fails
```

## 16. Test Strategy
- Unit-level:
  - Validate deploy helper scripts with mocked HTTP responses.
  - Validate workflow helper utilities and environment validation logic.
- E2E-level:
  - Keep Playwright critical-path suite as merge gate.
  - Verify critical pages and API-backed flows in staging-like CI environment.
- Regression-level:
  - Add a regression suite focused on historically fragile and high-impact flows.
  - Require regression pass on `main` and before production promotion.
  - Publish regression artifacts and summary in workflow outputs.
- Workflow-level:
  - Use staging environment dry-runs to verify trigger, migration, deploy, poll, smoke, and notify sequence.
- Release-level:
  - Run one game-day simulation:
    - deploy success
    - induced smoke failure
    - rollback execution

## 17. Risks and Mitigations
- Risk: Migration failure in production.
  - Mitigation: pre-announced maintenance window, backup snapshot, fail-fast workflow, rollback runbook.
- Risk: Render API rate or timeout issues.
  - Mitigation: exponential backoff and explicit timeout with clear operator message.
- Risk: Secret misconfiguration.
  - Mitigation: preflight `deploy:validate-env` and environment-scoped secret checklist.
- Risk: Drift between staging and production config.
  - Mitigation: shared reusable workflow and identical secret key contract.

## 18. Dependencies
- Render service(s) and database(s) provisioned manually.
- GitHub repository admin privileges to configure:
  - environments
  - required reviewers
  - branch protection rules
- Discord webhook endpoint.

## 19. Definition of Done
The feature is done when all conditions are met:
- Staging deployment auto-runs from successful `main` CI and completes smoke checks.
- Production deployment requires manual dispatch and environment approval.
- Migration-file-based deploy path is active and documented.
- Smoke checks and Discord notifications are active.
- Unit, E2E, and regression suites are mandatory gates and pass for production release SHA.
- Rollback runbook exists and has been rehearsal-validated.
- Branch protection rules enforce CI quality gates.

## 20. Implementation Start Criteria
Implementation can begin immediately when:
- Branch for implementation is created from this PRD branch or merged PRD baseline.
- GitHub environment secrets are populated.
- Render identifiers and Discord webhook are available.

## 21. CI Checkpoint Policy
- Deployment, migration, or CI workflow changes must be pushed and validated in CI before unrelated feature work continues.
- High-risk files (`.github/workflows/*`, `drizzle/*`, `drizzle/meta/*`, migration/test/deploy scripts, and release-gate scripts in `package.json`) should be batched in small slices and validated in CI after each slice.
- Feature work may continue only after `test`, `build`, `e2e`, `regression`, and `release-gate` are green for the branch SHA.
- Production promotion eligibility requires a green `release-gate` check on the exact target SHA.
