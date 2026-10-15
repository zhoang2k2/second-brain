# Báo cáo P1

Kết quả: **DoneLocal**
Run: run-p1-completion-20261011-resumed

| Gate | Kết quả | Evidence / lý do |
| --- | --- | --- |
| local_verify | PASS | /Users/hoang.nguyen/Personals/second-brain/docs/reports/P1/run-p1-completion-20261011-resumed/local_verify.log |
| browser_e2e | PASS | /Users/hoang.nguyen/Personals/second-brain/docs/reports/P1/run-p1-completion-20261011-resumed/browser_e2e.log |
| acceptance_p1 | PASS | /Users/hoang.nguyen/Personals/second-brain/docs/reports/P1/run-p1-completion-20261011-resumed/acceptance_p1.log |
| independent_review | PASS | /Users/hoang.nguyen/Personals/second-brain/docs/reports/P1/run-p1-completion-20261011-resumed/review.json |

Quy trình kiểm duyệt ghi chú (Knowledge review): Khi một file Markdown trong vault thay đổi, hệ thống tạo bản ghi Candidate mới. Người dùng duyệt phiên bản này trên UI 3 cột; sau khi Approve bằng atomic CAS, ghi chú chuyển sang cột Active và được lập chỉ mục tìm kiếm FTS5.

DoneLocal chỉ chứng minh local gates có recorded evidence. Remote CI chưa được xác minh; source chưa commit/push.
P1 hoàn tất xác thực và sẵn sàng cho P2.

## Phạm vi đã hoàn thiện

| Hạng mục | Kết quả |
| --- | --- |
| Startup/registration/manual save tự tạo Candidate | PASS qua runtime và browser thật |
| Source mất/unsafe hoặc duplicate ID | Chặn approve/retrieval theo lifecycle; giữ immutable history |
| Snapshot mất/hỏng hoặc revision bytes sai hash | Chặn approve/rollback/recovery; retrieval kiểm tra approved bytes/hash |
| Candidate mới, stale/rejected history | Chỉ revision hiện tại chờ review; bản cũ giữ trong history |
| Approve/reject, deactivate/rollback, search và project scope | PASS; không dùng model/provider |
| Transaction ngắt sau đổi pointer | Giữ Active cũ, source mới và Candidate; không ghi event/receipt thành công |
| Verification toàn repo | 167/167 unit, 84/84 integration; lint/typecheck/build PASS |
| Browser và P1 acceptance | 7/7 browser tests, 3/3 acceptance checks PASS |
| Review độc lập | PASS cho source hash khớp checks.json; không còn Must fix/Should fix |

Ví dụ: sửa một note đã Active tạo Candidate mới; context vẫn dùng bytes/hash của bản được duyệt cũ. Nếu source mất hoặc identity bị trùng, hệ thống chặn review/retrieval thay vì chọn một file tùy ý.

Giới hạn MVP: một vault; flat scalar frontmatter, không hỗ trợ general/nested YAML. Native watcher đã xác minh trên máy macOS hiện tại. Còn warning lint/tooling/React act không chặn các gates; không sửa ngoài scope.

Bàn giao P2: dùng retrieveActive và exact immutable approved revision IDs/hashes. Khi backup cần giữ cả SQLite lẫn revision snapshots; Git sync Markdown không tự mang theo approval state.
