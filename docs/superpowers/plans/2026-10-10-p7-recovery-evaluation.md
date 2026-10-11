# Recovery, Backups and MVP Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved local MVP recoverable and demonstrate its safety boundaries with adversarial and failure scenarios.

**Architecture:** Recovery reconciles durable journals and current filesystem state before any replay. Backups capture a consistent SQLite snapshot plus immutable revisions and vault files; credentials remain in the OS secure store.

**Tech Stack:** Existing runtime/SQLite/Markdown; consistent SQLite backup API; file hashes; fault injection; Playwright and benchmark runner

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

- Crash after a side effect but before recording success: T2 reconciliation test.
- Vault copy lacks a trusted review database: T2 import-candidate test.
- Backup taken during a promotion misses snapshots: T2 consistency test.
- UI retry button replays an unknown paid operation: T3 decision test.
- Prompt injection or project leakage survives happy-path tests: T4 adversarial suite.

---

## Preflight and parallel ownership

- [ ] P0–P6 gates and required S1 manifests pass. Use throwaway projects/vaults and synthetic secrets for destructive/adversarial tests. BOSS approves any test requiring a real paid request; no real data deletion or restore without explicit target approval.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 freezes recovery/backup contracts. T2 BE reconciliation and T3 FE recovery UI can run in parallel against fixtures; backup work in T2 must use its own disposable state directories. T4 evaluator owns cross-feature faults and final readiness report after both lanes integrate.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P7-T1: Freeze recovery, backup and readiness contracts

**Owner:** Integrator

**Depends on:** P6

**Files:**

- Create: `packages/contracts/src/recovery.ts`
- Create: `packages/contracts/src/recovery.test.ts`
- Create: `apps/runtime/src/storage/migrations/008-recovery.sql`
- Create: `packages/contracts/fixtures/recovery.json`

**Interfaces:** Export readinessOutcome(checks:CheckRecord[]):'PASS'|'FAIL'|'BLOCKED': FAIL if any required check fails, otherwise BLOCKED if none exist or any is blocked, otherwise PASS. RecoveryItem {id,kind:'worker'|'paidRequest'|'integrationApply'|'promotion'|'terminal',resourceId,state:'interrupted'|'outcomeUnknown'|'verifiedApplied'|'safeToRetry'|'blocked',summary,allowedDecisions:('inspect'|'confirmApplied'|'retry'|'abandon')[],version:number}; RecoveryDecision {itemId,expectedVersion:number,decision:'inspect'|'confirmApplied'|'retry'|'abandon',approvalId?:string}; BackupManifest {id,schemaVersion:number,createdAt:string,files:{path:string,sha256:string,bytes:number}[],databasePath:string,containsCredentials:false}; RestorePreview {backupId,targetRoot,conflicts:string[],trustedReviewState:boolean,requiredApprovalTargetDigest:string}; ReadinessResult {phase,checks:CheckRecord[],status:'PASS'|'FAIL'|'BLOCKED'}.

**Required named cases and assertions:** unknownOutcomeHasNoUnqualifiedRetry; backupCredentialsAlwaysFalse; restoreTargetRequired; staleRecoveryVersionRejected; noPassWhenRequiredCheckBlocked

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('noPassWhenRequiredCheckBlocked', () => {
  expect(readinessOutcome([blockedCheck])).toBe('BLOCKED');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/recovery.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Add recovery decisions, backup manifests and readiness records to SQLite. Keep action journals append-only; summaries never substitute for measured filesystem/database evidence.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/recovery.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P7-T2: Implement reconciliation and consistent backup/restore

**Owner:** BE

**Depends on:** T1; earlier action journals

**Files:**

- Create: `apps/runtime/src/modules/recovery/reconcile.ts`
- Create: `apps/runtime/src/modules/recovery/reconcile.test.ts`
- Create: `apps/runtime/src/modules/recovery/reconcile.integration.test.ts`
- Create: `apps/runtime/src/modules/recovery/backup.ts`
- Create: `apps/runtime/src/modules/recovery/backup.integration.test.ts`

**Interfaces:** scanRecovery():Promise<Result<RecoveryItem[]>>; decideRecovery(command:Command<RecoveryDecision>):Promise<Result<RecoveryItem>>; createBackup(input:{destinationRoot:string}):Promise<Result<BackupManifest>>; previewRestore(input:{backupId:string,targetRoot:string}):Promise<Result<RestorePreview>>; restoreBackup(command:Command<{backupId:string,targetRoot:string,approvalId:string,expectedTargetDigest:string}>):Promise<Result<{restored:boolean,recovery:RecoveryItem[]}>>. Consume current state hashes, approval policy and SQLite backup API; restore command is a separate explicit approved mutation.

**Required named cases and assertions:** crashAfterApplyRequiresHashReconciliation; interruptedWorkerNeverAutoreplayed; paidUnknownRetainsSpend; interruptedPromotionKeepsOldActive; concurrentPromotionBackupConsistent; corruptBackupDenied; backupExcludesKeysLogsSecrets; pathTraversalInBackupDenied; rawVaultImportCreatesCandidates; trustedBackupPreservesApprovedSnapshots; restoreChangedTargetDigestDenied; backupDoesNotCopyWalFilesNaively

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('rawVaultImportCreatesCandidates', async () => {
  await harness.importVaultWithoutTrustedState();
  expect(await harness.countActive()).toBe(0);
  expect(await harness.countCandidates()).toBeGreaterThan(0);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/recovery/reconcile.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** On startup, prevent scheduling until outstanding actions are reconciled. Compare actual content hashes and journal intent before offering bounded decisions; retry needs a still-valid or fresh grant. Create the database snapshot through SQLite's consistent backup mechanism, then retain all referenced immutable revisions and hash vault copies; detect changes and retry the backup capture rather than publish inconsistent output. Restore into a previewed destination, validate manifest/path hashes and migrations, exclude credentials, and require reconfiguration of credential references. Notes copied through Git without trusted approval state re-enter Candidate; never infer Active from Markdown flags alone.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/recovery/reconcile.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/recovery/reconcile.integration.test.ts
pnpm test:integration -- apps/runtime/src/modules/recovery/backup.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P7-T3: Deliver recovery decisions, backups and readiness UI

**Owner:** FE

**Depends on:** T1

**Files:**

- Create: `apps/web/src/features/recovery/RecoveryView.tsx`
- Create: `apps/web/src/features/recovery/BackupView.tsx`
- Create: `apps/web/src/features/recovery/useRecovery.ts`
- Create: `apps/web/src/features/recovery/service.ts`
- Create: `apps/web/src/features/recovery/RecoveryView.test.tsx`
- Create: `apps/web/src/features/recovery/BackupView.test.tsx`

**Interfaces:** recoveryService(client) exposes list():Promise<Result<RecoveryItem[]>>, decide(command:Command<RecoveryDecision>):Promise<Result<RecoveryItem>>, backup(command:Command<{destinationRoot:string}>):Promise<Result<BackupManifest>>, preview(input:{backupId:string,targetRoot:string}):Promise<Result<RestorePreview>>, restore(command:Command<{backupId:string,targetRoot:string,approvalId:string,expectedTargetDigest:string}>). Hooks prepare only server-authorized decisions, target preview, affected paths and readiness rows.

**Required named cases and assertions:** unknownPaidRequestHasInspectAndAbandonOnlyUntilReconciled; staleDecisionPreservesLatestState; restoreShowsExactDestinationAndConflicts; restoreRequiresFreshTargetGrant; missingCredentialIsConfigurationBlocker; blockedCheckNotGreen; keyboardDialogsAndReducedMotion

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
it('unknownPaidRequestHasInspectAndAbandonOnlyUntilReconciled', () => {
  render(<RecoveryView items={[unknownPaidItem]} />);
  expect(screen.queryByRole('button',{name:'Retry'})).toBeNull();
  expect(screen.getByRole('button',{name:'Inspect'})).toBeVisible();
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/recovery/RecoveryView.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use focused recovery/settings views with plain actionable explanations. Show what is known, unknown, reserved spend and exact restore target. Do not make FE infer safe retries or expose secrets. Preserve context/chat access while execution is blocked.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/recovery/RecoveryView.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/recovery/BackupView.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P7-T4: Evaluate the complete MVP with adversarial scenarios and benchmarks

**Owner:** Integrator / evaluator

**Depends on:** T2/T3 and all preceding gates

**Files:**

- Create: `tools/evaluation/adversarial.integration.test.ts`
- Create: `tools/evaluation/recovery.integration.test.ts`
- Create: `tools/evaluation/benchmark.ts`
- Create: `tools/evaluation/readiness.ts`
- Create: `tools/evaluation/readiness.test.ts`
- Create: `tests/e2e/recovery.spec.ts`
- Create: `tools/acceptance/checks/p7.ts`
- Create: `docs/reports/P7/.gitkeep`

**Interfaces:** evaluateReadiness(input:{profile:string,requiredPhases:string[]}):Promise<ReadinessResult[]>; runBenchmarks(input:{notes:number,concurrency:number,iterations:number}):Promise<BenchmarkResult>; BenchmarkResult {machine:string,nodeVersion:string,noteCount:number,concurrency:number,retrievalP50Ms:number,retrievalP95Ms:number,eventLagP95Ms:number,peakRssBytes:number,failures:number}. Benchmark uses 1,000 synthetic notes, 2 workers and 30 measured retrieval iterations after 5 warmups; report measured values, do not invent production SLA.

**Required named cases and assertions:** adapterFailureRetryPreservesLogs; concurrentWorktreesDoNotOverwrite; crashNeverBlindlyRepeatsSideEffect; unauthorizedOutsideReadBlocked; repoInjectionCannotChangeSystemPolicyOrApproval; crossProjectRetrievalDenied; invalidLessonNeverActive; approvalExpiryDenied; exhaustedBudgetStartsNoWorker; reviewerFailureNotDone; conflictStopsIntegration; staleContextCannotRestoreDeactivatedNote; redactedEventsAndReports; backupRestoreThenReconcile; unsupportedSandboxFailsReadiness

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('unsupportedSandboxFailsReadiness', async () => {
  const result = await harness.evaluateWithUnsupportedSandbox();
  expect(result.status).toBe('BLOCKED');
  expect(harness.scheduledWorkers).toHaveLength(0);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- tools/evaluation/adversarial.integration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Add fault injection around every action-journal boundary and verify actual database/filesystem outcomes. Assert original repositories/outside sentinels remain unchanged; adversarial source text is treated as untrusted data. Verify scope filtering before ranking, stale context exclusion, log redaction and all original acceptance scenarios. Run qualified real-engine and bounded provider gates separately. Publish a measured baseline; initial benchmarks report values and failures, subsequent same-machine runs flag >2x p95 regression for investigation without pretending that it proves universal latency. Final readiness cannot PASS with any required FAIL/BLOCKED.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- tools/evaluation/adversarial.integration.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- tools/evaluation/recovery.integration.test.ts
pnpm test:unit -- tools/evaluation/readiness.test.ts
pnpm test:e2e -- tests/e2e/recovery.spec.ts
pnpm benchmark -- --notes 1000 --concurrency 2 --iterations 30
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P7 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P7 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P7/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** All required phase gates and original adversarial criteria pass, backup/restore is verified, unknown side effects await deliberate recovery, and both final reports show measured capability limits and unresolved blockers.

**Blockers and resolution:** Any unavailable required engine, unqualified isolation, failed live acceptance, unknown side effect, corrupt backup or missing validator prevents declaring the whole MVP ready. A benchmark number alone does not override correctness gates. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** Use final reports as the next phase's context: architecture/interfaces, exact hashes, test evidence, limitations and decisions. Cloud/remote operation, broader IDE automation, extra engines and advanced memory classification remain later scope.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

