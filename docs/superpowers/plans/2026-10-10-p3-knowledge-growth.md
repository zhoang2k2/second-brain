# Knowledge Growth and Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate useful bilingual knowledge candidates from selected conversations, manual edits and later task reports within approved knowledge budgets.

**Architecture:** Durable background jobs enrich Markdown revisions without activating them. Existing P1 review and P2 provider/budget boundaries remain authoritative.

**Tech Stack:** P0–P2 stack; SQLite jobs and Gemini REST adapter

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

- Repeated source saves must not charge twice: T2 deduplication test.
- Provider disconnect after request submission retains reservation: T2 unknown-outcome test.
- An unresolved issue must remain a hypothesis: T3 lesson-state test.
- Manual enrichment must not overwrite a newer Obsidian edit: T3 stale-hash test.
- Changing model or daily budget requires a fresh grant: T4 configuration-version test.

---

## Preflight and parallel ownership

- [ ] P1 and P2 gates pass. BOSS selects a model, supported effort and knowledge batch/daily budgets. No background paid jobs before this configuration is approved.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 freezes contracts. T2 then T3 are sequential BE tasks; T4 FE can run after T1 against fixtures. T5 integrates both lanes.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P3-T1: Freeze enrichment contracts and persistence

**Owner:** Integrator

**Depends on:** P1/P2

**Files:**

- Create: `packages/contracts/src/knowledge-growth.ts`
- Create: `packages/contracts/src/knowledge-growth.test.ts`
- Create: `apps/runtime/src/storage/migrations/004-knowledge-growth.sql`
- Create: `packages/contracts/fixtures/knowledge-growth.json`

**Interfaces:** Define KnowledgeProfile {id,version,preferredTags:string[],interests:string[],explanationLevel:'foundation'|'practical',model:string,effort?:string,batchLimitUsd:number,dailyLimitUsd:number}; KnowledgeJob {id,sourceRevisionId,sourceHash,configurationVersion,status:'queued'|'running'|'candidateReady'|'blocked'|'failed'|'outcomeUnknown',budgetId,candidateId?}; LessonDraft {title,englishSummary,vietnameseExplanation,problem,approach,tradeoffs:string[],outcome:'solved'|'unsolved'|'hypothesis',sourceRefs:string[],tags:string[],links:NoteLink[]}. Export schemas and infer corresponding types. Source refs are short pointers, not detailed evidence bundles. KnowledgeGrant {id,profileId,profileVersion,model,effort?,batchLimitUsd,dailyLimitUsd,expiresAt,sourceScope:Scope}; grant issuance requires explicit BOSS confirmation. HistoricalSolution {projectId,recordedAt,outcome:'solved'|'unsolved'|'hypothesis',summary,verification:'historical'|'reverified'}; LessonDraft may include historicalSolutions:HistoricalSolution[]. These are concise note contents, not access grants to the original repository.

**Required named cases and assertions:** rejectMissingProblem; rejectUnsupportedEffort; rejectNegativeBudget; acceptUnsolvedLesson; rejectMissingVietnameseExplanation

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('acceptUnsolvedLesson', () => {
  expect(LessonDraftSchema.parse(unsolvedFixture).outcome).toBe('unsolved');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/knowledge-growth.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Create schemas, fixtures and migration for profiles, grants, jobs and job events. Source hash plus configuration version is the deduplication identity; migration never rewrites Active snapshots.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/knowledge-growth.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P3-T2: Implement durable budgeted enrichment jobs

**Owner:** BE

**Depends on:** T1; P2 provider and budget services

**Files:**

- Create: `apps/runtime/src/modules/knowledge/jobs.ts`
- Create: `apps/runtime/src/modules/knowledge/jobs.test.ts`
- Create: `apps/runtime/src/modules/knowledge/jobs.integration.test.ts`

**Interfaces:** enqueueKnowledgeJob(input:{sourceRevisionId:string,configurationVersion:number}):Promise<Result<KnowledgeJob>>; runKnowledgeJob(jobId:string,signal:AbortSignal):Promise<Result<KnowledgeJob>>; listKnowledgeJobs():Promise<KnowledgeJob[]>; stopKnowledgeScheduling(reason:string):Promise<void>. Consume GeminiAdapter.stream and P2 budget reserve/settle. Reuse Result, Command and errors from P0.

**Required named cases and assertions:** deduplicatesRepeatedSaves; reservesBatchAndDailyCapsAtomically; budgetBlockedStartsNoRequest; cancelBeforeSubmissionReleasesReservation; disconnectAfterSubmissionRetainsReservation; restartLeavesRunningOutcomeUnknown; foreignProjectSourceDenied

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('disconnectAfterSubmissionRetainsReservation', async () => {
  const job = await harness.runWithDisconnectAfterSubmission();
  expect(job.status).toBe('outcomeUnknown');
  expect(harness.budget.unresolvedUsd).toBeGreaterThan(0);
  expect(harness.provider.requests).toHaveLength(1);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/jobs.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Persist reservation and attempt before sending the paid request. Serialize source/configuration jobs using a SQLite uniqueness constraint and short transactions. Keep unknown spend reserved, require explicit reconciliation, and never automatically replay interrupted paid work.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/jobs.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- apps/runtime/src/modules/knowledge/jobs.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P3-T3: Extract useful lessons and propose evolving links

**Owner:** BE

**Depends on:** T2; P1 ingestion/review services

**Files:**

- Create: `apps/runtime/src/modules/knowledge/enrichment.ts`
- Create: `apps/runtime/src/modules/knowledge/enrichment.test.ts`
- Create: `apps/runtime/src/modules/knowledge/profile.ts`
- Create: `apps/runtime/src/modules/knowledge/profile.test.ts`

**Interfaces:** captureKnowledgeSource(input:{kind:'conversation'|'manualNote'|'taskReport',sourceId:string,scope:Scope}):Promise<Result<{sourceRevisionId:string,sourceHash:string}>> creates a local immutable source snapshot before enqueueing; only selected conversations/reports are captured. extractLesson(input:{sourceRevisionId:string,profile:KnowledgeProfile},signal:AbortSignal):Promise<Result<LessonDraft>>; proposeLessonCandidate(input:{sourceRevisionId:string,expectedSourceHash:string,draft:LessonDraft}):Promise<Result<CandidateView>>; updateKnowledgeProfile(command:Command<KnowledgeProfile>):Promise<Result<KnowledgeProfile>>. Consume P1 revision snapshots and candidate review; never call approveCandidate from enrichment. Register knowledge.profile.update, knowledge.enrich and knowledge.jobs queries. approveKnowledgeProfile(command:Command<{profileId:string,expectedVersion:number,expiresAt:string,sourceScope:Scope}>):Promise<Result<KnowledgeGrant>>.

**Required named cases and assertions:** manualEditProducesCandidate; staleHashDoesNotOverwriteSource; unsolvedLessonRemainsHypothesis; duplicateLessonLinksExistingNote; rejectsEmptyGenericLesson; unsafeMarkdownIsDataOnly; tagsGrowWithoutFolderMove; candidateNotReturnedByActiveRetrieval; oldProjectOutcomeLabeledHistoricalUntilReverified; sharedLessonIncludesProsAndConsWithoutForeignRepoRead

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('staleHashDoesNotOverwriteSource', async () => {
  const before = await harness.readCurrentSource();
  const result = await harness.proposeFromOlderRevision();
  expect(result).toMatchObject({ok:false,error:{code:'SOURCE_CHANGED'}});
  expect(await harness.readCurrentSource()).toBe(before);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/enrichment.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Validate model output against LessonDraftSchema, retain solved/unsolved distinctions and both language sections, generate short source references, and deduplicate against existing notes before creating a candidate. Suggest tags and relationships dynamically; no predefined tree, automatic file movement or global policy changes. Profile writes use expectedVersion and invalidate older generation grants. Preserve concise prior-project outcomes and observation dates; label them historical unless explicitly reverified with authorized access. Do not present an old solved outcome as proof that current source still has that fix.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/enrichment.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/knowledge/profile.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P3-T4: Deliver knowledge settings and candidate enrichment controls

**Owner:** FE

**Depends on:** T1; P1 review UI

**Files:**

- Create: `apps/web/src/features/knowledge-growth/GrowthSettings.tsx`
- Create: `apps/web/src/features/knowledge-growth/useGrowthSettings.ts`
- Create: `apps/web/src/features/knowledge-growth/service.ts`
- Create: `apps/web/src/features/knowledge-growth/GrowthSettings.test.tsx`
- Create: `apps/web/src/features/knowledge-growth/JobList.tsx`
- Create: `apps/web/src/features/knowledge-growth/JobList.test.tsx`

**Interfaces:** growthService(client:ApiClient) exposes capture(command:Command<{kind:'conversation'|'manualNote'|'taskReport',sourceId:string,scope:Scope}>):Promise<Result<{sourceRevisionId:string,sourceHash:string}>>, getProfile():Promise<Result<KnowledgeProfile>>, update(command:Command<KnowledgeProfile>):Promise<Result<KnowledgeProfile>>, enqueue(command:Command<{sourceRevisionId:string,configurationVersion:number}>):Promise<Result<KnowledgeJob>>, listJobs():Promise<Result<KnowledgeJob[]>>. useGrowthSettings returns form fields, supported model/effort choices, dirty/version state and submit actions; components render prepared view models.

**Required named cases and assertions:** showsEstimatedSpendBeforeEnqueue; changedConfigurationRequiresNewGrant; outcomeUnknownHasNoAutomaticRetry; budgetBlockedKeepsCandidateReadable; profileVersionConflictPreservesDraft; keyboardAccessibleJobActions; linksNavigateToExistingNote

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
it('outcomeUnknownHasNoAutomaticRetry', async () => {
  render(<JobList jobs={[unknownJob]} onReconcile={reconcile} />);
  expect(screen.queryByRole('button',{name:'Retry automatically'})).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'Review outcome'}));
  expect(reconcile).toHaveBeenCalledWith(unknownJob.id);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/knowledge-growth/GrowthSettings.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Add a compact settings drawer and candidate/job actions within Knowledge, plus an explicit Save as candidate action for a selected chat response via captureKnowledgeSource and enqueueKnowledgeJob. Keep existing three columns and accordion presentation. Show approved model, budget and job states without extra badge-heavy headers; no note editor.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/knowledge-growth/GrowthSettings.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/knowledge-growth/JobList.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P3-T5: Integrate a real enrichment and report the result

**Owner:** Integrator

**Depends on:** T2–T4

**Files:**

- Create: `apps/runtime/src/modules/knowledge/knowledge-growth.integration.test.ts`
- Create: `tests/e2e/knowledge-growth.spec.ts`
- Create: `tools/acceptance/checks/p3.ts`
- Create: `docs/reports/P3/.gitkeep`

**Interfaces:** Register P3 checks via registerCheck('P3',name,check). Checks require an externally configured credential reference, approved profile and bounded live request; no fake key or silently skipped live check.

**Required named cases and assertions:** selectedChatBecomesBilingualCandidate; activeContentUnchangedUntilReview; manualEditDuringGenerationBecomesStale; dailyBudgetStopsNextRequest; restartPreservesUnknownOutcome; approvedCandidateCanBeRetrievedWithSource

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('activeContentUnchangedUntilReview', async () => {
  const original = await harness.retrieveActive();
  await harness.generateCandidate();
  expect(await harness.retrieveActive()).toEqual(original);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- apps/runtime/src/modules/knowledge/knowledge-growth.integration.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Wire feature commands into the runtime registry and settings into the web navigation. Capture one bounded real generation, verify bilingual content and review behavior, and preserve usage evidence without secret values.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- apps/runtime/src/modules/knowledge/knowledge-growth.integration.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:e2e -- tests/e2e/knowledge-growth.spec.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P3 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P3 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P3/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** A selected conversation or manual Markdown change can yield a specific bilingual candidate; approval alone activates it. Dynamic tags/links grow the vault; batch and daily budgets prevent additional paid scheduling.

**Blockers and resolution:** No configured model/price/credential or unresolved spend: paid jobs BLOCKED while local read/search/review remains usable. Poor model output stays rejected/failed rather than being promoted. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P4/P5 can reuse LessonDraft and enqueueKnowledgeJob for task reports after successful execution. Do not add CLI engines here.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

