# P1 acceptance recheck — 2026-10-11

## Verdict

**CHƯA ĐẠT nghiệm thu P1; chưa chấp thuận readiness cho P2.**

Source đã tiến bộ so với audit trước: watcher được nối vào runtime và startup gọi promotion reconciliation. Tuy nhiên startup rescan, missing-source approval/retrieval và vault-specific identity chưa đạt.

## Baseline / evidence integrity

- Branch `feature/p1-s1-independent`, HEAD `62983df`; implementation P1 vẫn dirty/untracked.
- Current source hash: `428be8906cb32fd2590930bc7d53234cfa7ef7ac64d98a72a6ca748fa7da5196`.
- Hash khớp `run-p1-final` checks/review; bốn recorded artifact hashes đều khớp.
- Recorded reviewer PASS không thay thế observed negative-case failures dưới đây.

## Fresh gates

| Gate | Actual |
| --- | --- |
| `pnpm verify` | exit 0; lint/typecheck/tests/build pass |
| Unit toàn repository | 163/163 pass |
| Integration toàn repository | 43/43 pass |
| `pnpm test:e2e` | 7/7 pass; 6 P0 cases, 1 P1 case |
| `pnpm acceptance -- P1 --profile fixture-local` | 2/2 pass: contracts/schema và storage/FTS |
| `git diff --check` | exit 2; blank line EOF tại execution-ledger.md:125 |

Lint/tooling/React act warnings còn tồn tại. Không claim zero warnings.

## Reproduction results

Diagnostics chỉ dùng SQLite in-memory và temporary vault/revision directories; không đụng user vault hoặc credentials. Fixtures được cleanup.

| Case | Actual | Audit state |
| --- | --- | --- |
| Registered vault trước startup, ghi note trước createServer, đợi 450ms | notes count=0 cho file đó | **FAIL**: startup chỉ attach watcher, không rescan existing/missed files |
| Ghi file mới sau createServer, đợi 450ms | notes count=1 | **PASS**: live watcher automatic ingestion đã wired |
| Capture Candidate, delete đúng temporary source, approve với original version/hash | ok=true | **FAIL**: missing-source CAS vẫn bị bỏ qua |
| Capture/approve note, delete khi runtime offline, start createServer, đợi 450ms, GET /v1/knowledge?column=active | HTTP 200, items=1 | **FAIL**: stale availability sau missed deletion/restart |
| Register hai vault, capture same.md có nội dung khác ở từng vault | cùng note ID | **FAIL**: identity collision chưa sửa |

Direct retrieveActive sau delete mà không rescan cũng vẫn trả 1 hit. Không claim watcher không bao giờ cập nhật deletion; đã kiểm tra riêng missed deletion trước startup để loại debounce timing khỏi kết luận.

## Source locations

- `apps/runtime/src/server/create-server.ts:228`: startup reconciliation đã có.
- `create-server.ts:266`, `:327`, `:338`: watcher creation/startup/registration attachment đã có, nhưng không gọi startup `rescanVault`.
- `apps/runtime/src/modules/knowledge/review.ts:89`: CAS lấy `SELECT root FROM vaults LIMIT 1`.
- `review.ts:92`: hash guard chỉ chạy khi file exists; thiếu file vẫn đi tiếp promotion.
- `apps/runtime/src/modules/knowledge/ingestion.ts:232`: lookup theo relative path, không vault identity.
- `ingestion.ts:374`: rescan listNotes toàn DB.
- `002_knowledge.sql`: unique path toàn DB, notes không có vault_id.
- `tests/e2e/knowledge-review.spec.ts:163`: P1 browser scenario vẫn gọi direct ingestion captureNote trước UI.

## Required closure

1. Startup/registration scan phải nhận existing files và reconcile missed edits/deletions theo đúng vault.
2. Approve phải fail closed khi source missing/unsafe, không skip CAS; preserve old Active.
3. Retrieval phải loại missing/unsafe source theo approved lifecycle, kể cả offline/restart cases.
4. Bind source identity/CAS/rescan theo đúng vault, hoặc explicitly enforce approved single-vault limit thay vì silently cho nhiều vault rồi gộp notes.
5. Add actual startup/manual-save/browser negative cases, expand domain acceptance; rerun and re-review exact final source.

P1-T2 đã cải thiện nhưng chưa đạt full lifecycle; P1-T3 và T5 còn blockers. Không sửa application code trong lượt này; report này giữ riêng, không overwrite audit trước.
