# Chat response synchronization and Obsidian vault

Date: 2026-10-20

Branch: `feature/m2`

## Requested scope

- Fix responses that require reloading before they appear in the chat UI.
- Verify input, output-token limit, history/context, and temperature in outgoing Ollama requests.
- Investigate why the saved knowledge is absent from Obsidian.

## Evidence and root causes

- A fresh real-model chat completed and appeared without reloading. The original browser session was not available, so this does not identify every possible trigger of BOSS's report.
- A controlled browser reproduction did confirm a dropped-update path: reopening a conversation during streaming replaces the browser-created assistant ID with the persisted server ID. Subsequent updates target the old ID and no longer find a message.
- The original client waits for HTTP EOF and a separate conversation fetch before treating the response as complete. With a completed synthetic stream whose HTTP body remains open, the reproduced UI remains on `Thinking…` despite receiving the response and completion event.
- The Ollama adapter also ignored the provider's `done: true` completion signal. A local HTTP-server regression test failed with `Still waiting after done` before the fix.
- Obsidian was opening `/Users/hoang.nguyen/Documents/Obsidian Vault`, while the application writes under the MVP worktree's `knowledge/`. The lesson `hello.md` was already present there and was preserved.

## Changes

- Shared browser/server message and stream types in `lib/chatTypes.ts`.
- The server immediately emits a `start` event containing the persisted assistant ID, includes that ID in each `delta`, and emits the full persisted answer with `done` after saving it.
- The UI applies immutable updates against the same message ID, replaces the answer from the final event, and completes on `done` without a second conversation-detail fetch or page reload.
- The Ollama adapter stops consuming at `done: true` and releases its response reader.
- The composer enters its busy state before conversation creation to reduce duplicate submissions.
- README now documents the exact folder selection process and current request limitations. Obsidian preferences under `knowledge/.obsidian/` are ignored by Git.

## Verified request contract

Browser to application: `{ conversationId, message }`.

Application to Ollama: `{ model: "qwen3.5:latest", stream: true, messages }`.

- The current trimmed input is included once as the final user message.
- Context consists of system instructions, at most 20 completed history messages, retrieved note snippets, and the current input.
- The existing history cap is message-count based, with no token counting, summarization, or context-window budget guarantee.
- `temperature`, `num_ctx`, and output limit `num_predict` are not currently passed. Model/runtime defaults apply. No output-token feature was added.
- A request-payload test now checks the input, history selection, selected model, streaming flag, and absence of explicit options.

These concepts are shared across LLM APIs, but provider parameter names and supported ranges differ. `max_tokens` is an output cap, while context-window capacity covers the input and generated output. Temperature controls sampling randomness; it is not a correctness or creativity permission switch. Consult the selected model's API before configuring it.

References: [Ollama Chat API](https://docs.ollama.com/api/chat), [Ollama parameter reference](https://docs.ollama.com/modelfile), [Claude Messages API](https://platform.claude.com/docs/en/api/messages/create), [Obsidian vault setup](https://obsidian.md/help/vault).

## Verification

- `pnpm test`: 21 tests across 5 files passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed, Next.js 16.4.0.
- Production browser regression: reopened the in-flight conversation, delivered synthetic `delta` and `done`, deliberately kept HTTP open. The response `AUTOMATIC_RESPONSE_OK` appeared, the composer exited busy state, and the navigation count stayed at 1. No browser error or warning was reported. This fixture intercepted fetch only inside its isolated browser tab and wrote no application data.
- Production preview was rebuilt and restarted at `http://127.0.0.1:3210`.
- Final production real-model acceptance: `qwen3.5:latest` returned `FINAL_STREAM_OK` directly in the UI without a reload. The network log contained the chat POST and a conversation-list GET, with no conversation-detail GET needed for completion. The stream immediately showed a persisted assistant placeholder before model generation completed.
- Removed only the two synthetic acceptance conversations created during this investigation. Existing conversation history and `knowledge/hello.md` were preserved.

## Obsidian result

Opened the existing folder as a vault through Obsidian's UI:

`/Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2/knowledge/`

The Obsidian window changed to `New tab - knowledge - Obsidian 1.14.4` and its file list displayed `hello` and `README`. Existing note content was not edited. This confirms vault registration and file discovery; BOSS's manual read/edit acceptance remains separate.

## PR draft

Title: `[FIX] Synchronize chat responses with persisted stream events`

Summary: Keep assistant IDs consistent between streaming UI and persisted history, complete on explicit protocol events, and document the local vault and current model request options.

No push, deployment, or merge is authorized by this report.
