# Foundation and Local Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a protected local Web/runtime/CLI application with persistent project/vault registration and the accepted UI shell.

**Architecture:** Move the existing Next scaffold into apps/web. A single Fastify runtime owns SQLite and shared contracts; clients remain thin. Introduce only the test/CI tooling required by this vertical slice.

**Tech Stack:** Existing pinned Next/React/pnpm; TypeScript, qualified Node, Fastify 5, Zod 4, better-sqlite3, Vitest, Testing Library, Playwright.

**Spec:** [Approved design](../specs/2026-10-10-zhon-design.md); [data and lifecycles](../specs/2026-10-10-zhon-data-lifecycles.md); [delivery map](../specs/2026-10-10-zhon-delivery-map.md); [plan index](2026-10-10-plan-index.md).

**Status:** Written after design approval on 2026-10-10; implementation awaits plan review and execution-method selection. No code or dependencies were changed to produce this plan.

## Global Constraints

- Read the approved spec, data/lifecycles, delivery map and plan index before this phase. This plan is English-only; final reports require English agent and Vietnamese user versions.
- Single user, local laptop, registered projects and a new Obsidian-compatible Markdown vault; manual repository synchronization. No cloud runtime or IDE automation in MVP.
- Preserve declared Next.js 16.4.0, React/React DOM 19.3.0, pnpm 10.24.0. Qualify and pin compatible dependency/Node/SQLite versions at P0; read installed Next guides before code changes.
- No commits unless specifically requested by BOSS. Push and protected-branch merge are forbidden. Workers may read only env.example; real .env and credentials are denied. Unit fixtures contain synthetic values only.
- Runtime alone owns SQLite, policy and approvals. Repository/Markdown/model output is untrusted reference data, never execution authority. Git worktrees isolate Git state, not security.
- Only Active approved revisions are retrieved. Every manual edit creates a Candidate; retain the old Active revision until exact-hash approval. Scope-filter before ranking; foreign project knowledge requires explicit sharing.
- Approve the concrete whole-phase execution configuration: exact actions/targets/baseline, engines/models/effort, budgets and expiry. Changed configuration invalidates approval. Paid requests reserve bounded cost before dispatch; unknown costs remain reserved.
- Integrator owns contracts, migrations, shared routes/layouts, dependencies/lockfile and root configuration. Parallel FE/BE lanes own disjoint feature files and separate worktrees; freeze interfaces before dispatch.
- English UI, no emoji, Hugeicons only. Separate presentation from services/hooks/view models; no business logic or array maps in HTML/JSX. Meaningful FE and BE unit tests accompany each feature.
- Accepted UI: 280px sidebar; uppercase PERSONAL/PROJECTS at the same font size; Be Vietnam Pro, base 14px, hierarchy ratio 1.2; 8-point spacing. Light #F4F5F6 #E6E8EA #111316 #595E66 #0B6FB8 #5A7400; dark #0D0F11 #181B1F #EAECEF #8B9199 #4DB2FF #B6D94A.
- Rounded, distinct Chat / Statuslines / Context sections; shared content maximum, equal status card widths, status section max-height 75vh, Context below it. Hide scrollbar visuals but preserve scrolling. Footer/terminal occupy body only; Single/Split views. Smooth state transitions with reduced-motion and keyboard/focus support.
- Adapter/CLI/key/sandbox/usage capabilities are unverified until their live qualification check passes. Unknown, unsupported, failed or blocked checks cannot be silently converted into PASS.

## Review Focus

- Host/origin spoofing must not authorize a localhost mutation — T2.
- Symlink registration must not silently escape the selected root — T2.
- A second runtime must not become another authoritative writer — T2.
- Reduced motion and keyboard-only navigation remain usable — T3.
- Missing runtime or a health timeout must produce a nonzero CLI exit — T4.

---

## Preflight and parallel ownership

- [ ] Read existing AGENTS.md and installed Next routing/font/self-hosting guides. Preserve current documentation and dirty changes. Resolve Corepack cache/package availability through normal authorized installation, without bypassing filesystem/network approvals. Pin compatible exact new dependency versions and record Node/SQLite versions before lanes start; verify bundled SQLite against current official release/security notices.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 is sequential and integrator-owned. T2 (BE), T3 (FE), and T4 (CLI) may run in parallel after T1. T5 integrates sequentially. FE can consume health/registration fixtures until runtime is ready.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

Bootstrap exception for P0-T1: establish the runner scripts/config and test fixtures first, then run RED against the new contracts/report behavior. A repository without a test runner cannot produce meaningful behavioral RED. Pin/install only through the approved integrator tooling step; do not change application behavior before its tests.

### P0-T1: Integrator: workspace, test tooling and common contracts

**Owner:** Integrator

**Depends on:** Approved P0 execution plan

**Files:**

- Modify package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, eslint.config.mjs, .gitignore, README.md, AGENTS.md
- Move app/**, public/**, next.config.ts into apps/web; preserve their existing content before replacing scaffold UI
- Create apps/{web,runtime,cli}/package.json and tsconfig.json; packages/contracts/package.json and src/{common,foundation,index}.ts
- Create vitest.config.ts, playwright.config.ts, tests/setup-web.ts, scripts/{acceptance,report,benchmark}.ts; tools/acceptance/{registry,profile}.ts, .github/workflows/ci.yml
- Create packages/contracts/src/foundation.test.ts and tests/integration/tooling.test.ts
- Create apps/runtime/src/storage/migrations/001_foundation.sql

**Interfaces:** Consumes the common types in the plan index. Produces Project {id,root,remote?,version}, Vault {id,root,version}, Health {ready,checks:{name,status,message?}[]}, RegistrationInput {root,remote?}; schemas and fixture exports. Package names: @zhon/web, @zhon/runtime, @zhon/cli, @zhon/contracts. Root scripts are exactly those in the index. registerCheck(phaseId, name, check: (profile) => Promise<CheckRecord>) is the acceptance tooling extension; CheckRecord {name,status:'PASS'|'FAIL'|'BLOCKED',evidencePath?,reason?}. writePhaseReports(runId): Promise<{agentPath,userPath}> consumes stored acceptance records. Command names are registerProject/registerVault in P0, not alternative project.register aliases. Register P0 checks in tools/acceptance/checks/p0.ts; scripts/acceptance.ts loads the registry. scripts/benchmark.ts delegates to P7's runner once implemented.

**Required named cases and assertions:** foundation_rejects_unknown_fields rejects injected grant fields; tooling_fails_on_no_matching_tests returns nonzero; phase_reports_keep_blocked_result preserves BLOCKED and produces both audience files. CI uses frozen-lockfile installs and explicitly named lint/typecheck/unit/integration/build jobs.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
expect(RegistrationInputSchema.safeParse({ root: '/fixture', grantAll: true }).success).toBe(false);
expect(report.result).toBe('Blocked');
expect(report.agentPath.endsWith('agent.md')).toBe(true);
expect(report.userPath.endsWith('user.vi.md')).toBe(true);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/foundation.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Create the workspace/test scripts and derived Zod contracts. Configure the native build allowlist narrowly for qualified dependencies; do not disable all package build restrictions. Keep installed conventions from overwriting project instructions; verify the requested conventions package before running it.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/foundation.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- tests/integration/tooling.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P0-T2: BE: protected runtime, storage and path registration

**Owner:** BE

**Depends on:** P0-T1

**Files:**

- Create apps/runtime/src/server/{create-server,local-session,events}.ts and src/main.ts
- Create apps/runtime/src/storage/{database,migrations}.ts; propose 001_foundation.sql to the integrator-owned apps/runtime/src/storage/migrations/
- Create apps/runtime/src/modules/projects/{service,repository,routes}.ts
- Create apps/runtime/src/adapters/filesystem/registered-paths.ts
- Test apps/runtime/src/modules/projects/service.test.ts, src/server/local-session.test.ts; tests/integration/foundation-runtime.test.ts

**Interfaces:** Store is defined in apps/runtime/src/storage/database.ts with a better-sqlite3 connection, transaction<T>(fn:()=>T):T, close():void and schemaVersion():number; runtime-only SQL is not exported to clients. ServerDeps includes store:Store, clock:()=>Instant, registeredRootPolicy and localSessionConfig. createServer(deps:ServerDeps): Promise<FastifyInstance>; openStore(path): Store; registerProject(input: RegistrationInput): Promise<Result<Project>>; registerVault(input: RegistrationInput): Promise<Result<Vault>>; health(): Health. POST registerProject/registerVault, GET /v1/health, /v1/projects, /v1/vaults. createLocalSession({bootstrapCode,origin}): Result<{sessionId}> consumes a short-lived one-use code; CLI receives one-use bootstrap instructions without exposing a provider key. Browser session cookie and CLI bearer credential have separate narrow roles; auth values never appear in query strings/logs.

**Required named cases and assertions:** rejects_bad_origin, rejects_replayed_bootstrap, rejects_arbitrary_path_escape, persists_registration_after_restart, rejects_second_runtime_owner, event_state_transaction_rolls_back_on_error. Foreign/null origins rejected; expected origin configured explicitly. Configure Web origin and trusted proxy separately; a Next proxy hop cannot authorize an arbitrary browser origin. Temporary fixture roots only.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
expect((await fixture.commandFromOrigin('https://other.example', 'registerProject')).ok).toBe(false);
expect((await fixture.registerEscapingSymlink()).error.code).toBe('PATH_OUT_OF_SCOPE');
expect(await fixture.restartAndListProjects()).toHaveLength(1);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/projects/service.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Bind loopback, cap request bodies at 1 MiB, validate envelopes with shared schemas, protect mutations and enforce single-instance ownership. Use short WAL transactions, busy timeout and explicit durable settings. Register real paths and reject unsafe traversal/symlink changes at access time as well as registration.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/projects/service.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/server/local-session.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P0-T3: FE: accepted shell, themes and navigation

**Owner:** FE

**Depends on:** P0-T1

**Files:**

- Create apps/web/src/features/shell/{Shell,Sidebar,ThemeControl,NavigationGroup}.tsx
- Create apps/web/src/features/shell/{useShell,view-model,theme-store}.ts and shell.css
- Create apps/web/src/features/settings/RegistrationView.tsx, useRegistration.ts and service.ts
- Test apps/web/src/features/shell/Shell.test.tsx and settings/RegistrationView.test.tsx

**Interfaces:** Shell({children}): ReactNode; useShell(): {theme:'light'|'dark',activeView:'chats'|'knowledge'|'settings',groups,setTheme,setView,toggleGroup}; useRegistration(api): {projects,vaults,pending,error,registerProject,registerVault}. ApiClient is from P0/index; feature services own client calls. Shell produces prepared navigation elements; no maps/business rules in JSX.

**Required named cases and assertions:** sidebar_is_280px_desktop, same_size_uppercase_groups, only_hugeicons, group_keyboard_toggle, reduced_motion_disables_transition, selected_theme_persists, failed_registration_is_visible. Check body-only footer, neutral default conversation indicator and no BOSS/Local labels. Small screen uses an explicitly labeled collapsible sidebar rather than squeezing main controls.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
expect(screen.getByRole('button', { name: 'PERSONAL' })).toHaveAttribute('aria-expanded', 'true');
await user.click(screen.getByRole('button', { name: 'Light', exact: true }));
expect(screen.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/shell/Shell.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use Be Vietnam Pro (14px, ratio 1.2) and the exact approved Sky/Lime palettes. Install Hugeicons renderer/free pack via integrator; use CSS transitions/Web Animations, reduced-motion styles and focus states. Keep logic in hooks/view models. Do not introduce unimplemented execution controls as working features.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/shell/Shell.test.tsx`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P0-T4: CLI: unified lifecycle and status commands

**Owner:** CLI

**Depends on:** P0-T1

**Files:**

- Create apps/cli/src/{main,client}.ts and commands/{start,status,register}.ts
- Test apps/cli/src/commands/status.test.ts and start.test.ts

**Interfaces:** runCli(args: string[], io: CliIO, deps: CliDeps): Promise<number>; CliIO {out(text),err(text)}; CliDeps provides connect(): Promise<ApiClient>, startManagedRuntime(): Promise<void>. Commands zhon start/status/project register/vault register call shared foundation contracts. start is idempotent for the same registered runtime.

**Required named cases and assertions:** status_missing_runtime_exit_1, status_timeout_exit_1, start_twice_does_not_spawn_twice, unknown_command_exit_2, safe_error_output_excludes_auth. CLI option parsing does not treat arbitrary strings as shell code.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
expect(await runCli(['status'], fixture.io, fixture.unavailableDeps)).toBe(1);
await runCli(['start'], fixture.io, fixture.deps);
await runCli(['start'], fixture.io, fixture.deps);
expect(fixture.spawnCount()).toBe(1);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/cli/src/commands/status.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use explicit argument parsing and direct process spawn, never shell interpolation. CLI imports contracts/client only, not SQLite or execution services.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/cli/src/commands/status.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/cli/src/commands/start.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P0-T5: Integrator: wire shell/runtime, real registration and CI/report gate

**Owner:** Integrator + independent reviewer

**Depends on:** P0-T2 + P0-T3 + P0-T4

**Files:**

- Create apps/web/src/lib/api/{client,proxy}.ts and app/api/v1/[...path]/route.ts
- Modify apps/web/app/{layout,page}.tsx, globals.css and runtime main/route registration
- Create tests/e2e/foundation.spec.ts; register P0 acceptance scenarios in scripts/acceptance.ts
- Create docs/reports/P0/<run-id>/{agent.md,user.vi.md} at execution time
- Create apps/runtime/src/server/commands.ts; packages/contracts/src/fixtures/foundation.ts

**Interfaces:** createApiClient is exactly the index interface. Proxy allows only configured runtime host/path and forwards validated local session/origin; no user-supplied URL. GET health/register command response schemas are from T1. Reports use stored checks and the approved report contract.

**Required named cases and assertions:** real_registration_survives_restart, arbitrary_proxy_url_denied, production_shell_keyboard_flow, frozen_lockfile_ci, runtime_offline_visible_in_ui.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await registerDisposableVault(page, fixture.vaultRoot);
await fixture.restartRuntime();
await expect(page.getByText(fixture.vaultRoot, { exact: true })).toBeVisible();
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:e2e -- tests/e2e/foundation.spec.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Integrate shared entry points only after all lanes pass. Run production-build E2E against disposable roots, record exact versions/native SQLite checks and independent review. Persist reports; keep source uncommitted.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:e2e -- tests/e2e/foundation.spec.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm acceptance -- P0 --profile fixture-local
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

Execution update (2026-10-10): P0 is DoneLocal after remediation and independent review. The task steps below retain their original planning checklist; completed progress and exact evidence are recorded in [the execution ledger](execution-ledger.md) and [final report](../../reports/P0/run-p0-remediation-final/agent.md).

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P0 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P0 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P0/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** Protected runtime, persistent registration, CLI status and accepted shell operate together; all required unit/integration/E2E/local CI commands pass. Actual SQLite/version qualification and both reports are recorded.

**Blockers and resolution:** Corepack/package/build access, incompatible native SQLite, unverified conventions installer, unsupported pinned framework APIs. Resolve within integrator-owned tooling qualification; preserve existing changes. Do not report P0 Done with only scaffold/fixture tests. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** Pass exact pinned tool versions, command scripts, schema exports, route/client interfaces and disposable registered roots to P1. S1 may independently consume the recorded toolchain.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

