# Option B Implementation Backlog (10 Tasks)

This plan implements the "Guided Session UX" approach with reliability first, then UI simplification, then validation.

## Group 0 - Foundation Guardrails

### 1) Document session and permission rules
- **Targets**: `docs/session-state.md`, `docs/permissions.md`
- **Scope**:
  - Define one active focus session per user globally.
  - Define role actions (`host`, `admin`, `member`) for start/pause/stop and group-level controls.
  - Define switch behavior (block vs auto-switch with confirmation).
- **Acceptance criteria**:
  - Rules are written and referenced by implementation PRs.
  - No ambiguous action ownership for stop and switch.

## Group 1 - Reliability Core

### 2) Extract session lifecycle service from group page
- **Targets**: `app/groups/page.tsx`, `lib/*` (new session service module)
- **Scope**:
  - Move start/pause/stop/switch logic out of UI handlers.
  - Keep one API surface for session actions.
- **Acceptance criteria**:
  - `page.tsx` calls service methods instead of containing orchestration logic.
  - Session transitions are handled in one place.

### 3) Enforce one active session per user at write-time
- **Targets**: existing live session data functions in `lib/db` or adjacent data layer
- **Scope**:
  - Add guard before start to reject second active session.
  - Support explicit "switch group" path.
- **Acceptance criteria**:
  - Attempting second session fails safely or triggers switch flow.
  - No double-active session rows for the same user.

### 4) Add idempotent start/stop and stale cleanup
- **Targets**: session service + data layer
- **Scope**:
  - Safe handling for repeated clicks/network retries.
  - Recovery path for stale "active" records.
- **Acceptance criteria**:
  - Double-clicking start/stop does not corrupt state.
  - Stale active state can be resolved deterministically.

## Group 2 - Option B UX Simplification

### 5) Add Session Control Bar in Group Detail
- **Targets**: `app/groups/page.tsx` (`GroupDetailModal`)
- **Scope**:
  - Primary controls: `Start`, `Pause`, `Stop`.
  - Explicit pending states: `Starting...`, `Pausing...`, `Stopping...`.
- **Acceptance criteria**:
  - A visible stop action exists in active session state.
  - Buttons disable while request is in flight.

### 6) Add global mini control bar across app
- **Targets**: shared layout/components area (e.g. top-level app shell + new component)
- **Scope**:
  - Show active group name + elapsed + quick `Pause` and `Stop`.
  - Keep visible when user navigates away from groups page.
- **Acceptance criteria**:
  - User can stop from any page in one click.
  - State stays consistent with group/session backend.

### 7) Simplify labels and reduce visual noise
- **Targets**: `app/groups/page.tsx`, `components/quick-tasks-panel.tsx`, `app/leaderboard/page.tsx`
- **Scope**:
  - Replace overloaded terms with plain UX text.
  - Remove non-essential glow/pulse/ornamental effects in critical controls.
- **Acceptance criteria**:
  - Primary actions are obvious without onboarding.
  - Visual hierarchy clearly highlights current task and stop control.

## Group 3 - Data Integrity and Metrics

### 8) Normalize session model and aggregation path
- **Targets**: data layer + aggregation utilities
- **Scope**:
  - Ensure sessions include `userId`, `groupId`, `startedAt`, `endedAt`, `status`.
  - Derive totals from completed sessions.
- **Acceptance criteria**:
  - Group/user totals match session history.
  - No UI-only timer writes directly to totals.

### 9) Add telemetry for key flow outcomes
- **Targets**: session service + logging utilities
- **Scope**:
  - Emit events for start/stop/pause/switch/sync failures.
  - Include minimal diagnostic context.
- **Acceptance criteria**:
  - Failures are traceable by action and reason.
  - Logs support debugging without reproducing manually.

## Group 4 - Validation and Rollout

### 10) Add critical flow tests and release checklist
- **Targets**: test folder(s) + release notes doc
- **Scope**:
  - Integration tests for session lifecycle and permissions.
  - One e2e path: join group -> start -> stop -> totals update.
  - Rollout checklist for migration and monitoring.
- **Acceptance criteria**:
  - Tests cover "cannot focus in more than one group at once."
  - Release checklist includes fallback behavior for stale sessions.

## Suggested Order of Execution
1. Tasks 1-4
2. Tasks 5-7
3. Tasks 8-9
4. Task 10

This sequence prevents UI rework by locking reliability constraints before visual changes.
