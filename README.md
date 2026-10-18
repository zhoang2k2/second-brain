# Second Brain

A local-first personal AI workspace. The repository is currently at **M1 — Foundation**; chat, CLI, conversation history, lesson generation, and knowledge retrieval are not implemented yet.

## Requirements

- Node.js `>=20.9.0`
- pnpm `10.24.0`
- macOS is the current development environment; no GPU or model download is required for M1.

## Install and run

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local model configuration

`.env.example` documents `OLLAMA_BASE_URL`, with `http://localhost:11434` as the local Ollama endpoint. Copy it to `.env.local` when preparing for a future Ollama integration:

```bash
cp .env.example .env.local
```

M1 does not read this variable or connect to Ollama. A health/connectivity endpoint is deferred until it can be tested against a real local runtime. The application will not send requests to a cloud provider.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

M1 contains no domain behavior and does not add a test framework. Use a focused test for the first independently testable logic in a later milestone, and add end-to-end coverage when the chat and knowledge flows exist. The current boot check is to run `pnpm dev` and confirm the landing page loads.

## Knowledge vault

`knowledge/` is reserved for Markdown notes and can be opened as an Obsidian vault. Markdown will remain the durable source of truth. M1 adds no sample lessons, frontmatter schema, local database, or generated index.

## Current scope and next milestones

- **M1 — Foundation:** minimal Next.js shell, local configuration example, knowledge placeholder, and quality commands.
- **M2 — Chat:** Web and CLI chat, local Ollama integration, streaming, and conversation history.
- **M3 — Knowledge:** reviewed lesson creation and basic Markdown search.
- **M4 — Integration:** explicit provider choice and the end-to-end MVP scenario.

Only M1 is in the active implementation scope. Later milestones require their own owner-approved entry criteria. See [`doc/plans/phase-1-mvp.md`](doc/plans/phase-1-mvp.md).
