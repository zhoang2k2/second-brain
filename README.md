# Zhon — local second brain

P0 provides a protected local runtime, SQLite registration, shell/settings and a thin CLI. Knowledge ingestion/chat/execution belong to later phases.

## Start locally

Use Node 22.19.0 and pnpm 10.24.0.

```sh
pnpm install --frozen-lockfile
ZHON_ALLOWED_ROOTS=/absolute/project-parent,/absolute/vault-parent apps/cli/bin/zhon start
apps/cli/bin/zhon status
pnpm --filter @zhon/web dev --hostname 127.0.0.1 --port 3000
```

Open http://127.0.0.1:3000. Enter `browserBootstrapCode` from the local private descriptor `~/.zhon/runtime.json` into **Connect runtime**. Do not share the descriptor or paste it into logs/chat. Browser and CLI bootstrap codes are separate, one-use and expire after five minutes; restart the runtime if an unused code expires. Browser authentication uses an HttpOnly, SameSite=Strict cookie. CLI reuses its private session file across separate commands.

```sh
apps/cli/bin/zhon project register /absolute/project-parent/project
apps/cli/bin/zhon vault register /absolute/vault-parent/notes
```

No configured `ZHON_ALLOWED_ROOTS` means registration is denied. Configure allowed roots before starting the runtime. Runtime defaults to 127.0.0.1:4100; descriptor/database live under `~/.zhon`. `ZHON_DB_PATH`, `ZHON_RUNTIME_STATE`, `ZHON_PORT` and `ZHON_RUNTIME_URL` support isolated test instances. If using a different runtime port, include its origin and the web origin in `ZHON_ALLOWED_ORIGINS`. Proxy uses `ZHON_RUNTIME_URL`.

To stop the runtime, send SIGTERM to the PID in the descriptor. Restart invalidates old sessions: reconnect the browser; CLI creates a fresh session on its next registration. Sessions expire after 24 hours; restart/reconnect to renew them in P0.

An atomic lock denies another owner of the same canonical database. After an unclean crash, stop/verify the recorded owner before deliberately recovering the `.lock` file; P0 does not silently reclaim ambiguous locks.

## Validate and report

```sh
pnpm verify
pnpm exec playwright install chromium
pnpm test:e2e
pnpm acceptance -- P0 --profile fixture-local --run my-p0-run
pnpm validate:p0 my-p0-run
```

The validator stores logs, acceptance records and a source fingerprint under `docs/reports/P0/<run>/`. Independent review must supply a matching `review.json` before the report can become DoneLocal. `pnpm report -- P0 --run my-p0-run` regenerates reports from recorded evidence without rerunning app actions. Missing gates/artifacts or changed source block completion. Validation does not commit/push or assert remote CI passed.

