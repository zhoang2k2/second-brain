# Handoff

M1 is validated at `07e2407` on `feature/m1`. On 2026-10-20, BOSS resolved OWNER-02–OWNER-07 for the local MVP: use `qwen3.5:latest`, keep history local with the approved lifecycle, use unique knowledge keys/slugs without duplicates or overwrite, require explicit review before writes, exclude cloud until a future phase, and use the approved end-to-end checklist with manual Obsidian verification by BOSS.

Ollama `0.40.6` is reachable at `http://127.0.0.1:11434`; the local model responds to a synthetic prompt. The one observed response took about 38 seconds; no latency target is set. The listed `glm-5.3-flash:cloud` model is out of scope and must never be called or used as fallback.

M2 → M3 → M4 implementation is authorized on the existing `feature/m2` worktree. Use the updated checklist and phase plan as the source of truth. Keep owner knowledge private; use synthetic fixtures only. No push, deploy, or merge to protected branches. BOSS still performs the final Obsidian open/read/edit acceptance after an exact vault/file path is provided.
