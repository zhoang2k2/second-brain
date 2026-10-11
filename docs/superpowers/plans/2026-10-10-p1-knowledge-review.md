# P1 Knowledge Ingestion, Search and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manually authored Obsidian notes searchable and reviewable, while retrieving only exact approved revisions.

**Architecture:** Knowledge service captures immutable Markdown revisions and keeps workflow/search metadata in SQLite. A durable promotion journal coordinates filesystem writes and Active pointer changes. FE owns status columns and review presentation only.

**Tech Stack:** P0 stack; node filesystem APIs, SQLite FTS5, shared Zod schemas, FE controllers/components.

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

- Partial editor saves cannot become valid revisions — T2.
- Ambiguous renames/duplicate note IDs cannot overwrite identity — T2.
- New edits while approval is pending cannot be overwritten — T3.
- A project filter must be applied before relevance ranking — T3.
- Rejected or stale candidates remain history, not Active or primary-column clutter — T4/T5.

---

## Preflight and parallel ownership

- [ ] P0 must be Done. Register a disposable vault and two project scopes. Use fake note contents; no real outside-project directories. Apply migration 002 only through integrator; do not infer approval from Markdown frontmatter.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 freezes contracts/migration; T2 ingestion and T3 review/retrieval are sequential because T3 consumes T2 revisions. T4 FE can run alongside T2/T3 after T1. T5 integration waits for all lanes.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P1-T1: Integrator: freeze knowledge contracts and persistence schema

**Owner:** Integrator

**Depends on:** P0 Done

**Files:**

- Create packages/contracts/src/knowledge.ts and knowledge.test.ts
- Create apps/runtime/src/storage/migrations/002_knowledge.sql
- Create packages/contracts/src/fixtures/knowledge.ts

**Interfaces:** KnowledgePage {items:Array<NoteView|CandidateView>,total:number} is exported here before FE/BE lanes start. NoteView {id,path,scope,version,availability:'available'|'missing'|'unsafe',activeRevisionId?:ID}; RevisionView {id,noteId,contentHash,markdown,origin,parentRevisionId?}; CandidateView {id,revisionId,version,expectedSourceHash,state:'pending'|'approved'|'rejected'|'stale',processing:'pending'|'ready'|'failed'|'budgetBlocked',proposedLinks:NoteLink[]}; NoteLink {sourceNoteId,targetNoteId,label}; KnowledgeQuery {scope,text,column:'active'|'candidate'|'deactivated',limit}; ReviewInput {candidateId,candidateVersion,expectedSourceHash}; RetrievalHit {noteId,revisionId,excerpt,scope,sourcePath,contentHash}. Tables notes/revisions/candidates/promotions/topics/links/FTS; public responses omit raw local secrets. NoteView also includes sharedWithProjectIds:string[] (default empty). ShareInput {noteId,expectedVersion,expectedActiveHash,projectIds:string[]}; sharing metadata is runtime-managed, never trusted from unapproved frontmatter.

**Required named cases and assertions:** review_requires_exact_version_and_hash; retrieval_scope_is_validated; import_does_not_trust_active_frontmatter; fixtures_include_old_active_plus_pending_replacement.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: 1 }).success).toBe(false);
expect(fixtures.pendingReplacement.revisionId).not.toBe(fixtures.activeHit.revisionId);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/knowledge.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Derive TS types from exact schemas; migration unique constraints on revision hash per note and one candidate per captured source revision; FTS references approved revisions only. Register handlers in integration task, not here.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/knowledge.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P1-T2: BE: stable ingestion and immutable note identity

**Owner:** BE ingestion

**Depends on:** P1-T1

**Files:**

- Create apps/runtime/src/modules/knowledge/{ingestion,repository,revision-store}.ts
- Create apps/runtime/src/adapters/filesystem/vault-watcher.ts
- Test apps/runtime/src/modules/knowledge/ingestion.test.ts and revision-store.test.ts

**Interfaces:** captureNote({vaultId,path}): Promise<Result<{note:NoteView,revision:RevisionView,candidate:CandidateView}>>; rescanVault(vaultId): Promise<{captured:number,blocked:number}>; writeRevisionSnapshot(noteId, markdown): Promise<{revisionId,path,contentHash}>. Supports existing flat zhon_id property only; assigns provisional local identity when absent. Creating a permanent property is a reviewed proposed edit, not a silent write.

**Required named cases and assertions:** stable_save_creates_candidate, repeated_bytes_deduplicate, incomplete_yaml_blocked, ambiguous_rename_flagged, duplicate_ids_flagged, symlink_escape_denied, deleted_source_excluded, startup_rescan_finds_missed_change. Cap individual source at 1 MiB and show NOTE_TOO_LARGE; debounce test uses fake timers and stable repeated reads.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
const first = await fixture.capture('note.md');
const second = await fixture.capture('note.md');
expect(second.value.revision.id).toBe(first.value.revision.id);
expect(await fixture.candidateCount()).toBe(1);
expect((await fixture.capture('escape.md')).error.code).toBe('PATH_OUT_OF_SCOPE');
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/ingestion.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Capture bytes/hash before indexing; use registered realpath boundaries. Snapshots live under runtime-owned revision data, not arbitrary vault reorganization. Missing/unsafe source immediately becomes ineligible for new retrieval. Preserve failed captures as safe diagnostics, not knowledge.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/ingestion.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/knowledge/revision-store.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P1-T3: BE: exact review, scoped search and crash-safe promotion

**Owner:** BE review

**Depends on:** P1-T2

**Files:**

- Create apps/runtime/src/modules/knowledge/{review,retrieval,promotion,routes}.ts
- Test apps/runtime/src/modules/knowledge/review.test.ts, retrieval.test.ts, promotion.test.ts

**Interfaces:** approveCandidate(input:ReviewInput): Promise<Result<NoteView>>; rejectCandidate(input:ReviewInput): Promise<Result<NoteView>>; deactivateNote({noteId,expectedVersion}): Promise<Result<NoteView>>; rollbackNote({noteId,revisionId,expectedVersion}): Promise<Result<NoteView>>; searchKnowledge(query:KnowledgeQuery): Promise<Result<KnowledgePage>>; KnowledgePage {items:Array<NoteView|CandidateView>,total:number}; retrieveActive({scope,text,limit}): Promise<RetrievalHit[]>; reconcilePromotions(): Promise<{completed:number,blocked:number}>. shareNote(input:ShareInput):Promise<Result<NoteView>> requires explicit BOSS action against the exact approved revision/hash and only broadens note retrieval, never repository filesystem grants.

**Required named cases and assertions:** old_active_survives_edit_or_rejection, stale_hash_refuses_approval, concurrent_approval_single_winner, interruption_before_pointer_keeps_old_active, source_cas_preserves_new_manual_edit, cross_project_private_hit_never_returned, deactivation_excludes_next_query, malformed_fts_query_safe. Rollback reselects an exact previously approved revision only through explicit command/version checks.; foreignProjectDeniedUntilExplicitShare; sourceRepositoryStillDeniedAfterNoteShare

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
await fixture.editActiveNote('new content');
expect((await fixture.retrieve('old')).at(0)?.revisionId).toBe(fixture.oldRevisionId);
expect((await fixture.approveAfterConcurrentEdit()).error.code).toBe('STALE_CANDIDATE');
expect(await fixture.sourceContents()).toBe('latest manual edit');
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/review.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Filter eligibility/scope before FTS ranking, then excerpt approved snapshots. Journal intent/snapshot/source-CAS/pointer-completion, reconcile interrupted writes deterministically. Sanitize user-controlled errors and FTS input. Audit approval/rejection/deactivation; no auto promotion after reimport.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/knowledge/review.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/knowledge/promotion.test.ts
pnpm test:unit -- apps/runtime/src/modules/knowledge/retrieval.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P1-T4: FE: three-column knowledge review

**Owner:** FE

**Depends on:** P1-T1

**Files:**

- Create apps/web/src/features/knowledge/{KnowledgeView,KnowledgeColumn,NoteAccordion,CandidateReview,RevisionDiff}.tsx
- Create apps/web/src/features/knowledge/{useKnowledge,view-model,service}.ts and knowledge.css
- Test apps/web/src/features/knowledge/KnowledgeView.test.tsx and CandidateReview.test.tsx

**Interfaces:** KnowledgeView({scope}); useKnowledge(scope): {columns,query,pending,error,setQuery,approve,reject,deactivate,rollback}; service uses searchKnowledge/approveCandidate/rejectCandidate/deactivateNote commands. columns are prepared view elements outside JSX. UI label Deactive maps to storage state deactivated; rejected/stale review history is accessible separately. The review drawer offers an explicit share action invoking ShareInput; no automatic cross-project sharing.

**Required named cases and assertions:** search_filters_all_columns, labels_and_colors_are_lime_sky_neutral, accordion_keyboard_smooth_reduced_motion, stale_approval_requires_refresh, pending_submit_prevents_double_click, previous_active_visible_during_review, markdown_html_script_and_unsafe_links_not_executed.; shareActionShowsExactRevisionAndTargetProjects

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
await user.type(screen.getByRole('searchbox', { name: 'Search knowledge' }), 'retry');
await user.click(screen.getByRole('button', { name: 'Approve', exact: true }));
expect(await screen.findByText('This candidate changed. Refresh before approving.')).toBeVisible();
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/knowledge/KnowledgeView.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use the approved columns/accordion layout with minimal badges/descriptions, exact status names and explicit pending/error/empty states. Escape raw HTML and restrict rendered Markdown links. No note authoring editor; reviewed content/diff/metadata visible together.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/knowledge/KnowledgeView.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/knowledge/CandidateReview.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P1-T5: Integrator: real vault-to-review flow and reports

**Owner:** Integrator + independent validation

**Depends on:** P1-T3 + P1-T4

**Files:**

- Modify runtime route registration and apps/web/app/page.tsx to mount knowledge view
- Create tests/integration/knowledge-flow.test.ts and tests/e2e/knowledge-review.spec.ts
- Register P1 acceptance and write docs/reports/P1/<run-id>/{agent.md,user.vi.md}

**Interfaces:** Register GET /v1/knowledge and commands approveCandidate/rejectCandidate/deactivateNote/rollbackNote with protected local session/version checks. Integration harness uses a real temporary vault and actual SQLite, no provider. Register shareNote command with exact revision/hash checks.

**Required named cases and assertions:** manual_save_candidate_then_active, manual_edit_keeps_old_active, rejected_candidate_not_reactivated_on_restart, restart_during_promotion_preserves_source, project_a_cannot_query_project_b_private, search_without_model.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
await fixture.writeVaultNote('retry.md', 'A saved lesson');
await expect(page.getByRole('region', { name: 'Candidate notes' })).toContainText('retry');
await fixture.approveCurrentCandidateThroughUI(page);
expect((await fixture.retrieveActive()).length).toBe(1);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- tests/integration/knowledge-flow.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Mount real contracts and run interruption/scope scenarios before reports. Record snapshot retention/backup requirements for P7; do not mark identity ambiguity as successful ingestion.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- tests/integration/knowledge-flow.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:e2e -- tests/e2e/knowledge-review.spec.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P1 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P1 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P1/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** Real Markdown edits, exact review and scoped approved search work end to end. Stale/invalid candidates cannot promote; old Active content and source edits are protected; both reports exist.

**Blockers and resolution:** Unregistered vault permissions, ambiguous identity, unsafe paths or promotion recovery failures. Show Candidate/source issue and preserve original data; resolve identity/access explicitly before marking the affected capability Done. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P2 consumes retrieveActive and immutable revision IDs. P3 consumes CandidateView/review pipeline; neither can activate a Candidate without the P1 approval command.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

