# Zhon implementation plan index

Status: P0 completed locally and independently reviewed on 2026-10-10; see [execution ledger](execution-ledger.md) and [final evidence](../../reports/P0/run-p0-remediation-final/agent.md). P1–P7 and S1 remain plans, not implemented phases. All plans are English-only; human reports are Vietnamese.

## Reading order

Read the [approved design](../specs/2026-10-10-zhon-design.md), [data/lifecycles](../specs/2026-10-10-zhon-data-lifecycles.md), this index, then the target phase plan. Do not execute later phases because their files exist.

| Plan | Deliverable | Prerequisite |
| --- | --- | --- |
| [P0 Foundation](2026-10-10-p0-foundation.md) | Web/runtime/CLI shell, registration, tests/CI | Plan review and execution-method selection |
| [P1 Knowledge review](2026-10-10-p1-knowledge-review.md) | Vault ingestion/search/Active-Candidate-Deactive | P0 Done |
| [P2 Chat/context](2026-10-10-p2-chat-context.md) | Gemini conversations, retained intent, day history | P1 Done; configured live provider |
| [P3 Knowledge growth](2026-10-10-p3-knowledge-growth.md) | Budgeted background enrichment and connections | P2 Done |
| [S1 Sandbox feasibility](2026-10-10-s1-sandbox-feasibility.md) | Engine capability and native boundary evidence | Separately approved probe; may run alongside P0-P3 |
| [P4 Single agent/terminals](2026-10-10-p4-single-agent-terminals.md) | Qualified execution, approvals, Single/Split terminals | P3 Done; S1 PASS for enabled actions |
| [P5 Phase orchestration](2026-10-10-p5-phase-orchestration.md) | Parallel DAG, integration, validation, application/reports | P4 Done |
| [P6 GitHub CI](2026-10-10-p6-github-ci.md) | Read-only workflow/job/revision tracking | P5 Done; authorized GitHub access |
| [P7 Recovery/evaluation](2026-10-10-p7-recovery-evaluation.md) | Backup/restore and integrated acceptance | P6 Done |

## Execution and write ownership

For each phase: contract/integrator task -> independent BE and FE lanes -> sequential integration -> real acceptance -> reports. Plans name exact file ownership; workers cannot broaden it without updating the ownership ledger.

- Integrator owns package/lock/config files, `packages/contracts/**`, migrations, route/layout composition, server registration and shared tokens. Other tasks request changes rather than editing those files concurrently.
- FE owns the assigned `apps/web/src/features/<feature>` files; BE owns assigned module/adapters. Tests are adjacent and owned by the same task.
- Separate worktrees for concurrently modifying workers. No commits without a specific BOSS request. Supply reviewed diffs/manifests for integration; never depend on automatic commits/cherry-picks.
- `docs/reports/<phase>/<run-id>/` is written by the report/integration lane. Record the actual run ID rather than repeatedly overwriting one report.
- Add `docs/superpowers/plans/execution-ledger.md` when execution starts: task ID, owner, model/effort, worktree, owned files, input artifact, state, blockers. The ledger is integrator-owned.
- Changing a shared interface pauses affected lanes, updates schemas/fixtures, then resumes both consumers. Fixture-driven FE progress is permitted; fixture-only phase completion is not.

## Tooling decisions for P0 qualification

Preserve declared Next 16.4.0, React/React DOM 19.3.0 and pnpm 10.24.0. Node 22.19.0 is observed, not a promise of current security/support. Select a supported compatible Node patch at the qualification gate; do not modify the user's global runtime silently.

Implementation defaults: Fastify 5 for local HTTP routing, Zod 4 for shared validation, better-sqlite3 for SQLite/WAL/FTS5, Vitest for TS tests, Testing Library/jsdom for FE behavior, Playwright for actual browser integration. Native dependency builds and exact compatible versions must be checked and pinned by P0-T1 before worker lanes start. Use TypeScript compilation for runtime/CLI builds; no monorepo orchestration service is needed.

P2 uses fetch with the Gemini REST API, avoiding a provider SDK until necessary. P4 uses `ws`, `node-pty` and xterm.js only after native compatibility qualification; install packages through the integrator. No Redis, vector database, ORM, microservices or mandatory motion library. CSS/Web Animations can cover the current UI.

These libraries are plan choices subject to plan review. References: [Fastify support](https://fastify.dev/docs/latest/Reference/LTS/), [Zod 4](https://zod.dev/v4), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Vitest](https://vitest.dev/guide/), [Playwright](https://playwright.dev/docs/intro).

## Common contracts introduced in P0-T1

`packages/contracts/src/common.ts` exports:

```ts
type ID = string;
type Instant = string; // ISO 8601 UTC
type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };
type ApiError = { code: string; message: string; retryable: boolean };
type Command<T> = { requestId: ID; idempotencyKey: ID; expectedVersion?: number; payload: T };
type RuntimeEvent<T> = { sequence: number; type: string; resourceId: ID; occurredAt: Instant; payload: T };
type Scope = { kind: 'global' } | { kind: 'project'; projectId: ID };
```

Every feature contract defines its schema and derives runtime-validated TS payloads. Stored scopes additionally express whether a project note is explicitly shared; global scope is not a loophole for unapproved project data.

Transport conventions: `POST /v1/commands/<name>` with Command envelope; feature-specific GET queries; `/v1/events?after=<sequence>` SSE; P4 `/v1/terminals/<sessionId>/stream` WebSocket. Mutations require a protected local session, exact origin/host checks and valid resource versions. Browser calls use an integrator-owned Next API proxy; clients cannot submit an arbitrary upstream URL.

P0 defines `createApiClient({baseUrl, fetchImpl}): ApiClient` with `command<T,U>(name, command): Promise<Result<U>>`, `query<T>(path): Promise<Result<T>>` and `subscribe(after, onEvent): () => void`. Feature services call it; JSX does not import the raw client. CLI uses the same validated HTTP contracts.

Mutation IDs deduplicate runtime mutations, not arbitrary external side effects. A completed job/action event is persisted with its state transaction; reconnect can resnapshot when replay is unavailable.

## Commands after P0

Run from repository root. P0-T1 must install these script names before any later plan uses them:

```text
pnpm test:unit -- <repo-relative-test-path>
pnpm test:integration -- <repo-relative-test-path>
pnpm test:e2e -- <repo-relative-spec-path>
pnpm lint
pnpm typecheck
pnpm build
pnpm verify
```

`test:unit` invokes Vitest run for contracts/runtime/CLI and jsdom FE projects; test-path filtering must fail when no test matches. Integration tests have isolated temporary stores and bind ephemeral localhost ports. E2E starts production-built Web/runtime against a disposable test profile. `verify` combines local lint/typecheck/unit/integration/build; live paid-provider/native-sandbox/remote checks are explicit separate acceptance commands, never silently skipped as PASS.

P0 also establishes `pnpm acceptance -- <phase-id> --profile <registered-test-profile>` and `pnpm report -- <phase-id> --run <run-id>`. The acceptance runner records PASS/FAIL/BLOCKED per check and returns nonzero unless all required checks passed. Phase plans add scenario registrations through the integrator. Reports read the recorded result, not invented command output. Report CLI is development tooling initially; product report generation is added in P5.

## Test-first task cycle

Compact interface records use strings for IDs/paths/model IDs, UTC ISO strings for timestamps, numbers for versions/counts/USD values, and the explicitly listed enums. Derive strict runtime schemas and export types from the integrator-owned contracts entry point; never create a second FE-only copy. Acceptance tooling exports `TestProfile {id,projectRoots:string[],vaultRoot:string,providerCredentialRef?:string,engineManifestIds:string[],remoteTargetSha?:string}` from `tools/acceptance/profile.ts`; refs never contain credentials.

Local `verify` runs deterministic contract/logic/component/transport tests. Native/paid/remote qualification cases are registered explicitly in acceptance profiles and do not silently execute during CI. Their harness behavior may be tested with fixtures locally, but an actual required live qualification without prerequisites is BLOCKED. For native suites that also run during local testing, expected UNSUPPORTED classification is a test result, never a release qualification PASS.

Each task's snippet specifies a required assertion, not a full implementation body. Create the named adjacent tests/fixture helpers; perform the RED run, implement the exact Interfaces contract, then GREEN run. Fixtures use fake credentials and explicitly registered disposable project/vault roots. Do not read real `.env` files or Keychain values during unit tests.

Changes to existing Next APIs must first read the relevant installed guides under `node_modules/next/dist/docs/`. Only test scripts/fixtures/plan text are hypothetical now; no scripts were created or run during planning.

## Common phase exit checklist

- [ ] All task checks and the phase's Review Focus cases are covered.
- [ ] Independent BE/FE lanes integrated against the same contract version.
- [ ] Required real acceptance checks recorded; unknown/blocked checks remain non-passing.
- [ ] `pnpm verify` passes on the integrated artifact; broaden testing only for new failures/risks.
- [ ] Independent reviewer reports no unresolved required findings.
- [ ] English `agent.md` and Vietnamese `user.vi.md` persisted using the [report contract](../specs/2026-10-10-zhon-report-templates.md).
- [ ] Blockers include resolver/next action; handoff states the next phase's available prerequisites.
- [ ] Changes remain uncommitted unless BOSS specifically requested a commit; push stays forbidden.

## Original acceptance coverage

| Required scenario | First owning task | Integrated evaluation |
| --- | --- | --- |
| Adapter failure keeps state/logs and allows a valid new retry | P2-T3; P4-T3 | P7-T4 |
| Concurrent agents never overwrite each other's working tree | P5-T1/T3/T6 | P7-T4 |
| Crash never blindly repeats an action with side effects | P3-T2; P4-T3; P5-T3 | P7-T2/T4 |
| Unauthorized filesystem access is blocked by a real boundary | S1-T2/T3; P4-T2/T6 | P7-T4 |
| Repository injection cannot change policy or approval | P4-T2/T3; P5-T6 | P7-T4 |
| Other project memory is excluded unless explicitly shared | P1-T3; P2-T3 | P7-T4 |
| Invalid/stale memory cannot be promoted | P1-T3; P3-T3 | P7-T4 |
| Expired approval denies actions and reconciles running workers | P4-T2; P5-T2 | P7-T4 |
| Budget exhaustion launches no extra paid request/worker | P2-T2; P3-T2; P5-T2 | P7-T4 |
| Failed reviewer never makes a phase Done | P5-T4/T6 | P7-T4 |
| Conflicting changes stop integration/application | P5-T3/T6 | P7-T4 |

The complete set contains 9 plans and 46 reviewable tasks. FE/BE lanes are independent only after their contract gate; S1 is a feasibility exception without an artificial FE lane. P4 deliberately proposes patch-only delivery; P5 introduces approved application. Review that delivery choice with the phase plan rather than silently applying it.

## Planning self-review record — 2026-10-10

- Complete plan inventory: P0–P7 and S1, 46 tasks, with contract gates before independent lanes and integration/reports at each exit.
- Original 11 acceptance scenarios mapped above; brainstorming-to-draft ownership, manual-edit candidates and historical solution context are assigned explicitly.
- Corrected cross-lane contract exports, migration/file ownership, phase-state and required application gates. Preserved a separately reviewed patch-only delivery proposal for P4.
- Confirmed every task has files, interfaces, named cases, a focused assertion, RED/GREEN commands and a review checkpoint; code fences and document links are checked locally.
- This is an inline plan review, not independent code review or product acceptance. No live engine/provider/sandbox check, dependency installation, product tests/build, commit or push occurred while writing these plans.

### Outstanding live qualification

No S1 evidence exists yet. Keychain/Gemini live access, installed CLI control interfaces, allowance metrics and GitHub access are unverified. The plans explicitly assign qualification tasks. A missing live capability can block its phase without invalidating already verified second-brain functionality.

For API/CLI effort/model/budget choices, BOSS reviews the concrete execution configuration before paid requests/workers. Plan approval does not authorize arbitrary credentials, network endpoints or filesystem access.
