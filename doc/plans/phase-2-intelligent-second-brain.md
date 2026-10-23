# Phase 2 — Intelligent Second Brain Implementation Plan

**Goal:** Add a controlled knowledge lifecycle that can extract, validate, store, retrieve, update, and forget useful long-term knowledge.

**Architecture:** Extend the Phase 1 single application and Markdown source of truth. Introduce structured memory lifecycle and semantic retrieval only after BOSS approves the policy and basic search has demonstrated a concrete limitation. MCP is a controlled adapter, not a new source of authority.

**Tech stack:** Existing Next.js + TypeScript application, Markdown knowledge, and the storage/search choices already approved for Phase 1. Embeddings and MCP implementation details are intentionally undecided until the entry gates below are complete.

**Source:** `~/Downloads/SECOND_BRAIN_PROJECT_HANDOFF.md`, sections 4 and 8–9.

## BOSS — manual, phase entry gate

- Prioritize the actual first capabilities for this phase (memory, note linking/deduplication, semantic search, MCP); do not assume every roadmap bullet is one release.
- Approve the lifecycle policy: what can be proposed automatically, what requires review, how edits/updates/deletion work, how conflicts are shown, and how stale or rejected suggestions are handled.
- Approve source attribution and sharing boundaries, including which projects or notes may be shared with an AI client.
- Decide what measurable retrieval failure would justify embeddings and approve any local/cloud embedding provider and resource/privacy constraints before implementation.
- If MCP is included, identify intended clients and the exact read/write tools and permissions they may receive.
- Explicitly approve the complete phase scope and acceptance criteria before implementation begins.

## FE agent

- Add owner-facing review and management flows only for the approved lifecycle: inspect a proposed memory, compare it with existing notes, accept/edit/reject, and forget/update where allowed.
- Show provenance, source date, status, and conflicts in a way that distinguishes retrieved knowledge from model output.
- Add retrieval controls only when the approved policy requires them; do not expose speculative ranking knobs.
- Provide clear empty, stale, duplicate, rejected, and unavailable-index states.

## BE agent

- Implement the approved lifecycle transitions and validation rules with provenance preserved across create/update/reject/forget operations.
- Add duplicate/conflict detection constrained to the approved knowledge scope.
- Add semantic embeddings only if the approved evaluation shows basic search is insufficient; retain a usable keyword-search fallback.
- Implement MCP only for approved tools and enforce the same permission checks as the application's own interface. Retrieved Markdown and model output are data, not instructions that can alter policy.

## Shared work and acceptance

- Specify lifecycle and FE/BE contracts before parallel work. Keep manual note edits consistent with the approved proposal/review model.
- Evaluate representative queries and record relevance, provenance, cross-project isolation, conflict behavior, and stale-source behavior.
- Verify that rejection or forgetting prevents the same stale proposal from silently becoming active again.
- Verify MCP clients cannot read/write outside the approved scope and cannot bypass review or permission gates.
- Separate local evaluation results from external client acceptance.

**Exit:** Approved lifecycle scenarios pass, provenance and scope boundaries are verified, and BOSS accepts the phase report. No phase scope or configuration changes without renewed approval.
