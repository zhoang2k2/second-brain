# Blockers and pending acceptance

## MVP

- No implementation or local-runtime blocker remains for M2–M4.
- Owner acceptance is pending: BOSS must open `/Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2/knowledge/` in Obsidian, then read and edit a reviewed saved lesson. This is the only remaining MVP acceptance action.
- Partial-token cancellation against `qwen3.5:latest` was not observed: the model emitted no token before the test request was aborted. Cancellation state handling has unit coverage; repeat with a response that emits tokens before claiming live partial-stream acceptance.
- Completion evidence is in `.agent-runs/reports/2026-10-20-mvp-completion.md`.

## Later roadmap phases

- Phase 2 requires approval of memory lifecycle, sharing boundaries, retrieval evaluation, and any MCP permissions.
- Phase 3 requires approved targets, action permissions, limits, observation scope, and a qualified isolation mechanism.
- Phase 4 requires a target host/model/runtime, measurable offline scope, access model, and backup/recovery objectives.
