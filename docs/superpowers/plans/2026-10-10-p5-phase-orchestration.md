# Approved Phase Orchestration and Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute one approved phase with parallel independent workers, dependency-aware integration, independent validation and both required reports.

**Architecture:** A TypeScript state machine coordinates a persistent DAG. Workers write separate worktrees and return patches; the integration worktree applies them in dependency order without automatic commits.

**Tech Stack:** P4 adapters and sandbox; SQLite scheduler/action journals; Git patch operations; Vitest and Playwright

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

- Two workers own the same file: T1 rejects overlapping write scopes.
- Failed prerequisite must not launch dependents: T2 dependency test.
- Security violation should stop all phase launches: T2 security-stop test.
- Patch conflict must not become silent overwrite: T3 conflict test.
- Reviewer outage cannot satisfy Done: T4 required-review test.

---

## Preflight and parallel ownership

- [ ] P4 passes for required engines. Approve one complete phase plan with roles/models/efforts, maximum concurrency, total budget, write ownership, integration target/baseline, validation commands and expiry. Default proposed concurrency is 2; BOSS may approve a lower qualified limit.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 freezes DAG/contracts. T2 scheduler and T3 integration services may run in parallel against frozen interfaces using separate test repositories. T4 validation depends on T2/T3. T5 FE can run after T1. T6 integrates all paths. Workers sharing files must be serialized or repartitioned; integrator alone owns shared schemas/route registry/lockfile. P5-T1b planning can run alongside scheduler/integration after T1 because it owns only planning.ts; draft creation itself never executes the proposed coders.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P5-T1: Freeze DAG, ownership and phase completion contracts

**Owner:** Integrator

**Depends on:** P4

**Files:**

- Create: `packages/contracts/src/orchestration.ts`
- Create: `packages/contracts/src/orchestration.test.ts`
- Create: `apps/runtime/src/storage/migrations/006-orchestration.sql`
- Create: `packages/contracts/fixtures/orchestration.json`

**Interfaces:** Export PhaseView {plan:PhasePlan,state:PhaseState,units:{unit:WorkUnit,state:WorkUnitState,attemptId?:string,blocker?:string}[],validations:ValidationResult[],report?:PhaseReport} here before FE starts. WorkUnit {id,phaseId,title,dependencies:string[],readScope:string[],writeScope:string[],role:RoleConfig,acceptanceCriteria:string[],validationCommands:string[],expectedBaseHead:string}; PhasePlan extends ExecutionPlan {units:WorkUnit[],maxConcurrency:number,integrationTarget:string,requiredValidation:('tests'|'lint'|'build'|'tester'|'reviewer')[]}; PhaseState='draft'|'awaitingApproval'|'approved'|'running'|'integrating'|'blocked'|'validating'|'applying'|'reporting'|'done'|'cancelled'; WorkUnitState='pending'|'ready'|'running'|'outputReady'|'integrated'|'validated'|'succeeded'|'failed'|'blocked'|'cancelled'; PatchArtifact {id,unitId,attemptId,baseHead:string,contentHash:string,path:string,changedPaths:string[]}; ValidationResult {id,phaseId,kind,headHash:string,status:'pass'|'fail'|'blocked',summary:string,logPath:string}; PhaseReport {phaseId,runId,agentPath,userPath,status,blockers:string[],artifactHashes:string[]}. Export validateDag(plan:PhasePlan):Result<PhasePlan> and all schemas.

**Required named cases and assertions:** rejectDagCycle; rejectMissingDependency; rejectOverlappingParallelWriteScopes; rejectLockfileOwnershipOutsideIntegrator; rejectConcurrencyBelowOne; acceptanceCriteriaRequired; dependencyLineageRequired

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('rejectOverlappingParallelWriteScopes', () => {
  expect(validateDag(overlappingPlan)).toMatchObject({ok:false,error:{code:'WRITE_SCOPE_CONFLICT'}});
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/orchestration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Canonicalize path/glob ownership conservatively: uncertain overlaps count as conflicts. Allow overlapping writers only with explicit ordered dependency and rebase/integration lineage. Freeze plans and grants before scheduling; add phase/unit/patch/validation/report persistence.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/orchestration.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T1b: Turn chat requirements into a reviewable phase draft

**Owner:** BE planning

**Depends on:** P5-T1; P2 context; P4 qualified read-only BA role

**Files:**

- Create: `apps/runtime/src/modules/execution/orchestration/planning.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/planning.test.ts`

**Interfaces:** proposePhasePlan(input:{conversationId:string,projectId:string,requirements:string,role:RoleConfig,planningBudgetId:string,approvalId:string},signal:AbortSignal):Promise<Result<PhasePlan>>. Planning requires an explicit bounded read-only BA grant with model/effort and planning budget; it is separate from later phase execution approval. Consume P2 assembleContext and P4 startWorker; validate output with PhasePlanSchema and validateDag.

**Required named cases and assertions:** retainedIntentIncludedInDraft; ambiguousAcceptanceReturnsBlocker; generatedCycleRejected; generatedOverlappingScopesRejected; generatedPushGrantRejected; draftCannotLaunchCoders; noProviderReturnsPlanningBlockedButManualPlanAllowed

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('draftCannotLaunchCoders', async () => {
  await harness.proposePhasePlan();
  expect(harness.coderLaunches).toHaveLength(0);
  expect(harness.phaseState()).toBe('awaitingApproval');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/planning.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Collect objective, constraints and acceptance criteria from stored chat plus retained intent; let the qualified BA produce a schema-valid phase proposal. Surface missing requirements as blockers/questions, never invent resolved constraints. Distinguish brainstorming/planning approval from the concrete coding phase approval. Persist draft and its context sources; UI PhasePlanView can edit the draft, invalidating any existing grant.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/planning.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T2: Implement persistent DAG scheduling and budgets

**Owner:** BE scheduler

**Depends on:** T1; P4 startWorker/cancelWorker

**Files:**

- Create: `apps/runtime/src/modules/execution/orchestration/state-machine.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/scheduler.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/scheduler.test.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/scheduler.integration.test.ts`

**Interfaces:** createPhase(command:Command<PhasePlan>):Promise<Result<PhasePlan>>; startPhase(command:Command<{phaseId:string,approvalId:string}>):Promise<Result<{phaseId:string,state:PhaseState}>>; tickPhase(phaseId:string):Promise<void>; cancelPhase(command:Command<{phaseId:string}>):Promise<Result<{state:PhaseState}>>; getPhase(phaseId:string):Promise<Result<PhaseView>>; PhaseView {plan:PhasePlan,state:PhaseState,units:{unit:WorkUnit,state:WorkUnitState,attemptId?:string,blocker?:string}[],validations:ValidationResult[],report?:PhaseReport}; scheduler consumes prepareUnitBaseline(unitId) from T3 before launch.

**Required named cases and assertions:** twoIndependentUnitsLaunchUpToLimit; dependencyWaitsForValidatedPredecessorArtifact; concurrentTicksLaunchOnce; onlyOnePhaseRunsGlobally; budgetExhaustionStartsNoWorker; ordinaryFailureBlocksDependentsOnly; securityViolationCancelsPhaseWorkers; expiryStopsNewActions; crashLeavesInterruptedPendingDecision

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('ordinaryFailureBlocksDependentsOnly', async () => {
  await harness.failUnit('be');
  await harness.tick();
  expect(harness.state('integration')).toBe('blocked');
  expect(harness.state('independent-fe')).toBe('running');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/scheduler.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use short SQLite transactions for unit claims and budget reservation, then launch outside transactions. A phase-wide lease prevents two runtime processes scheduling the same phase. Persist transitions with expected versions; never use timer callbacks as the only state. Reviewer/tester roles are separate attempts, though the same engine may serve them. Recovery pauses scheduling for explicit BOSS decisions.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/scheduler.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/execution/orchestration/scheduler.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T3: Implement patch lineage and conflict-safe integration

**Owner:** BE integration

**Depends on:** T1; P4 worktree/policy services

**Files:**

- Create: `apps/runtime/src/modules/execution/orchestration/worktrees.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/patches.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/integration.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/integration.test.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/integration.integration.test.ts`

**Interfaces:** prepareUnitBaseline(unitId:string):Promise<Result<{worktreePath:string,baseHead:string,dependencyArtifactHashes:string[]}>>; capturePatch(attemptId:string):Promise<Result<PatchArtifact>>; integratePatch(command:Command<{phaseId:string,artifactId:string,expectedIntegrationHash:string}>):Promise<Result<{integrationHash:string,conflicts:string[]}>>; applyPhaseOutput(command:Command<{phaseId:string,expectedTargetHead:string,expectedTargetTreeHash:string}>):Promise<Result<{applied:boolean,resultTreeHash:string}>>. IntegrationHash is a content hash over baseline plus ordered patch artifacts, not an automatic Git commit.

**Required named cases and assertions:** independentWorktreesCannotOverwriteEachOther; dependentUnitGetsIntegratedPredecessorFiles; binaryPatchRoundTrips; pathOutsideOwnedScopeRejected; conflictStopsIntegration; changedTargetBaselineBlocksApply; interruptedApplyNotBlindlyRetried; duplicateApplyReturnsRecordedOutcome; noCommitOrPushCommandIssued; untrackedFixtureFileIncludedOrExplicitlyRejected

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('conflictStopsIntegration', async () => {
  const result = await harness.integrateConflictingPatch();
  expect(result).toMatchObject({ok:false,error:{code:'INTEGRATION_CONFLICT'}});
  expect(await harness.targetTreeHash()).toBe(harness.originalTreeHash);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/integration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Return verified patch artifacts including declared new files; capture binary diffs explicitly and reject unsafe paths/symlinks. Build dependency baselines by applying predecessors to a disposable unit worktree without auto commits. Apply sequentially to the integration worktree, run conflict checks first and preserve conflicting artifacts for review. Before final target apply, recheck clean branch/upstream and exact approved baseline; journal planned/started/applied actions. For partial or unknown apply, halt and compare hashes instead of replaying. Commit only through a separately explicitly requested action; push remains denied.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/integration.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/execution/orchestration/integration.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T4: Implement independent validation, lessons and dual reports

**Owner:** BE validation

**Depends on:** T2/T3; P3 lesson candidates

**Files:**

- Create: `apps/runtime/src/modules/execution/orchestration/validation.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/validation.test.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/reports.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/reports.test.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/lessons.ts`
- Create: `apps/runtime/src/modules/execution/orchestration/lessons.test.ts`

**Interfaces:** validatePhase(phaseId:string):Promise<Result<ValidationResult[]>>; finalizePhase(phaseId:string):Promise<Result<PhaseReport>>; proposeTaskLesson(input:{phaseId:string,report:PhaseReport}):Promise<Result<KnowledgeJob>>. Consume prepareUnitBaseline and P4 startWorker for tester/reviewer read-only qualified roles; consume P3 enqueueKnowledgeJob via report-source revision and approved knowledge budget. finalizePhase requires successful recorded applyPhaseOutput when delivery='apply'; a changed integrated hash invalidates all previous validation.

**Required named cases and assertions:** testsBuildLintAllRequired; reviewerFailureCannotMarkDone; testerFailureCannotMarkDone; staleValidationHashRejected; missingReportBlocksDone; agentReportListsHashesAndNextSteps; userReportExplainsConceptAndExample; lessonWithoutKnowledgeBudgetDoesNotSpend; lessonCandidateNeverAutoActive; invalidLessonRejected; requiredApplicationBlockedPreventsDone; applyCompletesBeforeReportsDone

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('reviewerFailureCannotMarkDone', async () => {
  await harness.recordReviewerFailure();
  const result = await harness.finalize();
  expect(result.ok).toBe(false);
  expect(await harness.phaseState()).not.toBe('done');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/validation.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Tie all validation to the integrated content hash. Test/build/lint commands pass through execution policy. Coder provides unit tests; tester checks missing coverage independently; reviewer returns explicit pass/fail. Generate English agent report and short Vietnamese user report from stored events/results using approved templates. Done requires both readable reports and all required gates. Lesson extraction is separate candidate work and cannot spend from an unapproved knowledge budget. After validation, authorize and apply the approved output via T3, then persist reports and transition DoneLocal. For explicit patchOnly plans, report artifact hashes instead; never silently convert an apply plan to patchOnly.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/validation.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/reports.test.ts
pnpm test:unit -- apps/runtime/src/modules/execution/orchestration/lessons.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T5: Deliver phase plan approval, progress and report navigation

**Owner:** FE

**Depends on:** T1

**Files:**

- Create: `apps/web/src/features/execution/phases/PhasePlanView.tsx`
- Create: `apps/web/src/features/execution/phases/PhaseProgressView.tsx`
- Create: `apps/web/src/features/execution/phases/PhaseReportView.tsx`
- Create: `apps/web/src/features/execution/phases/usePhase.ts`
- Create: `apps/web/src/features/execution/phases/service.ts`
- Create: `apps/web/src/features/execution/phases/PhaseProgressView.test.tsx`
- Create: `apps/web/src/features/execution/phases/PhasePlanView.test.tsx`
- Create: `apps/web/src/features/execution/phases/PhaseReportView.test.tsx`

**Interfaces:** phaseService(client) exposes propose(command:Command<{conversationId:string,projectId:string,requirements:string,role:RoleConfig,planningBudgetId:string,approvalId:string}>):Promise<Result<PhasePlan>>, create(command:Command<PhasePlan>), approve(command:Command<{planId:string,expectedVersion:number}>), start(command:Command<{phaseId:string,approvalId:string}>), get(id):Promise<Result<PhaseView>>, cancel(command:Command<{phaseId:string}>). usePhase returns DAG rows, role/model/effort configuration, budget/grant summary, blocker actions, artifacts and report links. Phase approval invokes existing P4 approvePlan; no FE-derived grant authority.

**Required named cases and assertions:** wholePhaseApprovalShowsEveryRoleAndScope; configEditInvalidatesApproval; dependentBlockedIndependentRunning; reviewerFailureShownBeforeDone; conflictHasNoSilentContinue; reportsHaveSeparateAudienceLinks; disconnectKeepsLastKnownStateMarkedStale; emptyPhaseShowsNoFalseProgress

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
it('reviewerFailureShownBeforeDone', () => {
  render(<PhaseProgressView phase={reviewerFailedPhase} />);
  expect(screen.getByText('Reviewer failed')).toBeVisible();
  expect(screen.queryByText('Phase complete')).toBeNull();
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/execution/phases/PhaseProgressView.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Present approve-once phase configuration in chat, detail/progress in a focused drawer, and concise completion/blocker response linked to artifacts. Show FE/BE parallel ownership and stepwise dependencies. Preserve the accepted chat/status/context layout; do not cram all execution detail into the viewport.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/execution/phases/PhaseProgressView.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/execution/phases/PhasePlanView.test.tsx
pnpm test:unit -- apps/web/src/features/execution/phases/PhaseReportView.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P5-T6: Prove parallel phase delivery and failure gates

**Owner:** Integrator

**Depends on:** T2–T5

**Files:**

- Create: `apps/runtime/src/modules/execution/orchestration/phase.integration.test.ts`
- Create: `tests/e2e/phase-orchestration.spec.ts`
- Create: `tools/acceptance/checks/p5.ts`
- Create: `docs/reports/P5/.gitkeep`

**Interfaces:** Register P5 checks for a throwaway FE/BE feature phase using approved models and both required qualified engines. Add zhon phase plan/approve/run/status/cancel/report CLI commands through existing ApiClient. Approval command must show exact role/model/effort and require an explicit user action.

**Required named cases and assertions:** twoCodersCompleteDisjointFeature; integrationValidationReviewerAndReportsPass; workerFailureKeepsRetryEvidence; conflictBlocksApply; budgetStopLaunchesNoExtraWorker; promptInjectionCannotChangeGrant; manualTargetEditInvalidatesApply; successfulTaskYieldsOnlyCandidateLesson

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('budgetStopLaunchesNoExtraWorker', async () => {
  await harness.exhaustBudget();
  const before = harness.launchCount;
  await harness.tick();
  expect(harness.launchCount).toBe(before);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- apps/runtime/src/modules/execution/orchestration/phase.integration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Run the real two-coder scenario plus deterministic failure scenarios. Validate exact output tree hash and reports, not merely process exit. Gate live qualification separately from fixture tests; BOSS can inspect progress, leave the laptop alone while it stays on, then read reports. Do not promise execution when the laptop sleeps or is off.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- apps/runtime/src/modules/execution/orchestration/phase.integration.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:e2e -- tests/e2e/phase-orchestration.spec.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P5 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P5 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P5/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** An approved independent FE/BE feature phase runs with bounded parallel workers, integrates without overwrite, passes tester/reviewer/local checks and produces both reports. Blockers persist with actionable next steps; failed or conflicted output never silently applies.

**Blockers and resolution:** Unclear ownership, DAG cycle, stale baseline/grant, unknown spend, engine failure, conflict or required validator failure blocks the affected gate. Ordinary failures preserve independent approved work; security failures stop the phase. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P6 tracks remote CI after BOSS's manual commit/push. Local Done remains distinct from remote CI success; P7 strengthens recovery/backup/adversarial coverage.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

