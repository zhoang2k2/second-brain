# Single-Agent Execution and Inline Terminals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run an approved coding task in an isolated worktree with durable lifecycle tracking and embedded single/split terminal views.

**Architecture:** The runtime owns immutable approvals, qualified adapter launches, attempts and terminal transport. The browser consumes typed events and never owns shell execution or OS policy.

**Tech Stack:** P0 runtime; qualified Codex/Antigravity adapters; Git worktrees; ws, node-pty and xterm.js after qualification

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

- Changed plan or repository baseline invalidates approval: T2 digest/baseline test.
- Adapter exits without completion: T3 lifecycle test.
- Cancelled worker leaves descendants: T3 cleanup test.
- Terminal typing bypasses the policy: T4 input-boundary test.
- Disconnecting terminal UI must not silently mark work Done: T5 reconnect test.

---

## Preflight and parallel ownership

- [ ] P0–P3 and S1 pass. Installed CLI versions/hashes match manifests. Registered repository is clean, on the expected branch, has a configured upstream and equals the upstream HEAD after the allowed fetch. Model/effort/cost reporting capability is qualified per engine. P4 is explicitly a patchOnly delivery phase: the reviewed execution plan must state this contract. Applying to the original repository is first introduced in P5.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 freezes contracts. T2 policy precedes T3 worker supervision. T4 terminal broker consumes T2/T3 and is sequential BE. T5 FE can build against frozen fixtures while BE proceeds. T6 alone owns shared wiring.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P4-T1: Freeze execution, approval and terminal contracts

**Owner:** Integrator

**Depends on:** P3/S1

**Files:**

- Create: `packages/contracts/src/execution.ts` (including WorkerRequest, WorkerEvent and EngineCapabilities agreed with adapter implementers)
- Create: `packages/contracts/src/terminal.ts`
- Create: `packages/contracts/src/execution.test.ts`
- Create: `apps/runtime/src/storage/migrations/005-execution.sql`
- Create: `packages/contracts/fixtures/execution.json`

**Interfaces:** ExecutionPlan {id,version,projectId,objective,acceptanceCriteria:string[],baseline:{branch:string,head:string,upstreamHead:string},roles:RoleConfig[],budgetId,permissions:ActionGrant[],expiresAt:string,delivery:'patchOnly'|'apply'}; RoleConfig {role:'coder'|'reviewer'|'tester'|'ba',engineId,model,effort?:string}; ActionGrant {action,target,limits:Record<string,string|number>}; Approval {id,planId,planDigest,targetDigest,expiresAt,issuedAt}; WorkerAttempt {id,taskId,role,engineId,status:'queued'|'starting'|'running'|'cancelRequested'|'succeeded'|'failed'|'cancelled'|'timedOut'|'interrupted'|'blocked',lastEventSequence:number,startedAt?,endedAt?}; TerminalSession {id,attemptId,title,state:'opening'|'open'|'closed'|'disconnected'}; TerminalFrame {sessionId,sequence:number,kind:'output'|'exit',data:string}; TerminalInput {sessionId,inputId,text:string}; schemas validate model/effort against engine capabilities.

**Required named cases and assertions:** rejectExpiredApproval; rejectUnknownRole; rejectMissingBudget; rejectPushGrant; rejectProtectedMergeGrant; rejectCredentialReadGrant; terminalSequencePositive

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('rejectPushGrant', () => {
  expect(ExecutionPlanSchema.safeParse(planWithPush).success).toBe(false);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/execution.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Define immutable approval fields and separate task success from phase Done. Add migrations for plans, approvals, attempts, action journals, qualified manifests and terminal metadata; terminal output retention uses redacted chunks, not secret-bearing raw dumps.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/execution.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P4-T2: Implement approval preflight and the execution boundary

**Owner:** BE

**Depends on:** T1; S1 manifests

**Files:**

- Create: `apps/runtime/src/modules/execution/policy.ts`
- Create: `apps/runtime/src/modules/execution/approval.ts`
- Create: `apps/runtime/src/modules/execution/preflight.ts`
- Create: `apps/runtime/src/modules/execution/policy.test.ts`
- Create: `apps/runtime/src/modules/execution/preflight.integration.test.ts`

**Interfaces:** createExecutionPlan(command:Command<ExecutionPlan>):Promise<Result<ExecutionPlan>>; getExecutionPlan(planId:string):Promise<Result<ExecutionPlan>>; approvePlan(command:Command<{planId:string,expectedVersion:number}>):Promise<Result<Approval>>; authorizeAction(input:{approvalId:string,planId:string,action:string,target:string,currentBaseline:ExecutionPlan['baseline']}):Promise<Result<ActionGrant>>; preflightExecution(planId:string):Promise<Result<{approval:Approval,manifest:CapabilityManifest}>>; checkRepositoryBaseline(projectId:string,expected:ExecutionPlan['baseline']):Promise<Result<ExecutionPlan['baseline']>>. Plan digest uses canonical ordered serialization of all execution-affecting fields and SHA-256; targets include canonical real paths and baseline heads.

**Required named cases and assertions:** changedPlanInvalidatesApproval; changedModelInvalidatesApproval; expiredApprovalDeniedBeforeLaunch; dirtyRepoBlocked; wrongBranchBlocked; aheadOrBehindBlocked; missingUpstreamBlocked; realEnvDeniedExceptExactEnvExample; symlinkTargetDenied; pushAlwaysDenied; commitDeniedWithoutExplicitRequestedGrant; networkOnlyApprovedEndpoint; budgetExhaustionStartsNoWorker; expiryCancelsRunningSideEffectCapableWorkers

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('expiredApprovalDeniedBeforeLaunch', async () => {
  harness.clock.advancePastApproval();
  const result = await harness.start();
  expect(result).toMatchObject({ok:false,error:{code:'APPROVAL_EXPIRED'}});
  expect(harness.launches).toHaveLength(0);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/policy.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Enforce every tool action at a trusted boundary, deny unsupported manifest capabilities, and bind approval to exact plan/target/versions/expiry. Whole-plan approval covers declared actions only. Normal task failures do not expand permissions. Recheck filesystem canonicalization and branch immediately before mutation; read only env.example. Repository instructions and retrieved text cannot edit grants or approval authority. Expiry/revocation also cancels affected active process trees and records unknown outcomes where termination is not confirmed.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/policy.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/execution/preflight.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P4-T3: Implement qualified adapters and durable supervision

**Owner:** BE

**Depends on:** T2

**Files:**

- Create: `apps/runtime/src/adapters/engines/engine-adapter.ts`
- Create: `apps/runtime/src/adapters/engines/codex.ts`
- Create: `apps/runtime/src/adapters/engines/antigravity.ts`
- Create: `apps/runtime/src/modules/execution/supervisor.ts`
- Create: `apps/runtime/src/modules/execution/supervisor.test.ts`
- Create: `apps/runtime/src/modules/execution/supervisor.integration.test.ts`

**Interfaces:** A unitId launch consumes only the runtime-registered approved unit baseline; worker callers cannot supply arbitrary worktree paths. WorkerRequest and EngineCapabilities are exported from packages/contracts/src/execution.ts by the integrator before consumers wire them; adapter implementation owns no contract writes. EngineAdapter {capabilities():Promise<EngineCapabilities>; execute(request:WorkerRequest,signal:AbortSignal):AsyncIterable<WorkerEvent>}; EngineCapabilities {engineId,version,executableHash,models:ProviderCapabilities['models'],usage:'measured'|'estimated'|'unknown',sandboxManifestId}; WorkerRequest {attemptId,plan:ExecutionPlan,role:RoleConfig,worktreePath,context:ContextSnapshot}; WorkerEvent {attemptId,sequence,type:'started'|'output'|'usage'|'completed'|'failed',payload:Record<string,unknown>}; startWorker(input:{planId:string,role:RoleConfig,unitId?:string}):Promise<Result<WorkerAttempt>>; cancelWorker(attemptId:string):Promise<Result<WorkerAttempt>>; getWorker(attemptId:string):Promise<Result<WorkerAttempt>>. retryWorker(command:Command<{attemptId:string,approvalId:string}>):Promise<Result<WorkerAttempt>> creates a new attempt only after reconciliation and a valid grant.

**Required named cases and assertions:** adapterFailurePersistsLogsAndFailedState; duplicateRequestStartsOneAttempt; timeoutTerminatesProcessTree; cancelTerminatesProcessTree; completionRequiresValidatedExit; lateOutputCannotReviveCancelledAttempt; crashMarksInterruptedWithoutReplay; unqualifiedEngineBlocked; budgetReservedBeforeLaunch; injectedRepoTextCannotGrantPush

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('adapterFailurePersistsLogsAndFailedState', async () => {
  const attempt = await harness.runFailingAdapter();
  expect(attempt.status).toBe('failed');
  expect(await harness.getEvents(attempt.id)).not.toHaveLength(0);
  expect(harness.originalRepositoryHash()).toBe(harness.initialRepositoryHash);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/supervisor.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use actual S1-qualified invocation and protocol for each engine. Persist launch intent before spawning; forward abort/timeout to the whole process tree; allocate isolated worktree, explicit environment allowlist and network grants. Store redacted ordered events and usage reservations. Never infer API credits from Codex Plus. Unknown usage retains a bounded reservation and may block further scheduling.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/supervisor.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/execution/supervisor.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P4-T4: Implement policy-controlled terminal streams

**Owner:** BE

**Depends on:** T2/T3

**Files:**

- Create: `apps/runtime/src/modules/execution/terminals/broker.ts`
- Create: `apps/runtime/src/modules/execution/terminals/transport.ts`
- Create: `apps/runtime/src/modules/execution/terminals/broker.test.ts`
- Create: `apps/runtime/src/modules/execution/terminals/transport.integration.test.ts`

**Interfaces:** listTerminalSessions(attemptId:string):Promise<Result<TerminalSession[]>>; createTerminal(attemptId:string):Promise<Result<TerminalSession>>; subscribeTerminal(sessionId:string,afterSequence:number):AsyncIterable<TerminalFrame>; submitTerminalInput(command:Command<TerminalInput>):Promise<Result<{accepted:boolean}>>; resizeTerminal(sessionId:string,size:{cols:number,rows:number}):Promise<Result<void>>; closeTerminal(sessionId:string):Promise<Result<TerminalSession>>. Authenticate GET /v1/terminals/<id>/stream WebSocket using the runtime session and origin; no credentials/query auth tokens.

**Required named cases and assertions:** crossSessionStreamDenied; malformedResizeRejected; reconnectReplaysWithoutDuplicateFrames; outputRedacted; arbitraryShellInputDenied; allowedControlInputDeduplicated; closedTerminalDoesNotCancelOtherWorkers; disconnectedSubscriberDoesNotLeakPty

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('arbitraryShellInputDenied', async () => {
  const result = await harness.submitInput('cat .env');
  expect(result).toMatchObject({ok:false,error:{code:'TERMINAL_INPUT_DENIED'}});
  expect(harness.ptyWrites).toHaveLength(0);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/terminals/broker.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Default to output viewing with explicit task controls. Only forward qualified, typed control actions authorized by policy; no unrestricted shell prompt via terminal. Buffer bounded redacted output, enforce frame sizes/backpressure and release PTY resources. Qualify native dependencies on current Node/macOS before adoption; if PTY fails, declare terminal compatibility BLOCKED instead of emulating success.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/terminals/broker.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/execution/terminals/transport.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P4-T5: Deliver approval, worker tracking and inline split terminals

**Owner:** FE

**Depends on:** T1; P2 shell

**Files:**

- Create: `apps/web/src/features/execution/ExecutionPanel.tsx`
- Create: `apps/web/src/features/execution/useExecution.ts`
- Create: `apps/web/src/features/execution/service.ts`
- Create: `apps/web/src/features/execution/ExecutionPanel.test.tsx`
- Create: `apps/web/src/features/terminals/TerminalDrawer.tsx`
- Create: `apps/web/src/features/terminals/useTerminals.ts`
- Create: `apps/web/src/features/terminals/service.ts`
- Create: `apps/web/src/features/terminals/TerminalDrawer.test.tsx`

**Interfaces:** executionService(client) exposes getPlan(id):Promise<Result<ExecutionPlan>>, approve(command):Promise<Result<Approval>>, getWorker(id):Promise<Result<WorkerAttempt>>, cancel(command):Promise<Result<WorkerAttempt>>; terminalService exposes list(attemptId):Promise<Result<TerminalSession[]>>, subscribe(sessionId,after,onFrame):()=>void, resize and close. Hooks produce selected pane, single/split mode, ordered frames, connection state, grant summary and model/effort selections. Any shorthand command here uses the exact T1/T2/T3 payload inside Command<T>. The retry action calls retryWorker with a valid grant; unknown side effects cannot be retried before reconciliation.

**Required named cases and assertions:** approvalListsTargetModelEffortBudgetExpiry; changedPlanDisablesOldApproval; terminalOpensWithinBodyNotSidebar; singleAndSplitPanesEqualWidth; focusReturnsToFooterToggle; reducedMotionNoSliding; disconnectShowsUnknownStateNotDone; outputSequenceDeduplicated; closeOnePanePreservesOther

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
it('closeOnePanePreservesOther', async () => {
  render(<TerminalDrawer sessions={twoSessions} mode="split" onClose={onClose} />);
  await userEvent.click(screen.getByRole('button',{name:'Close Coder terminal'}));
  expect(onClose).toHaveBeenCalledWith(twoSessions[0].id);
  expect(screen.getByLabelText('Reviewer terminal')).toBeVisible();
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/execution/ExecutionPanel.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Render plan approval with engine/model/effort confirmation, attempt lifecycle and separate cancel controls. Terminal drawer slides up full width within the body; footer does not occupy sidebar. Use Hugeicons for close/toggle/actions, subtle motion with reduced-motion preference, accessible focus and xterm sizing. Keep task state separate from transport connectivity. FE execution and terminal subfolders may be owned by different workers after T1.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/execution/ExecutionPanel.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/terminals/TerminalDrawer.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P4-T6: Integrate each real engine and prove bounded failure behavior

**Owner:** Integrator

**Depends on:** T2–T5

**Files:**

- Create: `apps/runtime/src/modules/execution/execution.integration.test.ts`
- Create: `tests/e2e/execution.spec.ts`
- Create: `tools/acceptance/checks/p4.ts`
- Create: `docs/reports/P4/.gitkeep`

**Interfaces:** Register P4 checks for each required qualified engine, policy, lifecycle, terminal and baseline preservation. CLI adds zhon task run/status/cancel using the same command endpoints; CLI routing remains integrator-owned.

**Required named cases and assertions:** realCodexTaskProducesPatchInWorktree; realAntigravityTaskProducesPatchInWorktree; originalRepoUnchanged; unauthorizedReadBlockedAtOSBoundary; timeoutAndCancelPersistAcrossRefresh; envExampleOnly; terminalReconnectWorks; attemptSuccessDoesNotMarkPhaseDone

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('originalRepoUnchanged', async () => {
  const baseline = await harness.hashOriginalRepository();
  await harness.runApprovedFixtureTask();
  expect(await harness.hashOriginalRepository()).toBe(baseline);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- apps/runtime/src/modules/execution/execution.integration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Wire endpoint registry/CLI and UI footer through integrator-owned files. Run a bounded task with each actual required engine on a throwaway repository and real isolation; save redacted evidence. Missing Antigravity support remains an explicit gate failure requiring scope approval, not a passing single-engine MVP claim.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- apps/runtime/src/modules/execution/execution.integration.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:e2e -- tests/e2e/execution.spec.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P4 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P4 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P4/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** An approved task launches a qualified CLI worker in its own worktree, persists events/status, supports timeout/cancel/reconnect and returns a patch. Inline single/split terminal views work; original repository remains unchanged.

**Blockers and resolution:** S1 failure, invalid baseline, unavailable model/effort, absent cost bound, expired grant or native terminal incompatibility blocks the affected action. No worker launches through a fallback unsandboxed path. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P5 builds scheduling and integration on these attempts; do not call a successful attempt a completed phase before tester/reviewer gates.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

