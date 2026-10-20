# Phase 1 MVP status audit

Date: 2026-10-20

> Historical audit snapshot. MVP-01–05 were resolved and the P1-O4 acceptance matrix was run on product revision `5ff2a14`; see [the 2026-10-21 Phase 1 handoff](2026-10-21-phase-1-acceptance-handoff.md) for current status and owner gates.

Audited product revision: `863fe65` on `feature/m2`.

## Verdict

**Phase 1 MVP v0.1 is NOT DONE / NOT ACCEPTED. The project is in Phase 1 stabilization and acceptance. Phase 2 has not started.**

M1 Foundation is one milestone inside Phase 1; it is already complete. It must not be confused with completion of the entire MVP.

The earlier description of M2–M4 as implementation-complete with only owner acceptance remaining was too strong. Core features exist, but this audit reproduced a knowledge-write defect and identified acceptance gaps and narrower limits on prior evidence.

## Scope and authoritative acceptance

- `doc/plans/phase-1-mvp.md:130` requires the end-to-end acceptance scenario and BOSS review before starting Phase 2.
- `.agent-runs/MVP-OWNER-CHECKLIST.md:198-205` covers web/CLI chat, history, lesson review/save, Obsidian, retrieval, failure paths, and quality checks.
- `.agent-runs/MVP-OWNER-CHECKLIST.md:214` retains BOSS's manual Obsidian read/edit acceptance. Registering a vault and seeing files is narrower evidence.
- The latest approved MVP is local-only. Cloud, embeddings, MCP, a full memory lifecycle, and an autonomous agent are outside this phase. Output-token controls were explicitly deferred by BOSS; lack of that future feature is not a current MVP blocker.

## Milestone status

| Milestone      | Current state                                                                       | What remains                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M1 Foundation  | Complete                                                                            | No new M1 implementation work identified                                                                                         |
| M2 Chat        | Web/CLI, streaming, history, cancellation implemented; stabilization in progress    | Close representative failure/UI acceptance and document performance limits; do not infer acceptance from one short warm prompt   |
| M3 Knowledge   | Preview/edit/confirm, Markdown writes, keyword search, reviewed append implemented  | Fix the reproduced duplicate append race before completion                                                                       |
| M4 Integration | Local integration exists; prior synthetic chat/save/search/citation evidence exists | Close implementation findings, complete the acceptance ledger and owner Obsidian read/edit check, then obtain Phase 1 acceptance |
| Phase 2        | Plan only                                                                           | Requires its own approved scope/lifecycle/permission gates after Phase 1 acceptance                                              |

## Fresh verification in this audit

- `pnpm test`: 21/21 tests passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- Preview `http://127.0.0.1:3210/`: HTTP 200.
- The production build passed in the preceding latency fix report at this same product revision. This audit did not repeat a build or restart the live preview.
- A targeted concurrency probe used only temporary files outside the repository. Across 3/3 attempts, two concurrent identical calls to `appendLessonUpdate()` both succeeded and the same addition appeared twice. The temporary files were removed.
- A fresh real-Ollama cancellation probe received 36 answer characters, aborted the request, then read back `interrupted` with 39 saved characters. All client-received text was preserved as a prefix. This closes the earlier missing evidence for live partial-stream cancellation **at API level**, not every browser/CLI cancellation interaction. The exact synthetic conversation was deleted afterward.
- Ollama reported no loaded model immediately before that probe. It took 30.404 seconds from POST to the 36-character cancellation point. This used a different, longer prompt than the earlier warm `OK` measurement; the audit does not attribute all of that time to model loading or treat it as a controlled warm/cold comparison.
- Existing notes, including untracked `knowledge/hello.md`, were not modified or staged.

## Findings

| ID     | Severity   | Finding and evidence                                                                                                                                                                                                                                                                                                     | Recommended action                                                                                                                                                                                                                                   |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP-01 | Must fix   | Identical reviewed additions are not idempotent under concurrency. `lib/knowledge.ts:208-214` checks existing content and appends in separate operations. Two requests can pass the same check and append twice. Reproduced 3/3 times in isolated temporary files; the application PATCH route uses this function.       | Serialize note mutations and reject repeated content under the serialization boundary; add a regression for concurrent identical updates and verify duplicate submissions through the UI/API.                                                        |
| MVP-02 | Should fix | The active append function writes a dated body section but leaves frontmatter `updated` unchanged (`lib/knowledge.ts:213-216`). The helper that updates that field is not called by the application route.                                                                                                               | Choose and document one authoritative update timestamp, then make the actual save path and tests agree.                                                                                                                                              |
| MVP-03 | Should fix | Detailed provider errors can be cleared during recovery: the send catch sets an error and calls `openConversation()`, which clears it (`app/ChatWorkspace.tsx:153-162`, `:53-59`). A generic failed-message state may remain, but the useful provider detail can disappear.                                              | Preserve the send error while refreshing history and verify provider-unavailable UI behavior. This finding is source-inspection evidence, not a fresh browser reproduction.                                                                          |
| MVP-04 | Should fix | In-flight text is accumulated in server memory and saved after completion or a caught failure/abort (`app/api/chat/route.ts:88-132`). Startup only changes persisted `streaming` statuses to `interrupted` (`lib/store.ts:64-70`). There is no progressive checkpoint proving that text survives a sudden process crash. | Distinguish graceful cancellation from crash recovery in the history contract. Add checkpoint/recovery coverage if preserving already displayed text across abrupt process termination is required. Do not claim crash-safe partial responses today. |
| MVP-05 | Should fix | Source checks are green but do not cover all accepted failure paths or the complete final owner scenario. The prior 1.208-second warm answer is not a general response-time guarantee; a new after-unload probe needed 30.404 seconds to reach 36 characters.                                                            | Record representative cold/warm and multi-turn behavior, browser error/cancel states, and the complete final acceptance flow. Keep performance claims scoped to their measured prompts.                                                              |

## Acceptance still pending

- Resolve MVP-01 and retest the reviewed update flow.
- Verify the remaining failure paths on the final integrated revision, including detailed provider-unavailable feedback and invalid metadata/path behavior. Existing helper tests and happy-path reports do not establish all of these cases.
- Complete and record BOSS's manual read/edit of a reviewed lesson in the correct Obsidian vault.
- Consolidate these results into one final Phase 1 acceptance record. No owner acceptance is inferred from preview access, reports, or passing unit tests.

## Repository and workflow state

- The runnable product is in `/Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2` at `863fe65` before this documentation audit.
- Core M2/M3/M4 product work currently shares `feature/m2`; its name is not proof that only M2 has been implemented.
- The repository root is still on `feature/m1` at `529dacd`. `main` and `develop` remain at `1ba468b`; no product integration into those branches has happened, and no such merge was authorized.
- The root `.agent-runs/codex.state` still says `BLOCKED`, while some feature-worktree reports say implementation-complete. These are inconsistent workflow artifacts; source and fresh evidence take precedence. The root state file was not changed by this audit.
- Product fixes were not applied during this status audit. This report corrects the completion assessment and records the next required work within Phase 1.
