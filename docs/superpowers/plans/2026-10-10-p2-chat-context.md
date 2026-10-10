# P2 Gemini Chat, History and Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide real Gemini conversations with isolated history, approved knowledge, retained intent and exact day-based navigation.

**Architecture:** Persist full messages separately from assembled ContextSnapshot. A trusted Keychain/auth adapter sends model requests, while budgets reserve cost before dispatch. FE consumes durable completion/state events and transient stream chunks.

**Tech Stack:** P0/P1 stack; Gemini REST over fetch, macOS Keychain adapter, SSE; no OpenAI API credits assumed.

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

- Absent/invalid Keychain access never becomes a leaked key in an error — T2.
- Concurrent paid calls cannot over-reserve one budget — T2.
- A context summary must preserve retained intent and full stored history — T3.
- Out-of-order/duplicate stream events cannot duplicate messages — T4.
- Day jumps use the first chronological message in BOSS timezone, including DST-safe date conversion — T4/T6.

---

## Preflight and parallel ownership

- [ ] P1 Done. BOSS configures Gemini key through Settings and explicitly selects a supported model, effort if supported and conversation budget. Verify provider token/capacity/pricing metadata. Live acceptance uses a bounded paid fixture conversation; unit tests use fake secrets.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 contract gate first. T2 budget/auth and T3 chat/context are sequential. T4 FE can parallelize with T2/T3 after T1. T5 allowance UI and T6 integration follow frozen status contracts and do not edit conversation lane files.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### P2-T1: Integrator: conversations, context and provider contracts

**Owner:** Integrator

**Depends on:** P1 Done

**Files:**

- Create packages/contracts/src/{conversations,providers,budgets}.ts and conversations.test.ts
- Create packages/contracts/src/fixtures/conversations.ts
- Create apps/runtime/src/storage/migrations/003_conversations_budgets.sql

**Interfaces:** Conversation {id,scope,providerId,model,effort?,budgetId,version}; Message {id,conversationId,role:'user'|'assistant',content,state:'pending'|'streaming'|'complete'|'interrupted'|'failed',createdAt}; ContextSnapshot {id,conversationId,version,summary,retainedIntent,recentMessageIds,knowledge:RetrievalHit[],tokenCount,tokenAccuracy:'measured'|'estimated'|'unknown',capacity}; BudgetScope {id,kind:'conversation'|'knowledge'|'phase',limitUsd,spentUsd,reservedUsd,unresolvedUsd}; ProviderCapabilities {models:{id,contextCapacity,maxOutputTokens,effortOptions:string[]}[],streaming:boolean,usage:boolean}; AllowanceView {providerId,windows:{kind:'5h'|'1w',availability:'available'|'unsupported'|'unknown'|'stale',usedPercent?:number,resetsAt?:Instant,fetchedAt?:Instant}[]}. SendMessageInput {conversationId,text,expectedVersion}; ContextEditInput {conversationId,retainedIntent,expectedVersion}.

**Required named cases and assertions:** context_has_exact_revision_sources, unsupported_effort_rejected, unknown_metrics_not_zero, budget_limit_required_before_request.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
expect(AllowanceViewSchema.parse(fixtures.unknownAllowance).windows[0].usedPercent).toBeUndefined();
expect(SendMessageInputSchema.safeParse({ conversationId: 'c1', text: 'hello' }).success).toBe(false);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- packages/contracts/src/conversations.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Add exact schemas/events message.delta/message.completed/message.interrupted/context.updated/budget.blocked. Stream delta includes messageId and chunk sequence; completed message identity is stable.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- packages/contracts/src/conversations.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P2-T2: BE: credentials, capabilities and atomic cost reservations

**Owner:** BE auth/budget

**Depends on:** P2-T1

**Files:**

- Create apps/runtime/src/adapters/keychain/{credential-store,redaction}.ts and providers/{gemini,capabilities}.ts
- Create apps/runtime/src/modules/budgets/{service,repository}.ts
- Test apps/runtime/src/adapters/keychain/credential-store.test.ts and modules/budgets/service.test.ts

**Interfaces:** CredentialStore {save(providerId,key):Promise<void>,use<T>(providerId,operation:(key:string)=>Promise<T>):Promise<T>,remove(providerId):Promise<void>}; GeminiAdapter {capabilities():Promise<ProviderCapabilities>,stream(request:ModelRequest,signal:AbortSignal):AsyncIterable<ModelChunk>}; ModelRequest {model,effort?,messages:{role,content}[],maxOutputTokens}; ModelChunk {kind:'delta'|'usage'|'complete',text?,inputTokens?,outputTokens?,requestId?}; reserveCost({budgetId,operationId,maxUsd}): Result<{reservationId}>; settleCost({reservationId,actualUsd?,outcome:'known'|'unknown'}): Result<BudgetScope>.

**Required named cases and assertions:** key_not_in_prompt_logs_reports, locked_keychain_safe_error, missing_key_blocks_call, max_output_bounds_reservation, parallel_reservation_refuses_excess, unknown_charge_stays_reserved, unsupported_model_or_effort_refused. Money arithmetic uses integer micro-USD internally, not floating-point balance updates.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
const reservations = await Promise.all([fixture.reserve(0.7), fixture.reserve(0.7)]);
expect(reservations.filter(result => result.ok)).toHaveLength(1);
await fixture.interruptDispatchedRequest();
expect(fixture.budget().unresolvedUsd).toBeGreaterThan(0);
expect(fixture.loggedText()).not.toContain(fixture.fakeKey);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/budgets/service.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use macOS Keychain through a qualified native boundary with no key in shell arguments/stdout. If a secure bridge cannot be qualified, live auth is Blocked; no plaintext fallback. Explicit fetch allowlist, timeouts and bounded output; redact structured errors before persistence.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/budgets/service.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/adapters/keychain/credential-store.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P2-T3: BE: isolated chat and context compaction

**Owner:** BE conversations

**Depends on:** P2-T2

**Files:**

- Create apps/runtime/src/modules/conversations/{service,repository,context,compaction,routes}.ts
- Test apps/runtime/src/modules/conversations/{service,context,compaction}.test.ts

**Interfaces:** createConversation({scope,providerId,model,effort?,budgetId}): Promise<Result<Conversation>>; sendMessage(input:SendMessageInput): Promise<Result<{messageId}>>; cancelMessage({messageId}): Promise<Result<Message>>; editRetainedIntent(input:ContextEditInput): Promise<Result<ContextSnapshot>>; assembleContext(conversationId): Promise<Result<ContextSnapshot>>; listMessages({conversationId,beforeId?,limit}): Promise<Message[]>; summarizeContext(conversationId): Promise<Result<ContextSnapshot>>. Uses P1 retrieveActive and P2 reservation/Gemini interfaces.

**Required named cases and assertions:** conversation_scope_isolated, private_note_never_in_prompt, retained_intent_outside_summary, original_history_not_deleted, summary_failure_blocks_next_call, context_overflow_not_silent_truncation, stream_abort_keeps_partial_message, restart_unknown_request_not_resent. Start compaction at 80% of supported input capacity, reserve output space; user-owned retained intent cannot be dropped to fit.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
await fixture.compactLongConversation();
expect(fixture.context().retainedIntent).toBe(fixture.originalIntent);
expect(await fixture.messageCount()).toBe(fixture.originalMessageCount);
expect(fixture.sentContext()).not.toContain('project-b-private');
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/runtime/src/modules/conversations/context.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Persist user input and assistant attempt before dispatch; update durable complete/interrupted state after collecting usage. Reference snapshots by exact revisions, check eligibility on each new request and surface conflicts. Context includes policy separately from untrusted quoted note data; raw HTML/repo instructions cannot modify runtime authority.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/runtime/src/modules/conversations/context.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/conversations/service.test.ts
pnpm test:unit -- apps/runtime/src/modules/conversations/compaction.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P2-T4: FE: real chat, retained intent and first-message day rail

**Owner:** FE conversations

**Depends on:** P2-T1

**Files:**

- Create apps/web/src/features/conversations/{ChatView,MessageList,Composer,HistoryRail,ContextCard,ContextDrawer,ModelDialog}.tsx
- Create apps/web/src/features/conversations/{useConversation,view-model,history,service}.ts and conversations.css
- Test apps/web/src/features/conversations/{ChatView,ContextCard,HistoryRail}.test.tsx

**Interfaces:** useConversation(id): {messages,context,send,cancel,editIntent,error,pending}; groupHistoryDays(messages,timeZone): {dayKey,displayDate,firstMessageId}[]; scrollToDay(dayKey,groups,messageViewport): void; composeChatViewModel(state): prepared elements. Default timezone Asia/Ho_Chi_Minh; tooltip DD/MM/YYYY. Paginated earlier history must load through listMessages before jumping.

**Required named cases and assertions:** duplicate_delta_not_duplicate_message, failed_send_preserves_draft, cancel_keeps_partial, retained_intent_version_conflict_visible, history_uses_first_message_per_local_day, earlier_page_loaded_before_jump, context_management_has_focus_return. Keyboard dialog/drawer close and reduced motion exercised.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
expect(groupHistoryDays(fixtures.messages, 'Asia/Ho_Chi_Minh')[0].firstMessageId).toBe(fixtures.firstLocalDayMessageId);
await user.click(screen.getByRole('button', { name: 'Manage', exact: true }));
expect(screen.getByRole('textbox', { name: 'Retained intent' })).toHaveValue(fixtures.intent);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/conversations/HistoryRail.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use accepted rounded Chat/Statusline/Context section layout, shared max content width 1280px, chat height >50vh, body-only footer and hidden scrollbars. Context card lives below status row; drawers are detail surfaces with Hugeicons close controls and focus management.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/conversations/HistoryRail.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/web/src/features/conversations/ChatView.test.tsx
pnpm test:unit -- apps/web/src/features/conversations/ContextCard.test.tsx
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P2-T5: FE/BE status adapter lane: honest allowance cards

**Owner:** Status lane; disjoint provider-status paths

**Depends on:** P2-T1

**Files:**

- Create apps/runtime/src/modules/integrations/allowance-service.ts and allowance-service.test.ts
- Create apps/web/src/features/integrations/status/{AllowanceCard,AllowanceGrid}.tsx and view-model.ts
- Test apps/web/src/features/integrations/status/AllowanceCard.test.tsx

**Interfaces:** getAllowances(): Promise<AllowanceView[]> initially returns unknown/unsupported unless an authorized real source exists. AllowanceCard({view:AllowanceView}); AllowanceGrid({views}). Cards show provider name, 5h/1w bars and reset times only. Unknown values omit numeric percentage; stale values labeled as stale. Runtime card data never derives subscription windows from Gemini usage.

**Required named cases and assertions:** unknown_not_rendered_zero, unsupported_window_no_fake_reset, stale_data_labelled, invalid_percent_rejected, equal_width_cards, status_section_caps_at_75vh. Configure stale threshold per source; absent source policy defaults unknown, not infinite freshness.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```tsx
render(<AllowanceCard view={fixtures.unknownAllowance} />);
expect(screen.queryByText('0%')).not.toBeInTheDocument();
expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- apps/web/src/features/integrations/status/AllowanceCard.test.tsx`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Publish GET /v1/allowances through integrator registration. Keep card columns equal; source qualification can be enhanced in P4. No fabricated connected-engine state.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- apps/web/src/features/integrations/status/AllowanceCard.test.tsx` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:unit -- apps/runtime/src/modules/integrations/allowance-service.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### P2-T6: Integrator: live provider/context acceptance

**Owner:** Integrator + independent validation

**Depends on:** P2-T3 + P2-T4 + P2-T5

**Files:**

- Modify shared route/UI registration and packages as integrator only
- Create tests/integration/chat-context.test.ts and tests/e2e/chat-context.spec.ts
- Register bounded live P2 acceptance; write docs/reports/P2/<run-id>/{agent.md,user.vi.md}

**Interfaces:** Register createConversation/sendMessage/cancelMessage/editRetainedIntent commands; GET messages/context/allowances; SSE streams use P0 event cursor. Live provider check obtains credential through CredentialStore; no test code prints it.

**Required named cases and assertions:** live_authenticated_chat, scoped_knowledge_answer_with_sources, long_context_preserves_retained_intent, restart_keeps_history_without_resend, history_scroll_alignment_real_browser, invalid_key_and_budget_block_visible.

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
await fixture.sendBoundedLiveMessage();
expect(fixture.recordedLiveResult().status).toBe('PASS');
await fixture.inspectPersistedContext();
expect(fixture.persistedSources()).toEqual(fixture.expectedActiveRevisionIds);
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:integration -- tests/integration/chat-context.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Run fixtures first, then explicit bounded live provider acceptance. Record usage, context/source identities and exact model metadata. Missing credential/pricing/capacity is BLOCKED, not skipped PASS.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:integration -- tests/integration/chat-context.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:e2e -- tests/e2e/chat-context.spec.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- P2 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- P2 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/P2/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** Live Gemini chat, isolated history, contextual Active-note retrieval, protected retained intent, first-message day navigation and honest status cards pass real acceptance; both reports persisted.

**Blockers and resolution:** Missing/locked credentials, unqualified secure Keychain bridge, unsupported model metadata, unknown pricing or conversation budget. Keep offline knowledge available and block paid dispatch until resolved. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P3 receives shared Candidate/ContextSnapshot/Gemini/Budget interfaces, conversation completion events and qualified secret boundary.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.

