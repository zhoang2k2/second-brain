# Zhon feature delivery and FE/BE ownership map

Status: design decomposition approved by BOSS for phase planning on 2026-10-10. This is not itself an execution-ready implementation plan. No product work has started. Detailed phase plans reside in `../plans/` and require review before implementation.

Language: phase implementation plans are English-only and agent-facing. Only end-of-phase reports require both a compact English agent version and a Vietnamese user version; do not produce bilingual plans.

## Delivery order

```text
P0 -> P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7
             |
S1 sandbox/engine feasibility can run independently from P0 onward.
S1 PASS is required before P4 enables coding or interactive terminals.
```

P0-P3 deliver a usable second brain. P4-P5 add safe coding orchestration. P6 completes managed-project CI tracking. P7 evaluates and prepares the integrated MVP for everyday use.

The normal order is sequential by phase. Clearly independent work inside a phase may run in parallel after its contract gate. S1 is an explicit feasibility exception with no requirement for a fabricated FE feature.

## Rule for parallel FE/BE delivery

Independent ownership does not mean zero coordination. Use this pattern in every phase:

| Step | Owner | Parallel? | Output |
| --- | --- | --- | --- |
| C: freeze feature contract | Integrator with FE/BE input | No | Request/response/events, error states, fixtures, acceptance examples |
| BE: domain/storage/adapters | BE worker | Yes, with FE after C | Real behavior plus unit/contract tests |
| FE: view/controller tests | FE worker | Yes, with BE after C | UI against contract fixtures and real client interface |
| I: wire and integrate | Integrator | After FE and BE | Routes, runtime registration, imports, migration order, shared config |
| V: validate and report | Tester/reviewer and integrator | After I | Real vertical flow, failures, reports, Done decision |

BE owns `apps/runtime/src/modules/<feature>/` and the assigned adapter paths. FE owns `apps/web/src/features/<feature>/`. The integrator alone edits `packages/contracts/`, migrations, root/package manifests, lockfile, global tokens, shared route/layout composition and runtime registration. The integrator may explicitly delegate a non-overlapping shared file; the ownership ledger must change before a worker edits it.

Workers use separate worktrees for source isolation. Root dependency installation is an integrator operation; parallel workers do not each update the lockfile. Reviewers/testers report gaps instead of editing someone else's active files.

Contracts do not change silently during parallel work. A necessary change pauses affected tasks, updates schema/fixtures/version and resumes both consumers after agreement. Do not keep developing mismatched FE/BE assumptions.

Each test lane may use fixtures; phase acceptance must exercise the actual runtime and registered filesystem/provider boundary. FE fixture success alone is never integration Done.

## P0 — Foundation and usable local shell

Feature: launch local zhon Web/runtime/CLI, inspect local readiness, register a project and vault path, and use the accepted navigation/themes.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P0-C | Toolchain/conventions check; health/config/project/vault contracts; test/CI baseline | Written design and P0 plan review | Integrator, contracts/root config |
| P0-BE | Runtime lifecycle, migrations, local-session protection, path registration, health | P0-C | Runtime server/storage/projects paths assigned in ledger |
| P0-FE | UI v5 shell, tokens, Hugeicons, sidebar hierarchy, themes, responsive navigation, health/settings states | P0-C | Web shell and assigned settings paths |
| P0-CLI | `zhon start`, `zhon status`, connection failure behavior | P0-C | CLI commands; can parallelize with BE/FE if worker capacity permits |
| P0-I/V | Wire clients, run real registration/restart flow, development CI, two reports | All preceding tasks | Integrator and independent validation |

Done: one runtime owns state; registration survives restart; invalid/out-of-scope paths are rejected; theme/nav behavior tests and unauthorized local mutation tests pass; lint/typecheck/unit/build commands run in CI; CLI reports readiness honestly; both reports exist.

Blockers: Corepack/toolchain availability, compatible SQLite/test runner selection, verified conventions package identity. Resolve through approved tooling qualification; do not invent package availability. No coding engine required. Next readiness: stable transport/contracts/storage and registered test vault.

## P1 — Obsidian ingestion, search and Candidate review

Feature: write a note in Obsidian, find it in Candidate, inspect it, approve it, and retrieve the approved revision without an LLM.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P1-C | Note/revision/candidate/search/review contracts; stale/hash/error fixtures | P0 Done | Integrator |
| P1-BE | Watch/rescan, immutable snapshots, FTS5 scope queries, exact review/promotion and Deactivate | P1-C | Runtime knowledge and vault adapter |
| P1-FE | Active/Candidate/Deactive columns, accordion/search/diff/review states, keyboard/motion | P1-C | Web knowledge |
| P1-I/V | Real vault saves, promotion interruption, source races, unrelated project fixtures, reports | P1-BE + P1-FE | Integrator/tester |

Done: new/edit -> Candidate; duplicate save is deduplicated; old Active survives pending/rejected edit; stale approval is refused; Deactivate excludes future retrieval; unapproved content and other project-private notes cannot enter results; malformed/duplicate identity is visible; search works with no provider; reports exist.

Blockers: note identity and filesystem promotion recovery must pass fixtures; external vault needs explicit registered path access in the implementation environment. Next readiness: exact Active revisions and context-ready scoped search.

## P2 — Gemini chat, history and Context management

Feature: chat with Gemini using approved relevant notes, inspect retained intent/context, and jump to the first message of a selected day.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P2-C | Message streaming/cancel/history/context and conversation-budget contracts; auth/error events | P1 Done | Integrator |
| P2-BE | Gemini adapter, trusted Keychain auth, chat/history isolation, context snapshots, reservations and bounded summary | P2-C | Runtime conversations, assigned budgets/provider/keychain paths |
| P2-FE | Chat input/responses, streaming/error/cancel, day rail, Context bento and Manage, provider configuration | P2-C | Web conversations and assigned provider-settings subdirectory |
| P2-I/V | Live user-configured API smoke flow; long-history/context, interruption/redaction tests, reports | P2-BE + P2-FE | Integrator/tester |

Done: authenticated live chat succeeds; messages persist separately by conversation/project; exact referenced note revisions are inspectable; retained intent survives compaction; original history remains accessible; summary/context overflow and unknown usage do not trigger blind paid retry; budget and invalid-key states work; history respects timezone; reports exist.

Blockers: credential entry by BOSS, supported model/capacity/pricing and explicit conversation budget. Synthetic provider tests do not satisfy live acceptance. Next readiness: durable chat/context and budget-aware provider access.

## P3 — Automatic knowledge growth

Feature: approved processing profile creates useful Candidates from manual notes and valuable conversations, with bilingual content and dynamic topic/link proposals.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P3-C | Profile/jobs/candidate enrichment/topic-link contracts and cost/error fixtures | P2 Done | Integrator |
| P3-BE | Batch triggers, job leases, enrichment/deduplication/content checks, separate budget, profile-version checks | P3-C | Runtime jobs and assigned knowledge learning subdirectory |
| P3-FE | Processing-profile controls, job state, enriched review, proposed relationships, budget-blocked states | P3-C | Web knowledge learning subdirectory; assigned settings subdirectory |
| P3-I/V | Burst saves, repeated extraction, profile changes, paid interruption and approval isolation | P3-BE + P3-FE | Integrator/tester |

Done: useful conversation/manual Candidates are generated within the approved budget; unchanged content does not create repeated Candidates; English summary/Vietnamese explanation are reviewable; topics grow without a fixed taxonomy; failures/hypotheses remain honest; no auto activation/global-rule mutation; reports exist.

Blockers: profile model, data scope and limits must be explicitly configured; uncertain API charges retain reservations. Next readiness: everyday second-brain workflow is usable; coding is still gated by S1.

## S1 — Native sandbox and engine feasibility

Exception: bounded qualification output, not a general coding feature and not an excuse to claim security from mock tests. Can be investigated independently while P0-P3 deliver knowledge flows.

Scope: installed CLI versions, auth isolation, structured control/approval boundaries, process descendants, worktree/Git metadata, env restrictions, network and interactive-shell enforcement. Use synthetic repositories and fake secrets.

Done: each engine/action class has a capability matrix and reproducible PASS/FAIL/UNSUPPORTED results. The boundary must deny prohibited actions through actual enforcement. Record engine-specific limitations and two reports. A failed probe is a useful completed investigation, but it does not satisfy P4's execution-enablement gate.

Blockers: unavailable supported CLI automation interface, auth exposed to command workers, or a sandbox that cannot enforce required policies. Resolution: revisit that integration's architecture with BOSS; do not disable guards or label it AUTO. Worker slot/resource limits apply during actual later execution.

## P4 — Approved single-agent execution and managed terminals

Feature: approve a bounded execution plan, run one qualified CLI worker in an isolated worktree, observe/cancel it in a body terminal, and receive results/reports.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P4-C | Plan/grant/attempt/action/session/allowance contracts and capability matrix | P3 Done + S1 evidence | Integrator |
| P4-BE | Preflight, supervisor, engine adapters, timeout/cancel, immutable attempts, managed terminal and auth/policy boundary | P4-C + S1 PASS for enabled class | Runtime execution/supervisor and explicitly assigned adapters |
| P4-FE | Plan approval/expiry/errors, activity, terminal drawer/Single-Split session views, 5h/1w unknown/stale handling | P4-C | Web execution/terminals/integrations status directories assigned separately |
| P4-I/V | Actual qualified CLI runs plus failure/denial/cancel/recovery cases and reports | P4-BE + P4-FE | Integrator/tester |

FE execution views and terminal views may be separate independent sub-tasks after P4-C, provided their paths do not overlap. Backend adapter/supervisor work may run in parallel only after interface ownership is frozen.

Done: logs and state persist; process error cannot damage the original repo; forbidden source/env/credential/Git operations are denied; timeout/cancel reconcile descendants; invalid/expired grants deny execution; real engines meet the scoped capability contract; terminal input cannot bypass policy; reports exist.

Unavailable 5h/1w measurements do not block a safe engine workflow; fabricated measurements are forbidden. If one required engine is unsupported, report a product scope blocker rather than silently claiming the two-engine MVP is finished.

Next readiness: qualified action boundary and independently inspectable attempts for multi-agent scheduling.

## P5 — Approved phase orchestration and safe application

Feature: BOSS approves an entire phase; independent FE/BE units run in parallel; dependent work follows the DAG; integration/tests/review/application and bilingual reports happen within that grant.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P5-C | DAG/run/lineage/validation/apply/report contracts; overlap and upstream policy examples | P4 Done | Integrator |
| P5-BE | Scheduler/role sessions, patch integration without implicit commits, validation, apply journal, blocked-branch propagation, task lessons | P5-C | Runtime execution orchestration, assigned Git/report/learning paths |
| P5-FE | Whole-phase review, work-unit progress/dependencies, blocker decisions, validation/diff and two report views | P5-C | Web execution phase/report subdirectories |
| P5-I/V | Two real independent workers; conflicting/dependent outputs; branch drift, reviewer failure, apply interruption | P5-BE + P5-FE | Integrator/reviewer/tester |

Done: parallel work never shares a worker tree; integration is ordered and rejects conflict/ownership violations; tests/review reference the actual artifact; no automatic repair loop; original repo applies only when clean/on branch/up to date/unchanged; changes remain uncommitted; both reports persist; successful/failed/blocked lessons become Candidates.

Blockers: missing upstream or baseline drift, required role/config grant unavailable, security issue, incomplete review, unresolved integration/application. Preserve artifacts and give the exact BOSS action required. Next readiness: local phase outcomes are reproducible and ready for optional manual commit/push plus remote CI association.

## P6 — GitHub Actions tracking

Feature: after BOSS manually commits/pushes, zhon shows relevant test/build runs without confusing them with old CI or local completion.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P6-C | CI auth, repo/ref/SHA/job mapping and polling contracts | P5 Done | Integrator |
| P6-BE | Read-only Actions adapter, bounded polling, association and permission/rate-limit errors | P6-C | Runtime integrations GitHub |
| P6-FE | CI status/logs linked to the run/revision, stale/unknown states, required-job results | P6-C | Web integrations CI |
| P6-I/V | Registered real workflow/revision readback, old-green mismatch, missing token/jobs, reports | P6-BE + P6-FE | Integrator/tester |

Done: exact remote revision and required jobs are shown; denied/log-unavailable states are honest; zhon cannot push or alter workflows via this integration; DoneLocal is independent of remote status; reports exist.

Blockers: no authorized GitHub read access or no matching workflow/job. Resolve by configuring the registered repo and permissions; do not fabricate a successful CI run. Next readiness: full local/remote validation trace for everyday use.

## P7 — Recovery, backup and integrated evaluation

Feature: recover interrupted work safely, restore brain data, and inspect integrated readiness without losing approval/revision integrity.

| Task | Responsibility | Depends on | Ownership |
| --- | --- | --- | --- |
| P7-C | Recovery/backup/readiness contracts and scenario inventory | P6 Done | Integrator |
| P7-BE | Consistent DB/revision backup/restore, unresolved-action reconciliation, redaction and resource benchmarks | P7-C | Runtime assigned recovery/storage/diagnostics paths |
| P7-FE | Recovery decision screen, unknown effects/charges, backup/restore/readiness summaries | P7-C | Web execution recovery and assigned settings paths |
| P7-I/V | Restart/power-loss fixtures, permission/injection/context-contamination/budget adversarial tests, real MVP scenarios | P7-BE + P7-FE | Integrator/tester/reviewer |

Done: no blind side-effect replay, restored review state is trustworthy or defaults to Candidate, all earlier gates still pass, private/other-project context cannot leak through assembly, budgets stop new dispatch, failed required review cannot produce Done; measured performance envelope and known limitations are reported; both reports exist.

Blockers: unqualified restore procedure, unresolved side effects/charges, failed security regression or absent real-engine evaluation. Resolve with a recorded reconciliation decision, passing reproducible fixtures and real integration qualification; do not erase uncertainty to obtain a green readiness screen. Next readiness: a bounded daily-use MVP with documented supported engines and measured limitations; future server/local-model work requires a separate design.

Security and recovery invariants are tested in the feature phase that introduces them. P7 broadens integrated evaluation; it is not the first time those invariants are enforced.

## Original acceptance criteria coverage

| Scenario | First feature gate | Integrated gate | Required evidence |
| --- | --- | --- | --- |
| Adapter failure | P2 API / P4 CLI | P7 | Preserved logs/state, retry as a new attempt only with valid grant |
| Concurrent agents overwrite | P5 | P7 | Separate worktrees, write ownership and conflicting artifact rejection |
| Crash causes duplicate effects | P3 paid jobs / P4 execution / P5 application | P7 | Interrupted dispatch reconciliation, no blind replay |
| Unauthorized filesystem access | S1 then P4 | P7 | Actual denied reads/writes in native qualification, including descendants |
| Repository prompt injection | P4 | P7 | Untrusted text cannot mutate grants/policy; unauthorized action is refused |
| Cross-project memory contamination | P1 retrieval / P2 assembly | P7 | Adversarial scope fixtures and exact inspected context sources |
| Invalid memory promotion | P1/P3 | P7 | Stale/invalid/duplicate Candidate refusal, prior Active preserved |
| Approval expiration | P4 | P7 | Boundary refuses dispatch and reconciles cancelled/uncertain effects |
| Budget exhaustion | P2/P3; P4/P5 execution budget | P7 | Atomic reservation failures stop additional dispatch despite concurrent requests |
| Reviewer failure | P5 | P7 | Required review stays incomplete; phase cannot be DoneLocal |
| Conflicting integration changes | P5 | P7 | Preserve artifact/conflict report, block application, require BOSS decision |

## Shared exit gate and next-phase handoff

Every phase records:

1. Actual acceptance checks and outcomes, including FE/BE/contract/integration evidence.
2. Current source paths, baseline/input hashes, dependencies and ownership changes.
3. Required fixes/blockers with resolver and exact next action.
4. What the next phase can safely assume and what it cannot assume.
5. Compact English report and readable Vietnamese report using [report templates](2026-10-10-zhon-report-templates.md).

No time/cost estimates are promised before toolchain/provider/sandbox qualification. Model/effort selections belong to the phase plan BOSS reviews, not this generic roadmap.
