# Blockers

Fillable owner handoff: `.agent-runs/MVP-OWNER-CHECKLIST.md`. Treat the entries below as the historical pending decisions; resolve each when BOSS supplies a choice or explicitly delegates it. Autonomous implementation authorization is already present in the session, so do not require renewed approval of ordinary implementation steps. Real note data and cloud credentials are not mandatory when synthetic test fixtures and local-only MVP are selected.

## M2 — Chat

- Owner model choice and expected resource/performance profile are not recorded.
- Conversation-history storage is undecided; SQLite remains only a candidate.
- History retention and resume/delete behavior are undecided.
- M2 scope and acceptance criteria have not been explicitly approved.
- Real Ollama acceptance also requires BOSS to install/start Ollama and make the selected model available locally. No model was downloaded or tested.
- Environment probe on 2026-10-19: Ollama CLI not found; `http://127.0.0.1:11434/api/tags` returned curl exit 7 / HTTP 000.

## M3 — Knowledge

- Depends on M2 chat/history contracts.
- Lesson 08 decisions for metadata, naming, organization, and links are not recorded as an approved schema.
- Conversation content eligibility, sensitive-data handling, and review-before-save policy need owner approval.

## M4 — Integration

- Depends on M2 and M3.
- Cloud provider inclusion, provider selection, cost/privacy controls, and final end-to-end acceptance scenario are undecided.

## Later roadmap phases

- Phase 2 requires approval of memory lifecycle, sharing boundaries, retrieval evaluation, and any MCP permissions.
- Phase 3 requires approved targets, action permissions, limits, observation scope, and a qualified isolation mechanism.
- Phase 4 requires a target host/model/runtime, measurable offline scope, access model, and backup/recovery objectives.
