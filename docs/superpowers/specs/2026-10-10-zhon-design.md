# Zhon product and architecture design

Status: approved by BOSS on 2026-10-10 for writing detailed phase plans. Product implementation is not authorized by this approval. UI v5 and Web/Runtime/CLI boundaries are accepted. Proposed defaults below are the planning baseline; live capability/configuration gates still require evidence before execution.

## 1. Purpose and acceptance scenarios

Zhon is BOSS's personal second brain and control plane for existing AI engines. Learning updates knowledge, relationships, and practical experience, not model weights. The product should remain useful for reading and searching when no model is available.

The MVP must support:

1. Brainstorm and plan Phase 1 for Project A, execute an approved scope, and return an English agent report plus a Vietnamese learning/report document.
2. Execute an approved Phase 2 while BOSS is away, coordinating independent work and surfacing genuine blockers rather than silently repairing or expanding scope.
3. Retrieve an approved lesson from Project C for a relevant Project A issue, explain its applicability and trade-offs, and distinguish historical knowledge from newly verified source facts.

Deliver the second-brain flows first. See [feature delivery map](2026-10-10-zhon-delivery-map.md). This is a multi-subsystem product; each feature phase requires its own execution-ready implementation plan after design review.

## 2. Confirmed boundaries

| Area | MVP requirement |
| --- | --- |
| User and hosting | One user, current macOS laptop, local browser application |
| Source synchronization | Manual Git synchronization by BOSS |
| Knowledge | New Obsidian-compatible Markdown vault in its own repository; engineering and personal knowledge |
| Provider | Gemini Developer API through Google AI Studio, billing enabled |
| Coding engines | Codex and Antigravity CLI; exact installed capabilities must be qualified |
| Later | Claude Code, local models, server/cloud hosting, IDE GUI automation |
| Execution | One executing phase globally, parallel independent work units inside it |
| Authorization | BOSS approves the whole phase's immutable plan/configuration; no automatic scope expansion |
| Git | No commit without an explicit request; no push; no protected-branch merge |
| Secrets | Worker access denied; project env reads restricted to the explicitly allowed `env.example` |
| Learning | All new/edited notes become Candidates; only approved Active revisions enter retrieval |
| Failure | No automatic repair loop; affected work and dependents stop, unrelated approved work may continue |

The configured Gemini credential is an exception for the trusted authentication boundary, not permission for a worker/model to inspect credentials. Codex Plus is not assumed to provide OpenAI API credits.

## 3. Existing repository facts

- Current source is a Create Next App scaffold, not an implemented orchestrator.
- Declared versions: Next.js 16.4.0, React/React DOM 19.3.0, pnpm 10.24.0, TypeScript ^5, Tailwind ^4.
- Observed shell Node version: 22.19.0. This is not yet a qualified production runtime selection.
- Existing scripts: dev, build, start, lint. There is no declared unit-test script or `.github` directory.
- `pnpm --version` tried to populate Corepack's cache and failed under filesystem permissions. No dependency installation was completed; use the declared version as an input to P0 qualification.
- Current changes are brainstorming documents and `.gitignore` excluding visual companion files. No commit or push has been performed.
- Before future Next.js code changes, read the installed `node_modules/next/dist/docs/` guides required by AGENTS.md. Do not replace pinned versions with assumed latest releases.

## 4. Application and package architecture

Use a modular monolith runtime: one application with feature modules, not microservices. Web and CLI are clients of the same backend.

```text
apps/
  web/
    app/                         route/layout composition; integrator-owned
    src/features/
      shell/                     navigation, themes, layout
      conversations/             chat, history, context controls
      knowledge/                 search, status columns, candidate review
      execution/                 plans, approvals, runs, blockers
      terminals/                 body drawer, sessions, pane layout
      integrations/              allowance cards and CI results
    src/components/              genuinely shared presentation components
    src/lib/api/                 transport client; no execution authority
  runtime/
    src/modules/
      projects/
      conversations/
      knowledge/
      jobs/
      execution/
      policy/
      budgets/
      reports/
      integrations/
    src/adapters/                provider, engine, filesystem, Git, Keychain, CI
    src/storage/                 migrations, SQLite access
    src/server/                  API/event/session entry points
  cli/
    src/commands/                thin zhon commands
packages/
  contracts/                    validated commands, responses, events, fixtures
docs/
  superpowers/specs/
  superpowers/plans/             created after written-design approval
  reports/
```

Paths are proposed future paths; they do not describe existing application files. Do not pre-create empty feature packages. Create each feature directory when delivering it.

Dependency direction:

```text
Web presentation -> feature controller/hook -> API service -> runtime API
CLI command -> runtime API
Runtime API -> use case -> storage/adapters
Web, CLI, runtime -> contracts
Contracts -> schema dependency only; never Web/runtime/storage imports
```

Within a BE feature, start with `routes.ts`, `service.ts`, `repository.ts`, and adjacent tests when each responsibility exists. Keep state-transition logic pure where practical. Add separate policy/state files only when useful; avoid compulsory controller/interface/factory layers for every operation.

Within FE, compute derived view models and rendered lists outside JSX. Components receive prepared content/state/actions. Components do not call a raw transport client or evaluate permissions independently of runtime decisions. Simple presentation handlers may delegate to a controller.

## 5. Communication and ownership

Proposed transports:

- Local HTTP commands/queries for Web and CLI.
- Persisted event stream delivered over SSE for chat/job/run state; reconnect from a sequence cursor or resnapshot if the cursor is unavailable.
- WebSocket for bidirectional terminal data; terminal byte chunks are separate from durable state events.

Use validated envelopes with `requestId`, typed payload, response status, and a safe error code. State-changing commands include an idempotency key and expected resource version. Retrying the same authorized mutation returns its previous result rather than duplicating it. An idempotency key does not make arbitrary external commands exactly-once.

A durable event includes `sequence`, `type`, `resourceId`, optional project/conversation/run IDs, UTC timestamp and redacted payload. Record state mutation and its event in one SQLite transaction. Streaming chunks may be transient; completed/interrupted messages must be durable.

The runtime alone owns DB writes. Models/workers return artifacts and proposed actions. The runtime validates them before accepting any state transition.

Binding to localhost is insufficient authorization by itself. Proposed local-session protection: an unguessable session secret, exact origin/host validation, protected mutations, origin checks on WebSockets, no wildcard CORS, and no secrets in URLs. Bootstrap the browser through a one-time local session flow, not a provider API key. This boundary requires tests before enabling privileged actions.

## 6. Component responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| Conversations | History, selected model, context assembly, message state | Filesystem commands or memory activation |
| Knowledge | Ingestion, revisions, Candidates, Active pointers, scoped retrieval | Execution permissions or global policy editing |
| Jobs | Durable job queue and leases for knowledge processing | Independent approval or budget increases |
| Execution | Phase state, DAG scheduling, attempts, integration stages | Model-generated authority |
| Supervisor | Qualified sandbox processes, timeouts/cancellation, output collection | Treating a worktree as a sandbox |
| Policy | Action/target checks, approval validation, deny rules | Trusting repository text as policy |
| Budgets | Reservations, usage settlement, unresolved charges | Pretending unknown consumption is zero |
| Reports | Two report artifacts from recorded outcomes | Turning failures into Done |
| Integrations | Capability-specific Gemini/CLI/CI access and status | Inventing allowance metrics |

## 7. Knowledge content and review

Markdown is portable knowledge content. SQLite holds workflow metadata, approved revision pointers, search indexes, chat history and execution records. The latest edited Markdown file is not automatically the approved retrieval source.

The detailed logical data design is in [data and lifecycles](2026-10-10-zhon-data-lifecycles.md).

Proposed revision flow:

1. Watch registered vault paths; debounce stable saves and rescan at startup. Ignore temporary files and reject paths escaping the registered vault.
2. Capture an immutable Markdown revision and content hash. Repeated identical content creates no duplicate Candidate.
3. New note/edit creates a Candidate. Existing Active content remains eligible while a newer revision waits.
4. Background enrichment uses the approved knowledge profile and independent budget. Its output is another exact proposed revision, not an instruction to promote.
5. Show the exact content/diff, origin and topic/link changes together for one review.
6. Approval validates Candidate/version/hash and source expectations before replacing the Active pointer. Reject preserves prior Active content. Deactivate immediately excludes the note from future retrieval.

Store immutable revision snapshots as Markdown in local runtime data. BOSS's Obsidian file remains the authored/latest vault content. When enrichment approval writes a proposed revision back to that file, use compare-and-swap against the captured source hash; never overwrite a newer manual edit.

Filesystem and SQLite updates are not one transaction. A small persisted promotion/write operation records intent, snapshot, expected source and completion stage. Crash reconciliation completes or blocks it before exposing a new Active pointer. Previous Active content stays valid until promotion finishes. Rollback requires BOSS's explicit selection of an exact previous revision; retain its audit record.

Proposed note identity: generated ID in flat Markdown properties, added only through a reviewed change. For notes without an ID, keep a local provisional ID/path/hash mapping; do not guess ambiguous rename identity. Duplicate IDs are review blockers. Missing source files are marked unavailable and excluded from future retrieval until BOSS resolves them.

Topics grow through approved tags and wikilinks. Do not build a fixed subject hierarchy. Automatic physical folder reorganizations are excluded from initial delivery; current authored paths remain stable. A graph explorer is a later presentation option, not a prerequisite for search and useful connections.

New device/vault imports default to Candidate. Manually synchronized Markdown metadata cannot silently grant Active state or execution authority. Local DB and revision backups are separate from Git synchronization of Markdown/source.

## 8. Retrieval and context integrity

Apply scope constraints before search/ranking. Eligible sources are Active global/shared knowledge and the current project. Project-specific notes from another project require explicit sharing/permission; raw access to that project's repository remains denied.

Then use FTS5, rank relevant candidates, deduplicate by revision, flag contradictory content and select excerpts within a context budget. Do not silently reconcile conflicting facts by picking the newest text. Include note/revision/source labels as reference data. Initial retrieval is lexical; embeddings are deferred unless evaluation shows a concrete recall gap.

Chat history is stored in full independently of the model input. A ContextSnapshot records the summary, retained intent, selected note revisions, recent message range, estimated/measured token count and model capacity. Model capacity and token estimates must be capability-specific.

Proposed compaction behavior: generate a summary before approaching a configured context limit; keep BOSS's retained intent outside that summary; retain original messages for inspection. Summary generation consumes the chat budget. If compaction fails or retained content cannot fit, pause the next request and show the issue. Do not claim that retaining text guarantees a model will follow it or that a summary is lossless.

Deactivation affects future context construction. Existing recorded messages/snapshots remain historical records; an ongoing request cannot be made to forget data already sent. Mark stale context so BOSS can rebuild before the next request.

## 9. Providers, capabilities and costs

Separate model API adapters from coding engine adapters. They share provider identity and safe events, not a fictitious common command interface.

- Model API capabilities: streaming, token usage, context capacity, effort options, cancellation, supported models.
- CLI capabilities: programmatic session lifecycle, tool approval boundary, structured output, isolated auth/config, process containment, recovery and usage visibility.
- Only expose choices supported by the installed version. An unsupported effort setting must be rejected, not ignored.
- Authentication secrets live in macOS Keychain and a trusted authentication boundary. Never copy the entire shell environment to a worker.

Budget scopes: execution phase, background knowledge profile, and proposed explicit conversation session budget. Settings must show which scope a model request charges. No user-facing card needs to show every accounting field.

Proposed background profile limits are per batch with a daily aggregate ceiling, configurable by BOSS; no default money allowance is implied. Reserve bounded estimated cost before dispatch, settle against reported usage, and keep uncertain costs reserved after interruption until reconciliation. Limit enforcement controls new requests; it cannot promise that provider billing becomes exactly zero at the instant a threshold is crossed.

Allowance cards show 5h/1w usage and reset time only if that provider/integration exposes those windows. Unknown/stale/unsupported metrics are explicit. Do not derive a 5h subscription limit from API token counts. All current wireframe numbers are examples.

## 10. Agent execution and safety

Detailed lifecycle transitions and fail-closed behavior are in [data and lifecycles](2026-10-10-zhon-data-lifecycles.md).

An approved plan fixes: objective, project/branch/base SHA, work units/dependencies, write ownership, role, engine/model/effort, permissions, budget, expiration and acceptance checks. Approve the entire phase once. Expected outputs of dependencies are described as lineage within that plan; unrelated baseline/configuration drift requires new approval.

Proposed approvals require BOSS to choose an expiry; no silent unlimited validity. Check at every execution boundary. Expiration/revocation prevents new actions and requests cancellation of workers that could continue side effects. Preserve already observed effects and mark uncertain outcomes; never assume rollback or a kill request succeeded.

Single repository per phase. Fetch only from its registered remote. Proposed strict upstream default: target HEAD equals its configured upstream after fetch, with clean working state and unchanged approved baseline; missing upstream, ahead/behind or fetch failure blocks application until BOSS resolves it. This default is a proposal for written review.

Each worker uses a distinct worktree. Integrator applies allowlisted change artifacts to its own workspace in dependency order. Use patches/file manifests, not automatic worker commits or cherry-picks. Include new files and deletions in artifact checks; reject paths, symlinks or Git metadata changes outside granted scope. Preserve input/output hashes to reproduce dependency lineage.

Reviewer and tester use separate sessions; reviewer may use the same engine/model as coder. Coder implements and writes tests; tester evaluates independently. Failed required checks stop the affected unit/dependents. Reviewer failure cannot count as completion.

Before applying results, rerun required validations and preflight original repository state. Use a recorded application operation and before/after manifest. Detect interrupted/partial application and require reconciliation, not blind reapplication or destructive resets. Applying leaves changes uncommitted for BOSS.

Native sandbox qualification is a release gate per engine and terminal, including descendants, network, credentials, external repositories, shell bypasses, Git shared metadata and env restrictions. Repository prompt injection cannot change runtime policy; that does not guarantee perfect model immunity to misleading repository content. Deterministic enforcement and adversarial evaluations address different risks.

If authenticated CLI execution cannot satisfy credential/tool/filesystem boundaries, that engine is blocked. An opaque auth broker or engine-native control protocol is a feasibility candidate, not an assumed working solution. No Docker fallback is silently introduced.

## 11. UI acceptance baseline

Baseline artifact: `.superpowers/brainstorm/56205-1791618671/content/layout-v5-review.html`; BOSS accepted it provisionally. Product tests must use actual backend state, not this preview's fabricated status values.

- Sidebar 280px: primary Chats/Knowledge with Hugeicons, uppercase PERSONAL/PROJECTS at equal size, nested project chats, neutral default indicators and colored selection. No BOSS/Local labels.
- Theme Light/Dark has explicit selected state. Hugeicons only; remove native disclosure arrows and text glyph icons.
- Rounded workspace with distinct Chat, Statuslines, Context sections. Chat/composer and rows share a content maximum; equal status widths.
- Statusline section cap interpreted as 75vh; scroll when needed. Context is a bento item below it; Manage opens detailed controls.
- Narrow history rail has DD/MM/YYYY tooltips and jumps to the first message on that day, based on BOSS's timezone.
- Body-only footer toggles a slide-up managed terminal excluding the sidebar. Single/Split layouts, separate session identities, retained output.
- Knowledge has Active/Candidate/Deactive columns, status colors and searchable accordion items. UI label Deactive maps to storage state Deactivated.
- Sky/Lime palettes exactly as provided in the brainstorming checkpoint. Proposed font: Be Vietnam Pro, role hierarchy ratio 1.2 with 14px base; terminal uses monospace.
- 8-point spacing, minimal descriptions/badges, limited borders/icons, smooth state transitions and reduced-motion support. Hide scrollbar visuals while preserving keyboard/touch scrolling.
- Keyboard focus, close controls, error/loading/empty/stale states and safe rendered Markdown/terminal links are part of acceptance.
- Small screens must preserve usable controls without forcing all panels into one viewport; final breakpoint rules are delivered/tested in P0/P4, not inferred from the desktop screenshot.

## 12. Testing and Done

Each phase has FE behavior tests and BE logic/storage tests, contract checks, a real integration smoke flow, lint/typecheck/build and both reports. Test actual failure boundaries, not simple getters or copies of implementation logic. Fixtures are for component/adapter tests; they do not prove credentials/sandbox/API health.

Implementation plans are written in English for agents, without Vietnamese duplicates. The two-language/two-audience requirement applies to phase reports only. The existing Vietnamese design-review guide is an explanation for this review, not a translated implementation plan.

Zhon development CI starts in P0. Managed-project GitHub Actions monitoring is P6, read-only and matched by repository/ref/HEAD SHA. Required test/build job mappings are configuration, not inferred from workflow success alone.

Phase Done locally requires its acceptance gates, required local validation, independent review, and both reports. Coding phases additionally require safe application or an explicitly different approved patch-only delivery contract. A preserved patch blocked from required application is Blocked, not Done. Remote CI status is separate after BOSS manually commits/pushes.

No-engine knowledge search remains available. Backup/restore must preserve approvals and immutable revisions, or restored content defaults to Candidate. Do not copy only the live main SQLite file while WAL is active.

## 13. Feasibility and configuration gates

| Gate | Evidence needed | Blocks | Resolution |
| --- | --- | --- | --- |
| Toolchain and conventions | Reproducible pnpm/runtime/test runner versions; exact conventions package verified | P0 exit | Resolve Corepack availability, inspect package, pin compatible tools during approved implementation |
| Keychain/provider auth | Real Gemini smoke call, redaction, missing/invalid-key tests | P2 live acceptance | BOSS configures key through Settings; trusted boundary is tested |
| Note identity/write recovery | Save/rename/duplicate ID and interrupted promotion fixtures | P1 exit | Implement reviewed revision semantics; do not overwrite ambiguous source changes |
| CLI/sandbox | Installed engine capability inventory and synthetic escape tests per engine | P4 coding/terminal exit | Qualify native boundary; report incompatible features rather than bypass controls |
| Allowance metrics | Version-specific, authorized status source | Live progress values | Render unknown/unsupported if unavailable; core delivery can continue |
| Approval/upstream defaults | BOSS review of expiry behavior and strict branch preflight | P4/P5 execution plan | Approve defaults or revise spec before implementation |
| GitHub visibility | Read-only auth and real workflow/job/revision mapping | P6 live acceptance | Configure registered repo and minimum permissions; missing access remains Blocked |
| Model pricing/capacity | Current provider capabilities/prices for selected model | Paid dispatch | Configure supported model and reservations before calls |

These are named gates, not instructions to implement incomplete assumptions. Second-brain phases can proceed independently of a blocked coding-engine gate.

## 14. References

- [SQLite WAL](https://sqlite.org/wal.html): concurrent readers and one writer; local-host restriction. Qualify the actual bundled SQLite version and durability settings in P0.
- [SQLite backup API](https://sqlite.org/backup.html): consistent backups instead of copying a changing database file.
- [Git worktree](https://git-scm.com/docs/git-worktree): separate working trees with shared repository administration; this is not filesystem security isolation.
- [Obsidian data storage](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data): Markdown vault content.
- [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs): run status/log access and revision association.
- [Hugeicons React setup](https://hugeicons.com/docs/integrations/react/quick-start): renderer and separate free icon pack.

Implementation security/provider details require capability-specific verification at the corresponding gate. The sources above do not establish that installed engines or this product already satisfy the design.
