# Handoff

M1 is validated at `07e2407` on `feature/m1`. M2, M3, and M4 feature branches were created in dependency order from the latest valid product commit. No M2+ product implementation is present.

`blocked/m2`, `blocked/m3`, and `blocked/m4` have isolated worktrees and dated audits under `.agent-runs/reports/`. M2 needs an approved local model/resource profile, history storage, retention/resume/delete behavior, and scope/acceptance criteria. Ollama is unavailable locally; do not download model weights. M3 also needs Lesson 08 schema and privacy/review decisions. M4 depends on M2/M3 and needs provider and end-to-end acceptance decisions.

Phase 2–4 remain gated by the owner decisions in their plans and by Phase 1 completion. No independent product task remains until the gates are resolved.

For the next owner handoff, use `.agent-runs/MVP-OWNER-CHECKLIST.md` as the single input form. It distinguishes actual manual setup from delegable implementation choices and later Obsidian acceptance. Reconcile the old M1-only authorization text with the user's existing autonomous-execution instructions; do not ask for renewed implementation permission after the required choices are supplied. Owner-authored notes are not a prerequisite for synthetic test fixtures. Cloud credentials are unnecessary if the owner selects local-only MVP.
