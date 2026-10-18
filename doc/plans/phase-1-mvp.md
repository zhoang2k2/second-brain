# Phase 1 — MVP Implementation Plan

**Goal:** Deliver the local-first chat and basic knowledge loop in four gated milestones: foundation, chat, knowledge, and end-to-end integration.

**Architecture:** Keep one root-level Next.js App Router + TypeScript application. The web UI and CLI must call the same server-side AI and knowledge logic. Start with Ollama and ordinary Markdown search; defer cloud routing until it is explicitly configured and selected.

**Tech stack:** Existing Next.js 16.4.0, React 19.3.0, TypeScript, pnpm 10.24.0. Use the versions and conventions present in the checked-out repository, not assumptions from another Next.js release.

**Source:** `~/Downloads/SECOND_BRAIN_PROJECT_HANDOFF.md`, sections 3–7 and 10.

## Current authorization

The active assignment is **M1 Foundation only**. M2–M4 are documented for later execution; this plan does not approve their implementation. BOSS approves the full scope and acceptance criteria for each milestone before it begins.

## Global constraints

- Keep the single-package, local-first design and root `app/` layout without `src/`.
- No full chat, CLI, history, lesson writes, RAG, embeddings, MCP, agent loop, deployment, Docker, or background services in M1.
- Never silently fall back from local inference to a cloud provider.
- AI-generated lesson content must be previewed/edited and explicitly confirmed before it is written.
- Do not download model weights, commit secrets, inspect secret-bearing env files, commit, or push.
- Check current repository files and the installed Next.js guide before coding. Run only checks that exist or are intentionally added in the approved milestone.

## M1 — Foundation (active scope)

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

## M2 — Chat (future milestone; not currently authorized)

### BOSS — manual, phase entry gate

- Choose or approve the Ollama model to use and its resource/performance expectations on the 16 GB Apple Silicon machine. Install/start Ollama and obtain the model locally if a live chat acceptance run is expected; the agent must not download model weights.
- Approve the conversation-history storage choice. SQLite is only a candidate in the handoff, not a settled requirement.
- Approve data-retention expectations for local conversation history and the desired resume/delete behavior.

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

## M3 — Knowledge (future milestone; not currently authorized)

### BOSS — manual, phase entry gate

- Finish or summarize Lesson 08 decisions that affect frontmatter, metadata, note organization, naming, and links. Approve the smallest MVP schema; do not require embeddings for the initial search.
- Approve what conversation content may be saved, including any sensitive-data exclusion/redaction rules.
- Approve the user review flow: generated lesson is a proposal, BOSS may edit it, and saving requires explicit confirmation.

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

## M4 — Integration (future milestone; not currently authorized)

### BOSS — manual, phase entry gate

- Decide whether cloud providers are included in MVP. If yes, name the provider(s), approve the explicit selection and cost/privacy controls, and configure credentials privately in the local environment. Never place credentials in a plan or commit them.
- Confirm the end-to-end MVP acceptance scenario and whether Obsidian opening/editing is a manual check on BOSS's machine.
- Have the selected local provider/model available for the final local acceptance run.

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
