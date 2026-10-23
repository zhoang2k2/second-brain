# Streaming checkpoint, Vietnamese UI strings, provider-error visibility

Date: 2026-10-21 · Branch: `feature/m2`

## Changes

- MVP-04: `lib/checkpoint.ts` saves in-flight assistant text at most once per second (`/api/chat`), flushed before the final/failed save. Write failures never break the stream. Covered by `tests/checkpoint.test.ts`. Limit: up to ~1 s of text can still be lost on an abrupt process kill; not verified with a real crash.
- MVP-03: `ChatWorkspace` now sets the provider error after refreshing the conversation, so the detail is no longer cleared. Source-level fix; no fresh browser reproduction.
- Unreachable Ollama now reports a recovery hint (test added).
- UI, API, CLI and error strings localized to Vietnamese; default conversation title is now "Cuộc trò chuyện mới" (legacy "New conversation" still auto-renamed).

## Validation

format:check, lint, typecheck, test (27/27), build and `git diff --check` all passed.

## Still open

MVP-02 (frontmatter `updated` on append), MVP-05 (cold/warm and browser failure-path records), BOSS's manual Obsidian read/edit acceptance. `knowledge/hello.md` (user note) and run-state files were not committed. No push, deploy or merge.

## Follow-up: MVP-02

`appendLessonUpdate` now refreshes frontmatter `updated` together with the dated `## Update` section (still serialized per file; regression test added). It rewrites the file instead of appending, so an Obsidian edit landing in the same few milliseconds could be lost; acceptable for the single-user MVP. Validation after change: lint clean, 28/28 tests, build passed. Open: MVP-05 and owner acceptance.
