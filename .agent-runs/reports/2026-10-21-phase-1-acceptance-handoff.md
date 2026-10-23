# Phase 1 technical closure and owner handoff

Date: 2026-10-21

Branch: `feature/m2`

Tested product revision: `5ff2a14`

State: **Chờ owner nghiệm thu** — Phase 1 is not owner-accepted; Phase 2 has not started.

## Scope and finding closure

The approved Phase 1 scope remains local-only with Ollama `qwen3.5:latest`, Vietnamese Web and CLI, local conversation history, Markdown lessons in `knowledge/`, explicit review before writes, keyword retrieval and source paths. No cloud request, model download, push, deploy or merge was made.

| Finding | Result | Evidence on the tested implementation |
| --- | --- | --- |
| MVP-01 duplicate concurrent lesson updates | Resolved | Per-file serialization; two identical concurrent PATCH requests returned 200 and 409, and a repeat returned 409. Regression tests assert one saved addition. |
| MVP-02 stale `updated` metadata | Resolved | Live PATCH preserved original text, added the reviewed content once and refreshed frontmatter `updated` from a seeded 2000 timestamp to the current timestamp. Fixture removed. |
| MVP-03 provider detail cleared on refresh | Resolved | With test server `OLLAMA_BASE_URL=http://127.0.0.1:1`, Web showed both the failed message state and the detailed local provider error after refreshing history. |
| MVP-04 no crash checkpoint | Resolved for process termination | Assistant text is checkpointed every 1,000 ms. A forced Next.js process kill followed by restart recovered 598 characters with status `interrupted`. This tests process termination, not power loss. |
| MVP-05 incomplete acceptance evidence | Resolved technically | P1-O4 matrix below was exercised across Web, CLI and API failure paths; current quality checks are green. Owner P1-O5/P1-O6 remain. |

## P1-O4 acceptance matrix

All content used for acceptance was synthetic. Test lessons and conversations were removed afterward.

| Required scenario | Surface | Result and evidence |
| --- | --- | --- |
| Send chat, reopen conversation during stream | Web | PASS. Reopened the active conversation from its history row while the model was streaming; new deltas continued to appear without reload. |
| Stop mid-response and retain received text | Web | PASS. Stop displayed `Đã dừng. Phần nội dung đã nhận được giữ lại.`; saved assistant message was `interrupted` with 481 characters. |
| Restart, then reopen history | Web + server | PASS. After a forced process kill/restart, persisted history returned as `interrupted` with 598 checkpointed characters. After restart, the Web history reopened a stopped conversation and rendered its partial answer. |
| Edit proposal, then cancel | Web | PASS. Changed title/content in the proposal and cancelled. A later confirmation using the same title created the file without a collision, proving cancellation had not written it. |
| Confirm lesson save | Web | PASS. Confirmed save produced `knowledge/p1-thu-nghiem-tong-hop-20261021.md` with the reviewed title, tags and exact Markdown body. Search returned that content. The synthetic file was then removed. |
| Two requests add identical content | API | PASS. Concurrent requests returned `[200, 409]`; another duplicate returned 409. Existing content remained and the addition appeared once. Fixture removed. |
| Update lesson content and metadata | API | PASS. PATCH kept original content, added the approved section once and changed frontmatter `updated`. Fixture removed. |
| Ask about the saved lesson and receive its source | Web + API | PASS. Answer included the saved lesson content and exact path. A previously missed plain-text-path case was fixed so `sources` also records the exact path; end-to-end response returned `sources: ["knowledge/p1-citation-fixture-20261021.md"]`. Fixture removed. |
| Provider unavailable | Web | PASS. A temporary local-only invalid endpoint showed the message failure state and detailed error `Không kết nối được Ollama tại http://127.0.0.1:1...`; endpoint was restored to the normal local Ollama server. |
| Search with no result | Web | PASS. UI displayed `Chưa tìm thấy lesson phù hợp.` for a unique synthetic query. |
| Invalid metadata and path | API | PASS. Invalid title metadata and traversal-style lesson slug each returned HTTP 400. |
| Lesson name conflict | Web | PASS. Existing Markdown was shown in the proposal conflict panel with the proposed addition; the existing file was not overwritten and the proposal was cancelled. |
| CLI chat | CLI | PASS. CLI called the same local app and model, streamed an answer, and completed the saved message. |
| CLI stop and continue | CLI | PASS. Terminal Ctrl+C cancelled the active request, preserved partial text as `interrupted`, kept the CLI open, and a later CLI session continued that conversation to a completed answer. Regression test covers SIGINT handling and rapid duplicate signals. |

## Crash recovery and latency observations

- Checkpoint interval: 1,000 ms. During the forced process termination test, 598 characters survived restart and the message became `interrupted`. This is direct evidence for abrupt process termination on the local JSON store; power-loss durability was not tested.
- Warm local request through the application API, prompt `Trả lời đúng duy nhất một từ: OK`: first answer at 2.832 s; completion at 2.841 s; answer `OK`. Before the run, `ollama ps` showed `qwen3.5:latest` resident, 100% GPU, context 4096, MLX runner, 8.9 GB.
- The earlier after-unload observation in `.agent-runs/reports/2026-10-20-mvp-status-audit.md` reached 36 characters at 30.404 s with a different, longer prompt. These are individual observations, not a controlled cold/warm comparison or latency SLA. P1-O2 selected measurement without a required latency threshold.

## Verification

Final code checks on product revision `5ff2a14`:

- `pnpm format:check` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed (`next typegen` and `tsc --noEmit`).
- `pnpm test` — 31/31 passed across 7 files.
- `pnpm build` — passed with Next.js 16.4.0.
- `git diff --check` — passed.
- Citation regression was observed RED before the parser fix and GREEN after it. The CLI Ctrl+C regression likewise failed before its process-signal handling fix and passed afterward.
- Preview `http://127.0.0.1:3210` returned HTTP 200 after the final build. The preview is the local dev server for this worktree.

`knowledge/hello.md` SHA-256 was `7cf1b13e36ca1b792475010432a3cb73d5cbfc6495efcb6f94b56653669094d6` before and after acceptance; the file was not edited. No synthetic conversation or lesson remains in the vault.

## BOSS — P1-O5 and P1-O6

1. Open `http://127.0.0.1:3210` and save a new non-sensitive lesson through **Lưu câu trả lời thành lesson**. Review/edit the proposal before confirming and note the exact path the app returns.
2. In Obsidian, choose **Manage vaults… → Open folder as vault → Open**. In the Mac folder picker, press `Cmd+Shift+G` and enter this exact vault path:

   `/Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2/knowledge/`

3. Open the lesson from step 1, read it and add a short non-sensitive line. Return to the app and search for a distinctive phrase from that line.
4. Report the lesson name, whether read/edit/search worked, and the check time. Then record P1-O6 as `Đạt` or `Chưa đạt: ...` against product revision `5ff2a14`.

The owner’s manual Obsidian check and final acceptance are the only remaining Phase 1 gates. No push, deployment, merge or Phase 2 work was performed.
