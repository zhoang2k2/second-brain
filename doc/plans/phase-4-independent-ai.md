# Phase 4 — Independent AI Implementation Plan

**Goal:** Demonstrate a genuinely offline-capable system and optionally host it on a separate always-on machine with recoverable application and knowledge data.

**Architecture:** Keep provider and inference runtime replaceable behind the existing approved interfaces. Package only what is needed for the selected target, and prove offline operation by removing network access during acceptance. Treat hosting and backup as explicit operations work, not a claim inferred from local UI behavior.

**Tech stack:** Existing TypeScript application plus an owner-selected local model/runtime and deployment target. Server, operating system, packaging, backup destination, and model license are open choices until BOSS completes the entry gate.

**Source:** `~/Downloads/SECOND_BRAIN_PROJECT_HANDOFF.md`, sections 2–3 and 4.

## BOSS — manual, phase entry gate

- Choose the target device/server, operating system, availability expectation, access model, and operational owner.
- Approve model/runtime candidates after checking hardware fit, distribution terms, and required disk/RAM. Benchmark on the actual target; do not infer performance from the laptop specification.
- Define what “offline” must support (chat, retrieval, and which basic agent actions), how long the machine must remain disconnected, and what dependencies must already be present.
- Choose backup destination, encryption/access requirements, retention, and acceptable recovery-point/recovery-time objectives.
- Decide whether remote access is required. If so, approve authentication, network exposure, and security requirements before implementation.
- Explicitly approve the complete phase scope and acceptance criteria before implementation begins.

## FE agent

- Show selected runtime/model readiness, offline/online state, and actionable local setup or recovery errors.
- Provide only the operational controls required by the approved target, such as backup status or restore progress; avoid exposing secrets.
- Verify core user flows remain understandable when optional cloud services and network access are unavailable.

## BE agent

- Implement the selected local runtime integration and startup/readiness checks without hidden cloud fallback.
- Package or document the approved runtime/model prerequisites and preserve replaceable provider boundaries.
- Implement backup/restore for the approved application state and Markdown knowledge, with validation and a documented recovery procedure.
- Add self-hosting configuration only for the selected target. Apply approved authentication and network controls if remote access is in scope.

## Shared work and acceptance

- Run an offline acceptance test with network access actually disabled; verify the agreed chat/retrieval/basic-agent scenarios and report any unavailable capability.
- Restore from a real backup into a clean target and verify files, metadata, and application behavior against the approved recovery criteria.
- Verify secrets, transient indexes, and model weights follow the approved backup/source-control policy.
- Report target hardware, runtime/model versions, network conditions, backup artifact, and exact outcomes. Do not claim independence or offline readiness from a disconnected UI check alone.

**Exit:** The owner-approved offline scenarios and recovery procedure pass on the selected target, and BOSS accepts the operational evidence.
