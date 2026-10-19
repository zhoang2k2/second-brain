# Blockers

Fillable owner handoff: `.agent-runs/MVP-OWNER-CHECKLIST.md`. Treat the entries below as the historical pending decisions; resolve each when BOSS supplies a choice or explicitly delegates it. Autonomous implementation authorization is already present in the session, so do not require renewed approval of ordinary implementation steps. Real note data and cloud credentials are not mandatory when synthetic test fixtures and local-only MVP are selected.

## MVP — M2 to M4

- Owner gates OWNER-02 to OWNER-07 were resolved on 2026-10-20. See the checked decisions in `.agent-runs/MVP-OWNER-CHECKLIST.md`.
- Model/runtime verified: Ollama `0.40.6`, local model `qwen3.5:latest` (7.6 GB), endpoint `/api/tags` reachable, and one synthetic inference prompt succeeded. Measured response was about 38 seconds for that prompt; this is an observation, not a latency target.
- MVP is local-only. Do not call `glm-5.3-flash:cloud`, add a cloud adapter, or fall back to cloud.
- Knowledge writes must use unique keyword/slug identity, reject duplicates, never overwrite, and offer a reviewed additive proposal when new information differs from existing knowledge.
- No known owner-decision blocker remains for M2-M4. Implementation and runtime acceptance are still pending; report newly found technical/environmental blockers with evidence.

## Later roadmap phases

- Phase 2 requires approval of memory lifecycle, sharing boundaries, retrieval evaluation, and any MCP permissions.
- Phase 3 requires approved targets, action permissions, limits, observation scope, and a qualified isolation mechanism.
- Phase 4 requires a target host/model/runtime, measurable offline scope, access model, and backup/recovery objectives.
