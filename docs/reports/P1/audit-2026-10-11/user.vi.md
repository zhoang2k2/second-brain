# P1 — Independent acceptance audit

Ngày: 2026-10-11, Asia/Ho_Chi_Minh.

## Verdict

**CHƯA ĐẠT nghiệm thu P1. Chưa chấp thuận P1 DoneLocal hoặc readiness cho P2.**

P1 đã có implementation đáng kể: contracts, schema, ingestion/revision services, review/search, UI, route integration và tests. Tuy nhiên luồng runtime thật chưa tự ingest Markdown, và các source-availability/identity cases bắt buộc còn sai.

Đây là report mới, không ghi đè certification/evidence cũ. Lượt audit không sửa application code, commit, push hoặc merge. Các diagnostics chỉ dùng temporary fixture directories và SQLite in-memory, được cleanup sau chạy.

## Baseline và recorded evidence

- Repository: `/Users/hoang.nguyen/Personals/second-brain`.
- Branch: `feature/p1-s1-independent`; HEAD `62983df`.
- P1/S1 changes vẫn modified/untracked, chưa nằm trong HEAD.
- Current source fingerprint: `ee83f2f371fd52f26d686c281619efee4ee2d672998ea70f3ffff1610d49efde`.
- Fingerprint khớp `docs/reports/P1/run-p1-final/checks.json` và recorded reviewer PASS.
- Cả bốn evidence artifacts local_verify/browser_e2e/acceptance_p1/independent_review khớp stored SHA-256.
- Evidence integrity xác nhận files khớp, không xác nhận test coverage đầy đủ hoặc reviewer không bỏ sót defects.

## Fresh verification

| Gate | Kết quả |
| --- | --- |
| `pnpm verify` | exit 0; lint/typecheck/unit/integration/build PASS |
| Unit | 152/152 PASS; đây là toàn repo, gồm P0/P1/S1 |
| Integration | 39/39 PASS; đây là toàn repo |
| `pnpm test:e2e` | exit 0; 7/7 PASS, trong đó chỉ 1 P1 browser scenario |
| `pnpm acceptance -- P1 --profile fixture-local` | exit 0; 2/2 PASS |
| `git diff --check` | exit 2; trailing blank line ở execution-ledger.md:124 |

Warnings: lint có một warning và monorepo/tooling notices; KnowledgeView tests có React act warnings. Không gọi kết quả là zero warnings.

## Required findings

### F1 — Runtime chưa nối ingestion/watcher/startup rescan

Severity: **Must fix / release blocker**. Affects P1-T2, P1-T5.

Fact:

- `apps/runtime/src/main.ts` khởi tạo server nhưng không khởi tạo KnowledgeIngestionService/VaultWatcher hoặc startup rescan/reconcile.
- `apps/runtime/src/server/create-server.ts:223` trở đi chỉ tạo revision/review/retrieval services và đăng ký knowledge routes.
- Không có production watcher subscription để nhận Markdown save hoặc cập nhật availability khi source bị xóa.
- E2E `tests/e2e/knowledge-review.spec.ts:161` trực tiếp gọi `runtime.ingestion.captureNote()`, bypass integration còn thiếu.

Diagnostic: tạo server bằng production createServer với temporary revisions directory; đăng ký vault trong cùng SQLite; ghi manual.md rồi chờ 400ms. Query DB cho kết quả **notes=0, candidates=0**. Kết hợp với absence của startup/watcher wiring chứng minh luồng save-to-Candidate chưa hoàn thiện, không chỉ chậm debounce.

Acceptance needed:

- Start runtime thật, register vault bằng product flow, lưu Markdown; Candidate tự xuất hiện mà test không gọi ingestion trực tiếp.
- Startup rescan tìm thay đổi khi runtime ngừng; watcher lifecycle/cleanup và error states đúng.
- Startup recovery thực sự gọi promotion reconciliation, không chỉ unit test helper.

### F2 — Approve vẫn thành công khi source đã bị xóa

Severity: **Must fix / release blocker**. Affects P1-T3.

Evidence: `apps/runtime/src/modules/knowledge/review.ts:89` chọn vault đầu tiên; tại `:92` chỉ kiểm tra hash nếu file tồn tại. File không tồn tại thì tiếp tục promotion.

Diagnostic: capture deleted.md, xóa đúng temporary source, gọi approveCandidate với candidate/version/hash gốc → **ok=true**, note availability vẫn **available**, active revision được set.

Acceptance needed: missing/unsafe source phải từ chối promotion theo policy, preserve old Active pointer; validate đúng source identity/canonical boundary và report actionable issue. Không skip CAS khi thiếu file.

### F3 — Deleted source vẫn được retrieve

Severity: **Must fix / release blocker cho P2**. Affects P1-T2, P1-T3.

Diagnostic: capture live.md, approve, xóa source rồi gọi retrieveActive ngay, không gọi rescan bằng test → **hits=1**.

Root cause from source: retrieval dùng DB availability; runtime không nối deletion watcher/rescan. Test hiện tại chỉ chứng minh việc gọi rescan thủ công cập nhật missing, không chứng minh product lifecycle.

Acceptance needed: deleted/unsafe source không còn eligible cho query tiếp theo theo approved requirement, kể cả missed watcher/startup cases. Không xóa immutable history để giải quyết.

### F4 — Note identity không gắn vault, hai vault cùng relative path bị gộp

Severity: **Must fix cho registration hiện cho phép nhiều vault**. Affects P1-T1–T3.

Evidence:

- `002_knowledge.sql`: notes.path unique toàn DB, không có vault_id.
- `ingestion.ts:232`: findNoteByPath chỉ nhận relative path.
- `ingestion.ts:374`: rescan một vault xử lý listNotes toàn DB.
- `review.ts:89`: CAS dùng `SELECT root FROM vaults LIMIT 1`, không source vault của note.

Diagnostic: register vault a và b; mỗi vault có same.md với nội dung khác; capture cả hai → **firstNoteId === secondNoteId**. Hai source riêng bị gộp một identity.

Acceptance needed: hoặc explicitly enforce supported single-vault policy, hoặc persist vault-specific identity/path và scope mọi ingestion/rescan/CAS theo đúng vault. Không silently chọn vault đầu tiên hoặc invalidate notes của vault khác. Approach phải phù hợp approved spec, không tự mở rộng product.

## Vì sao các gates xanh chưa đủ

- P1 acceptance chỉ đăng ký schema check và storage/FTS check. Storage check insert trực tiếp rows, không chạy full save/review/retrieval workflow.
- P1 browser test là approval/persistence flow cho Candidate được tạo trực tiếp bằng service call.
- Các tests delete/startup thường gọi rescan helper trực tiếp; thiếu coverage cho runtime wiring.
- Recorded reviewer PASS cho đúng source nhưng bỏ sót findings đã reproduce. Không dùng certification đó để override observed failures.

## Task-level acceptance status

| Task | Audit state |
| --- | --- |
| P1-T1 contracts/schema | Implemented, nhưng vault/source identity chưa đáp ứng current multi-vault registration behavior |
| P1-T2 ingestion/revisions | Services/tests đã có; production wiring và source lifecycle chưa đạt |
| P1-T3 review/search/promotion | Happy paths đã có; missing-source CAS/retrieval chưa đạt; recovery startup chưa wired |
| P1-T4 UI | Component tests và một P1 browser flow pass; chưa được nghiệm thu với automatic manual-save workflow |
| P1-T5 integrated acceptance/reports | Reports tồn tại, nhưng acceptance scenarios chưa bao phủ full Done requirement |

## Next acceptance gate

1. Resolve F1–F4 theo bounded P1 scope, thêm failing regression cases trước sửa.
2. Browser E2E phải dùng actual runtime startup/registration/manual saves, không inject Candidate bằng direct capture call.
3. Test missing source trước approve, delete sau approve, restart/missed change và source identity giữa vaults.
4. Rerun verify, P1 E2E và expanded domain acceptance; reviewer mới kiểm tra exact final source/artifact hash.
5. Lưu new run-id và reports; cập nhật ledger để bỏ false-complete status. Không ghi đè historical evidence.

Chỉ sau các gates này mới xác nhận P1 DoneLocal và bàn giao retrieveActive cho P2. Đây không phải report nghiệm thu S1 hay remote deployment.
