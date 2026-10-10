# Zhon Engineering & UI Conventions

Updated: 2026-10-10, Asia/Ho_Chi_Minh.
Authority: Approved design, `docs/brainstorming/2026-10-10-zhon-decisions.md`, and `docs/superpowers/specs/2026-10-10-zhon-design.md`.

All workers (subagents, implementers, reviewers) must strictly adhere to these conventions.

---

## 1. UI & Design System Conventions (UI v5 Baseline)

### 1.1 Color Palettes (Sky & Lime)
Role mapping: `[Background, Surface, Primary Text, Secondary Text, Sky Accent, Lime Accent]`

- **Light Mode:**
  - Background: `#F4F5F6`
  - Surface: `#E6E8EA`
  - Primary Text: `#111316`
  - Secondary Text: `#595E66`
  - Sky Accent: `#0B6FB8`
  - Lime Accent: `#5A7400`
- **Dark Mode:**
  - Background: `#0D0F11`
  - Surface: `#181B1F`
  - Primary Text: `#EAECEF`
  - Secondary Text: `#8B9199`
  - Sky Accent: `#4DB2FF`
  - Lime Accent: `#B6D94A`

### 1.2 Typography & Spacing
- **Font Family:** Be Vietnam Pro for product UI; system monospace for terminals and code output.
- **Hierarchy:** Base 14px, role-based hierarchy with ratio 1.2.
- **Grid:** Strict 8-point spacing grid (8px, 16px, 24px, 32px...).
- **Controls & Shapes:** Clean rounded cards, pill buttons, clear resolution. Avoid excessive borders and heavy drop shadows.

### 1.3 Iconography & Copy
- **Icons:** Hugeicons only (`@hugeicons/react` with `@hugeicons/core-free-icons`). Use sparingly.
- **Emoji:** Strictly FORBIDDEN in product-owned code, UI copy, and system logs.
- **Glyphs:** Remove native browser disclosure arrows and text glyphs; use Hugeicons equivalents.

### 1.4 Layout Geometry
- **Sidebar:** Exactly 280px width on desktop.
  - Primary navigation: Chats, Knowledge (with Hugeicons).
  - Scope group headers: `PERSONAL` and `PROJECTS` in uppercase at the same 14px font size.
  - Row styling: Neutral default state with a left indicator; color reserved strictly for active selection.
  - No "BOSS" or "Local" decorative labels.
  - Theme control: Explicit segmented control for Light/Dark with visible pressed state, located in bottom utilities.
- **Workspace (Center):** Rounded workspace container with distinct sections:
  - Chat section: >50% viewport height. Chat input/composer matches conversation container width.
  - Statuslines section: Equal-width grid columns for provider cards; capped at max-height 75vh with scroll when needed.
  - Context section: Bento card placed below statuslines; "Manage" opens detailed controls drawer.
- **History Rail (Right):** Narrow rail grouped by day. Hover shows `DD/MM/YYYY` tooltips; clicking a tick jumps to the first message of that day in BOSS's timezone.
- **Terminal Panel:** In-page slide-up panel from bottom toggled by footer icon. Occupies body width only (excludes sidebar). Supports Single and Split views.
- **Scrollbars:** Hidden visual appearance (`scrollbar-width: none`), but keyboard, touch, and mouse scrolling must remain fully functional.

### 1.5 Motion & Accessibility
- **Transitions:** Smooth CSS transitions / Web Animations for sidebar, accordions, drawers, dialogs, and themes.
- **Accessibility:** Mandatory `prefers-reduced-motion` honoring (disables transitions). Full keyboard navigation and proper ARIA states (`aria-expanded`, `aria-pressed`, etc.).

---

## 2. Architecture & Monorepo Conventions

### 2.1 Workspace Structure
```text
apps/
  web/          # Next.js 16 UI (presentation, view models, route proxy)
  runtime/      # Node/TypeScript Fastify 5 daemon (SQLite, domain logic, adapters)
  cli/          # Unified thin zhon CLI (communicates with runtime)
packages/
  contracts/    # Validated schemas (Zod 4), TypeScript interfaces, fixtures
docs/
  conventions/  # This conventions document
  superpowers/  # Specs, implementation plans
  reports/      # Dual-audience phase completion reports
```

### 2.2 Strict Dependency Rules
- `Web` and `CLI` -> `packages/contracts` and runtime HTTP/SSE/WS endpoints.
- `Runtime` -> `packages/contracts`.
- `Contracts` -> schema dependencies only. NEVER import from `apps/web`, `apps/runtime`, or database packages into contracts.
- Web and CLI are clients of the runtime; neither bypasses runtime business logic or talks directly to SQLite.

### 2.3 Component & Presentation Boundaries
- **Strict Separation of Concerns:** UI rendering must be decoupled from business and execution logic.
- **No Inline Business Logic:** Zero business calculation or nested array mapping logic in HTML/JSX.
- **View Models:** Prepare derived view models, lists, and formatted data in custom hooks or view-model functions outside JSX.
- **API Client:** UI components must never import raw HTTP clients directly; they interact through feature services and hooks.

### 2.4 Language Policy
- **Code & Comments:** English only.
- **UI Copy:** English only for product interface.
- **Agent Reports:** English handoff document (`agent.md`).
- **Human Reports & Knowledge:** Vietnamese explanations and examples (`user.vi.md`, vault note explanations for BOSS).

---

## 3. Communication, Contracts & Security Conventions

### 3.1 Common Contract Types
Exported from `packages/contracts/src/common.ts`:
```ts
export type ID = string;
export type Instant = string; // ISO 8601 UTC
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };
export type ApiError = { code: string; message: string; retryable: boolean };
export type Command<T> = { requestId: ID; idempotencyKey: ID; expectedVersion?: number; payload: T };
export type RuntimeEvent<T> = { sequence: number; type: string; resourceId: ID; occurredAt: Instant; payload: T };
export type Scope = { kind: 'global' } | { kind: 'project'; projectId: ID };
```

### 3.2 Transports
- **Commands / Queries:** Local HTTP `POST /v1/commands/<name>` using `Command<T>` envelope; standard `GET` queries.
- **Event Streaming:** SSE `/v1/events?after=<sequence>`. Reconnects use sequence cursor or resnapshot.
- **Terminals:** WebSocket `/v1/terminals/<sessionId>/stream`. Terminal byte chunks are separated from durable state events.

### 3.3 Security & Sandbox Boundaries
- **Loopback Binding:** Runtime binds only to `127.0.0.1`.
- **Local Session Protection:** Unguessable bootstrap token; strict origin/host headers validation; WebSocket origin validation.
- **Credentials:** Stored securely in macOS Keychain. Zero plaintext secrets in database, logs, URLs, or prompts. Workers access only `env.example`.
- **Filesystem Boundaries:** Enforce canonical registered paths. Reject path traversal (`..`) and symlink escapes at registration and access time.

---

## 4. Knowledge & Second Brain Conventions

- **Storage:** Obsidian-compatible Markdown vault, physically separate from zhon source.
- **Three Columns:** `Active`, `Candidate`, `Deactive` (stored as `Deactivated`).
- **Revisions:** Every note modification (manual or automated) creates an immutable snapshot revision and enters `Candidate`.
- **Integrity:**
  - Saving in Obsidian NEVER automatically activates a note.
  - Editing an Active note preserves the prior Active revision for retrieval while the new revision is reviewed.
  - Deactivation immediately excludes a note from future retrieval.
- **Scope-First Retrieval:** Scoped search strictly filters by allowed project/global boundaries before ranking relevance. Foreign project notes are never accessed without explicit permission.

---

## 5. Development & Git Workflow Conventions

- **Next.js Breaking Changes:** Follow `RULE[/Users/hoang.nguyen/Personals/second-brain/AGENTS.md]`. Always consult installed docs in `node_modules/next/dist/docs/` before writing Next.js code.
- **Test-Driven Development (TDD):** Strictly write failing tests first (RED), verify the exact failure, implement minimal code (GREEN), then refactor.
- **Testing Standard Commands:**
  - `pnpm test:unit -- <test-path>`
  - `pnpm test:integration -- <test-path>`
  - `pnpm test:e2e -- <spec-path>`
  - `pnpm verify` (lint + typecheck + unit + integration + build)
- **Git Restrictions:**
  - NO automatic commits. A commit requires an explicit request from BOSS.
  - Git PUSH is strictly FORBIDDEN for all agents.
  - NO protected branch merge in MVP.
  - Concurrently executing workers must operate in isolated Git worktrees.
- **Dual Reporting:** Every phase must produce two reports:
  - English agent handoff: `docs/reports/<phase>/<run-id>/agent.md`
  - Vietnamese human explanation: `docs/reports/<phase>/<run-id>/user.vi.md`
