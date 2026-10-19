# Phase 1 — MVP Implementation Plan

**Goal:** Deliver the local-first chat and basic knowledge loop in four gated milestones: foundation, chat, knowledge, and end-to-end integration.

**Architecture:** Keep one root-level Next.js App Router + TypeScript application. The web UI and CLI must call the same server-side AI and knowledge logic. Start with Ollama and ordinary Markdown search; defer cloud routing until it is explicitly configured and selected.

**Tech stack:** Existing Next.js 16.4.0, React 19.3.0, TypeScript, pnpm 10.24.0. Use the versions and conventions present in the checked-out repository, not assumptions from another Next.js release.

**Source:** `~/Downloads/SECOND_BRAIN_PROJECT_HANDOFF.md`, sections 3–7 and 10.

## Current authorization

M1 Foundation is complete. On 2026-10-20 BOSS approved the M2–M4 local MVP scope and end-to-end acceptance checklist. Continue in dependency order on the existing `feature/m2` worktree. Use local Ollama model `qwen3.5:latest`; synthetic, non-sensitive prompts are approved for implementation acceptance. There is no latency SLA; measure and report observed performance. Cloud is excluded until a future phase. Local commits are allowed; do not push, deploy, or merge protected branches. See `.agent-runs/MVP-OWNER-CHECKLIST.md` for the approved data, history, knowledge, and Obsidian decisions.

## Global constraints

- Keep the single-package, local-first design and root `app/` layout without `src/`.
- No full chat, CLI, history, lesson writes, RAG, embeddings, MCP, agent loop, deployment, Docker, or background services in M1.
- Never call cloud or silently fall back from local inference to a cloud provider in this MVP.
- AI-generated lesson content must be previewed/edited and explicitly confirmed before it is written.
- Do not download additional model weights, commit secrets, inspect secret-bearing env files, or push.
- Check current repository files and the installed Next.js guide before coding. Run only checks that exist or are intentionally added in the approved milestone.

## M1 — Foundation (completed)

### BOSS — manual, phase entry gate

- **Required:** None. The handoff explicitly allows foundation work while BOSS studies Lesson 08.
- **Optional:** Start Ollama locally if the agent is asked to verify a real connectivity check. If it is unavailable, keep connectivity verification deferred and report that blocker; do not download a model or pretend the provider was tested.

### FE agent

- Inspect the existing root `app/page.tsx`, `app/layout.tsx`, and `app/globals.css` before editing.
- Preserve or simplify the current starter screen into a small boot-verification shell. Do not implement chat UI.
- Verify the page works with the installed Next.js version and the existing `cacheComponents` configuration; read the matching local Next.js guide first.

### BE agent

- Audit the existing package scripts, TypeScript, lint, Next.js, and pnpm configuration before changing them.
- Add only missing, lightweight quality checks and a documented configurable Ollama base URL in `.env.example`; no real credentials or provider router.
- Add a minimal health/connectivity path only if it is small, safe, and testable without Ollama being installed. Otherwise document why it is deferred.
- Keep the app single-package. Do not add SQLite, CLI, or database infrastructure in M1.

### Shared agent work and acceptance gate

- Add a minimal `knowledge/` placeholder without fabricated lessons or large seed data.
- Update README with prerequisites, install/dev/check commands, configuration, current M1 status, and next milestones.
- Review `.gitignore` for secrets, build output, local databases, downloaded weights, caches, and generated indexes while leaving Markdown knowledge trackable.
- Run the available lint, typecheck, tests (if configured), and production build. Report each command and exact result; describe environmental blockers.
- Confirm root `app/` exists and `src/` does not; app starts using documented commands; no M2+ behavior was added; no commit or push was made.

**M1 exit:** All handoff Definition of Done items are satisfied or the remaining blockers are named precisely. BOSS reviews the M1 report and explicitly starts M2.

## M2 — Chat (active)

### BOSS — decisions resolved 2026-10-20

- Use the existing local `qwen3.5:latest`; synthetic non-sensitive inference prompts are approved. Measure and report latency; there is no fixed target.
- Agent chooses minimal local persistence and documents the trade-off. Keep history until explicit deletion, resume after restart, preserve interrupted responses, and delete history without deleting confirmed lessons.

### FE agent

- Build the web chat flow: conversation list/resume, message composer, streaming response display, and Markdown/code rendering.
- Implement explicit loading, provider-unavailable, cancelled/failed response, and empty-history states.
- Keep provider selection and cloud options out of UI until M4 requirements are approved.

### BE agent

- Implement the shared server-side chat operation against the configured local Ollama endpoint, including streamed responses and useful errors.
- Add local conversation persistence and resume behavior using the owner-approved storage and retention contract.
- Provide a thin CLI that calls the same chat logic; it must not implement a second model engine.
- Validate configuration and avoid logging prompts/secrets unnecessarily.

### Shared work and acceptance

- Define the FE/BE message, streaming, error, and conversation contracts before parallel implementation.
- Verify a user can chat with the selected local model from Web and CLI, stop/resume a conversation, and see predictable provider errors.
- Run the approved local checks plus a real Ollama acceptance run. Mark provider acceptance blocked if Ollama/model is unavailable.

## M3 — Knowledge (active after M2 contracts)

### BOSS — decisions resolved 2026-10-20

- Agent chooses a minimal Markdown schema in `knowledge/`; keyword/full-text search only, no embeddings.
- Each knowledge item has a unique keyword/slug identity. Detect collisions before writing, never create duplicate knowledge or silently overwrite. When the same key has materially different/new information, show a diff and propose an additive update for BOSS review; only apply after explicit confirmation.
- Use only content BOSS deliberately enters; exclude secrets, credentials, and company/customer data from acceptance fixtures. A lesson is a proposal and requires explicit review/confirmation before write. Automatic comprehensive secret redaction is not required or promised.

### FE agent

- Add a “Save as Lesson” proposal preview/edit/confirm flow.
- Add knowledge search UI that shows matched note titles and source references; present retrieved material distinctly from model-generated text.
- Handle no matches, file conflicts, validation errors, and cancelled saves.

### BE agent

- Implement Markdown note creation and basic keyword/full-text search over the approved `knowledge/` vault.
- Validate frontmatter and note content against the owner-approved schema; constrain writes to the vault and prevent path traversal or unintended overwrite.
- Return source paths/snippets with retrieved context so grounded answers can cite notes.
- Do not add vector storage, automatic note replacement, deduplication, or background indexing in this milestone.

### Shared work and acceptance

- Keep Markdown files as the durable source of truth and make `knowledge/` openable as an Obsidian vault.
- Verify preview/edit/cancel/confirm, saved Markdown readback, search result provenance, and an answer grounded in a saved note.
- Test malformed metadata, duplicate names, empty search results, and unsafe paths.

## M4 — Integration (active after M2 and M3)

### BOSS — decisions resolved 2026-10-20

- MVP is local-only with Ollama `qwen3.5:latest`; cloud support is for a future phase. Do not add cloud adapters, API keys, selectors, or fallback behavior.
- BOSS approved the end-to-end acceptance scenario and will manually open/read/edit a saved lesson in Obsidian after the implementation provides the exact vault and file path.

### FE agent

- Make provider choice visible and intentional if cloud support is approved. Clearly show which provider handles a request.
- Complete accessible, coherent states across chat, lesson review, knowledge search, and provider errors.

### BE agent

- Add only the owner-approved provider adapter/configuration. Require deliberate cloud selection; never silently fall back from Ollama.
- Ensure secrets are read from local configuration, never returned to the browser or written into logs/repository artifacts.

### Shared work and acceptance

- Run the full flow: Web or CLI → local chat → reviewed lesson → Markdown in Obsidian → question answered with cited saved knowledge.
- If cloud support is approved, separately verify explicit cloud selection, configuration failure, and no implicit cloud request when local inference fails.
- Run lint, typecheck, configured tests, and production build. Report runtime/model/Obsidian checks separately from source-level checks.

**MVP exit:** The handoff's end-to-end acceptance scenario passes and the checks are reported truthfully. BOSS reviews the outcome before Phase 2 is planned for execution.
