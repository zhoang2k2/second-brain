# Zhon logical data models and lifecycles

Status: part of the written design approved by BOSS for phase planning on 2026-10-10. These are logical models, not applied database migrations or frozen SQL schemas.

## Data ownership and common fields

Runtime owns writes. Records use generated IDs, UTC timestamps, version counters and project/conversation scopes where applicable. UI dates use BOSS's timezone. Optimistic version checks prevent approving stale Candidates/plans.

Provider secrets are represented by Keychain references, never plaintext database columns. Large redacted logs/artifacts may live on local disk with references in SQLite; do not append every terminal byte as a database state event.

## Core models

| Model | Important fields | Invariant |
| --- | --- | --- |
| Project | ID, registered real root, remote, branch/upstream rules | Path registration does not grant access to other repositories |
| Conversation | ID, optional project ID, selected provider/model, budget ID | Context/history isolated from other conversations |
| Message | Conversation ID, role, content, state, provider request reference | Interrupted output is retained and labeled, never falsely complete |
| ContextSnapshot | Conversation/version, summary, retained intent, message range, note revision IDs, tokens/capacity/source | Exact assembled context is inspectable; full history remains stored |
| ProviderConfig | Type, Keychain reference, capabilities/version, status | No fabricated model/effort/allowance capability |
| AllowanceSnapshot | Provider/window, used fraction, reset time, fetched time, availability/source | Subscription windows, request tokens and context tokens remain different metrics |
| ProcessingProfile | Version, model/effort, granted data scopes, batch/daily budget, trigger conditions | Enrichment does not activate memory or raise its budget |
| BudgetLedger | Scope, limit, pricing version, spent/reserved/unresolved amounts | Dispatch reservation is checked atomically, including concurrent requests |
| Job | Type, input revision/hash, profile version, status, lease, attempts | Input changes invalidate the old result; no duplicate activation |
| Note | ID/provisional identity, vault ID/path, retrieval scope, Active revision pointer, availability | Source edits do not replace approved content |
| NoteRevision | Note ID, immutable Markdown path/hash, parent revision, origin, verification annotations | Immutable content; lightweight provenance, no required raw evidence bundle |
| Candidate | Revision ID, expected source hash, proposed metadata/links, processing/review state | Approval is for the exact revision, not a mutable file |
| Topic / NoteLink | Approved topic/link identity, source revision, target identity | Dynamic subjects; relations cannot grant permission |
| PromotionOperation | Candidate, source expectation, snapshot reference, write stage, error | Reconcile FS/DB interruption before exposing the new Active pointer |
| PhasePlan | Immutable version/hash, project/base, units, role configs, grants, budget, expiry, criteria | Change to approved content creates a new version requiring approval |
| PhaseRun | Plan version, state, integration workspace, final artifact references | One globally executing phase; independent background knowledge jobs are separate |
| WorkUnit | Run, dependencies, write roots, input lineage, criteria, state | Cycles and overlapping write ownership are rejected before scheduling |
| WorkerAttempt | Unit/role, engine/model/effort, sandbox profile, process identity, outcome | Every retry gets a new attempt; old evidence stays |
| Approval | Exact action/target, plan hash, baseline/config version, expiry, revocation | Expired/revoked/drifted grants cannot authorize another action |
| ActionExecution | Approved request ID, side-effect class, dispatch/completion records | Unknown execution is reconciled; no automatic blind retry |
| ValidationResult | Unit/run, command/role, input artifact hash, status, findings | A passing check for an old artifact cannot validate a new one |
| ApplyOperation | Original baseline, expected manifest, stages, observed result | Interrupted application is distinguishable from never-started application |
| Report | Phase/run, language/audience, result state, file, artifact/check references | Required reports exist for Done; blocked outcome cannot become success text |
| CIRun | Registered repository, remote ref/HEAD SHA, workflow/jobs/status, timestamps | Old remote green status is not local uncommitted validation |
| AuditEvent | Sequence, action, safe actor/target, outcome, correlation | Credentials and unsafe raw payloads are excluded |

Split storage tables only when a real query/invariant requires it. A serialized immutable plan is acceptable; do not normalize every field into a speculative table.

## Knowledge state model

Use separate concepts for note availability, revision review, and processing. Avoid a single enum mixing all three.

```text
source change -> immutable revision -> Candidate
Candidate -> Approved | Rejected | Stale
Candidate processing: Pending -> Running -> Ready | Failed | BudgetBlocked
approved revision -> Active pointer
Active pointer -> Deactivated by BOSS | Replaced by approved revision
missing/unsafe source -> Unavailable (excluded from new retrieval)
```

UI columns map to Active revisions, pending Candidates and Deactivated notes. Rejected/stale Candidates remain in review history; they do not clutter the three primary columns or become Active by processing again.

| Event | Outcome |
| --- | --- |
| Re-save identical bytes | No new revision/Candidate |
| Edit Active note | New Candidate; original Active pointer remains |
| Enrichment ready | Proposed exact content/metadata available for review |
| Source changed after capture | Approval blocked as Stale; capture a current Candidate |
| Approve valid replacement | Record promotion; expose new Active pointer only after persistence completes |
| Reject replacement | Preserve old Active; retain rejected revision/history |
| Deactivate | Exclude from the next retrieval; preserve history and snapshots |
| Roll back | BOSS selects exact previously approved content; record explicit action and source write checks |
| Restore Markdown without trusted review state | Treat as Candidate |

A lesson can be unsolved or hypothesis-based if clearly labeled. Content validation checks required structure for that note type, missing facts and unsafe metadata; it is not a guarantee that the model's explanation is true.

## Background job lifecycle

```text
Queued -> Reserved -> Running -> Succeeded
                      |       -> Failed
                      |       -> Interrupted -> AwaitingDecision
Queued/Reserved -> BudgetBlocked | InvalidInput | Cancelled
```

Job dispatch records the input, profile and reservation before calling the provider. Late results are checked against input/profile version and job ownership. A generated Candidate has a deterministic source/job identity, preventing duplicate notes on event redelivery.

After runtime restart, reconcile active jobs and uncertain API requests. Preserve reservations for unknown charges; do not make automatic paid retries while waiting for BOSS's recovery decision. File discovery/rescan and ordinary reads may continue.

## Plan and phase-run lifecycle

Planning is separate from execution:

```text
Plan: Draft -> ReadyForReview -> Approved
                               | -> ChangesRequested
Approved -> Invalidated | Expired | Revoked

Run: Created -> Preflight -> Executing -> Integrating -> Validating -> Applying
                         -> Blocked             |         |           |
                                                               Reporting -> DoneLocal
```

Each running stage may enter Failed, Blocked, Cancelling or RecoveryRequired. Reporting also runs for unsuccessful outcomes; it is not a shortcut into DoneLocal.

| Trigger | Required behavior |
| --- | --- |
| Phase approval | Freeze plan/config/baseline, create run, then preflight |
| Invalid DAG/write overlap | Reject before launch; show exact conflicting units/paths |
| Budget cannot reserve next job | Stop new paid dispatch; preserve active outcomes and show blocker |
| Test/review failure | Block affected unit/dependents; independent approved units may continue |
| Reviewer process fails | Mark review incomplete; no phase completion |
| Repository baseline changes | Block integration/application and request a newly valid plan/target decision |
| Conflict during integration | Preserve outputs; no automatic conflict resolution outside plan |
| Approval expiry/revocation | Deny new actions; cancel workers capable of further side effects; reconcile uncertain outcome |
| Security violation | Revoke affected execution capability, cancel affected process tree; block phase execution pending inspection |
| User cancellation | Stop scheduling, request process-tree termination, report completed/unknown effects |
| Runtime restart | Reconcile lease/process/worktree/action identities; AwaitingDecision before resuming |
| Application interrupted | Inspect baseline/manifest; report partial/unknown state, never reset user files automatically |
| Checks pass but required application blocked | Blocked with preserved artifacts, not DoneLocal |
| Reports fail to persist | Completion remains incomplete; retry report persistence safely without reexecuting coding |

A security violation is broader than an ordinary test failure: independent coding units cannot continue on a potentially compromised runtime until the boundary is understood.

## Work units and worker attempts

```text
Unit: Pending -> Ready -> Running -> OutputReady -> Integrated -> Validated
                                  | -> Failed | Blocked | Cancelled
dependency failure -> DependencyBlocked

Attempt: Created -> Starting -> Running -> Succeeded | Failed | TimedOut
                                       -> Cancelling -> Cancelled | OutcomeUnknown
crash/lost process identity -> RecoveryRequired
```

The runtime verifies an output manifest before OutputReady. A coder exiting with code zero does not prove the unit met acceptance. Tests/review are separate checks against the integrated artifact.

Attempts are immutable histories. Retry requires a valid grant and a new attempt. Do not replay a partially completed terminal command, dependency install, external API action or patch application merely because completion was not recorded.

The supervisor records more than PID: process start identity and runtime-owned metadata. PIDs can be reused. A timeout signal is a cancellation request; completion is confirmed only after the managed process tree is reconciled.

## Approval and authority rules

- Phase grant binds action classes, exact repository/baseline, plan version, engines/models/effort, role write roots, sandbox profile, budget and expiry.
- Knowledge profile grants apply to specified candidate data/model/budget only. They do not grant source-repository access, commands or memory promotion.
- Learning/global note activation does not edit global execution policy.
- Only the trusted runtime can mutate approvals and permission configuration. Repository/Markdown/tool output is untrusted reference content.
- Any adapter lacking an enforceable tool boundary is denied that action class; a prompt promise is insufficient.

## Report schema

The compact report should use stable keys: `phase`, `run`, `result`, `plan_version`, `baseline`, `delivered`, `checks`, `artifacts`, `blockers`, `decisions`, `next`, `knowledge_candidates`.

Use result values DoneLocal, Blocked, Failed, Cancelled or RecoveryRequired. Include actual check statuses and observation dates. Refer to source history as historical when not reverified. The Vietnamese companion explains only the concepts relevant to the phase.
