# Roadmap Plan with Technical Requirements

## Document metadata
- Branch: feature/roadmap-planning
- Date: 2026-02-07
- Scope: Product enhancements and UI/UX improvements for Clubstream

## 1. Current baseline (implemented)
- Match creation flow with team selection, opponent, tournament, court, scheduled start.
- YouTube OAuth connect and disconnect in admin dashboard.
- Stream pool initialization and status in admin dashboard.
- Match detail page with Larix launcher, YouTube metadata overrides, and quick links.
- Live scoring UI and overlay UI with polling-based updates.
- Audit logging for admin actions.
- Unit tests (Vitest) and E2E tests (Playwright) wired in CI.

## 2. Known gaps and TODOs
- Replace polling with SSE or WebSockets in scoring and overlay clients.
- Fix E2E flakiness in OAuth simulation and rate limiting tests.
- Add unit tests for match creation service functions that touch YouTube APIs.
- Improve parent-facing guidance and clarity in the match flow.
- Improve admin operational guidance and recovery steps.
- Align README with current feature reality.

## 3. Goals
- Reduce support burden for parents starting streams.
- Make admin operations predictable and self-service.
- Improve real-time scoring responsiveness.
- Stabilize CI signal and regression coverage.
- Deliver consistent, accessible UI across major flows.

## 4. Product requirements

### 4.1 Functional requirements
- FR-001: Parent flow must clearly indicate next actions after match creation.
- FR-002: Match detail page must provide shareable links for match, scoring, and overlay.
- FR-003: Match list must clearly communicate status and available actions.
- FR-004: Admin dashboard must surface a start-of-day readiness checklist.
- FR-005: Admin must be able to identify and recover stuck stream pool records.
- FR-006: Audit log must support basic filtering and detail visibility.
- FR-007: Scoring and overlay must update within 1-2 seconds under normal conditions.
- FR-008: Scoring and overlay must gracefully fall back to polling if realtime channel fails.
- FR-009: CI must gate releases on unit, E2E, and regression suites.

### 4.2 Non-functional requirements
- NFR-001: Performance: realtime updates within 1-2 seconds on stable network.
- NFR-002: Reliability: SSE channel reconnects automatically on transient failure.
- NFR-003: Accessibility: primary UI actions are keyboard accessible and have visible focus.
- NFR-004: Maintainability: realtime mechanism is centralized and reusable across clients.
- NFR-005: Test quality: E2E tests should pass across 10 consecutive CI runs.

## 5. Technical specifications

### 5.1 Realtime architecture
- Use Server-Sent Events for score updates.
- Endpoint: `GET /api/matches/:id/score/stream`.
- Event payload: JSON with `matchId`, `setNumber`, `homeScore`, `awayScore`, `updatedAt`.
- Client behavior:
  - Prefer SSE if supported.
  - On error, fall back to polling every 5 seconds.
  - Display a connection indicator (Connected, Reconnecting, Polling).

### 5.2 Scoring and overlay clients
- Scoring client should subscribe to SSE and update scoreboard state immediately.
- Overlay client should subscribe to SSE and stop updates after match ends.
- When match ends, clients should show a final state and stop requesting updates.

### 5.3 Admin readiness checklist
- Section in admin dashboard that shows:
  - OAuth status (connected or not).
  - Stream pool counts (available, reserved, in use, stuck).
  - Match creation PIN status.
- Each item should have a short action or link to resolve issues.

### 5.4 Stream pool recovery
- Add a tool to mark a stream as available or disabled.
- Log the action in audit log with `stream_pool_recovered` or `stream_pool_disabled`.

### 5.5 Audit log usability
- Add filters by action type and a simple text filter on detail.
- Show timestamps in local time with clear formatting.
- Provide a copy-to-clipboard button for entry detail.

### 5.6 Testing requirements
- Unit tests:
  - SSE server handler emits correct payloads.
  - Client fallback logic toggles to polling on SSE failure.
  - Stream pool recovery logic validates transitions.
- E2E tests:
  - Admin login, match creation, scoring update, overlay update.
  - OAuth connect simulation is stable and not timing dependent.
- Regression tests:
  - Create match -> open Larix -> scoring update -> overlay reflects score.
  - OAuth denied path and recovery instructions are visible.

### 5.7 Documentation requirements
- README updated to remove outdated "coming" items.
- Parent quick-start guidance embedded in homepage or match creation success panel.
- Admin setup instructions in `docs/runbooks/` for OAuth and stream pool initialization.

## 6. Roadmap (phased)

### Phase 0: Repo hygiene and reliability
Deliverables:
- Merge or rebase `main` into long-lived branches before further work.
- Align README with current product state and remove outdated "coming" notes.
- Confirm test suites and fix obvious flake causes.
Acceptance criteria:
- No branch regression when merged to main.
- README reflects actual features.
- CI passes without intermittent failures on main.

### Phase 1: Parent-facing UX improvements
Deliverables:
- Add a clear next-step checklist after match creation.
- Add a share panel on match detail (match link, scoring link, overlay link).
- Add clearer status labels and microcopy for match states.
Acceptance criteria:
- Parent can create match and reach Larix and scoring without admin help.
- Match status and next actions are obvious on the home list.

### Phase 2: Admin UX and safety improvements
Deliverables:
- Admin start-of-day checklist (OAuth, stream pool status, PIN requirement).
- Stream pool recovery guidance and a reset tool for stuck records.
- Audit log filters and copy-to-clipboard for entries.
Acceptance criteria:
- Admin can identify and resolve stream pool issues in dashboard.
- Audit log usable for basic incident review.

### Phase 3: Real-time scoring and overlay
Deliverables:
- SSE endpoint for scores and overlay.
- Fallback to polling when SSE fails.
- Connection status indicator in scoring and overlay UI.
Acceptance criteria:
- Overlay updates within 1-2 seconds under normal conditions.
- Clients degrade gracefully if SSE is unavailable.

### Phase 4: Testing and regression hardening
Deliverables:
- Fix Playwright OAuth simulation timing and rate limit test stability.
- Add unit tests for match creation and YouTube API flows with mocks.
- Add regression suite for create match -> open Larix -> update score -> overlay update.
Acceptance criteria:
- E2E suite is stable across 10 consecutive CI runs.
- Regression suite is required and green before production promotion.

### Phase 5: UI cohesion and accessibility
Deliverables:
- Normalize typography and spacing across home, match, and admin pages.
- Ensure contrast compliance for status badges and buttons.
- Add keyboard focus states for primary actions.
Acceptance criteria:
- Pages meet WCAG AA color contrast for primary UI elements.
- Keyboard navigation works on all primary flows.

### Phase 6: Documentation and onboarding
Deliverables:
- Parent quick-start guide embedded in the homepage or match creation success panel.
- Admin setup guide with OAuth and stream pool steps.
Acceptance criteria:
- New user can start a stream with no external help.

## 7. Out of scope
- Full IaC automation for deployment.
- Multi-region failover or canary releases.
