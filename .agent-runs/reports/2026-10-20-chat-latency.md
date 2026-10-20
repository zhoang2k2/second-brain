# Chat first-answer latency

Date: 2026-10-20

Branch: `feature/m2`

## Symptom

BOSS waited more than 30 seconds after sending a message and still saw only `Thinking…`.

## Evidence

The local Ollama `/api/show` response for the approved `qwen3.5:latest` reported:

- Thinking controls: `values: [false, true]`, `default: true`.
- Model size: 9.7B, NVFP4, MLX runner.
- The running model had a context length of 4096 and was already loaded during the measurements.

The adapter did not set `think` and consumed only `message.content`. Ollama thinking output is delivered separately as `message.thinking`, so the UI did not change while the model generated that output. This confirms a source of the long wait; the original reported request was not traced, so other contributors to that request are not ruled out.

## Controlled local measurements

Both direct Ollama probes used the same synthetic prompt, `Reply exactly OK.`, a warm model, streaming, and a diagnostic `options.num_predict: 128` cap. The cap bounded only the diagnostic probes and was not added to the application.

| Request                         | First thinking | First answer               | Observed completion                                                                                                 |
| ------------------------------- | -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Model default (`think` omitted) | 1.304 s        | No answer within the probe | 11.871 s; 128 generated tokens, 541 thinking characters, zero answer characters; stopped by diagnostic length limit |
| `think: false`                  | None           | 0.799 s                    | 0.799 s; answer `OK`, normal stop                                                                                   |

Model loading took approximately 0.005–0.007 seconds in both probes. These are individual warm-run observations, not benchmark medians or a latency SLA.

## Change

- Added top-level `think: false` to the shared Ollama chat request used by the web application and CLI.
- Kept the approved local model and existing context behavior.
- Added a request-payload regression assertion for `think: false`.
- Moved test request assertions out of the mock HTTP callback so failed assertions report directly instead of leaving the request hanging.
- Documented the behavior and trade-off in README.

Disabling thinking removes the separate extended-thinking phase for ordinary MVP chat. Complex reasoning tasks may benefit from an explicit thinking mode in a future feature. Context processing, model loading, and hardware contention still affect latency.

## Verification

- Regression assertion failed before the fix: `expected undefined to be false`.
- `pnpm test`: 21/21 tests passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed with Next.js 16.4.0.
- `pnpm format:check` and `git diff --check`: passed.
- Rebuilt and restarted production preview at `http://127.0.0.1:3210`.
- Full application API acceptance with a synthetic prompt: `start` at 0.013 s, first answer at 1.208 s, `done` at 1.210 s with message status `complete` and answer `OK`. The synthetic conversation was deleted by its exact ID afterward; existing notes and conversations were preserved.

## Reference

[Ollama thinking controls and separate response fields](https://docs.ollama.com/capabilities/thinking).

## PR draft

Title: `[FIX] Disable extended thinking for responsive local chat`

Description: Send `think: false` for the approved local Qwen model, verify the outgoing request, and document the measured first-answer latency and reasoning trade-off.

No push, deployment, or merge was performed.
