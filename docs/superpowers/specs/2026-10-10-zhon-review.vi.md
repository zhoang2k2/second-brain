# Zhon — bản thiết kế để BOSS review

Status: BOSS đã duyệt thiết kế và roadmap để viết plans vào 10/10/2026. UI v5 đã được chấp thuận tạm thời. Đã có bộ plans P0–P7 và S1; plans chưa được duyệt để execution, chưa triển khai sản phẩm.

## BOSS đang xây gì?

Zhon có hai vai trò:

- **Second brain:** giữ, liên kết và tìm lại kiến thức cá nhân; giúp BOSS và agent sử dụng kinh nghiệm đã có.
- **Orchestrator:** điều phối các CLI agent theo plan BOSS duyệt, kiểm tra kết quả và báo blocker.

Mục tiêu “x2 hiệu suất” là hướng đánh giá sản phẩm. Chưa thể hứa đạt hệ số đó. Nên đo bằng thời gian tìm lại kiến thức, lỗi lặp lại và lượng can thiệp khi chạy một phase.

Continuous learning ở đây cập nhật nội dung, không huấn luyện trọng số model.

## Các file cần đọc

| File | Để hiểu gì? |
| --- | --- |
| [Thiết kế tổng thể](2026-10-10-zhon-design.md) | Component, package structure, permissions, retrieval, UI, kiểm chứng |
| [Data và lifecycle](2026-10-10-zhon-data-lifecycles.md) | Những record cần lưu, trạng thái, retry/crash/approval |
| [Roadmap và ownership](2026-10-10-zhon-delivery-map.md) | Phase, task FE/BE, dependency, Done, blockers |
| [Hai loại report](2026-10-10-zhon-report-templates.md) | Format cho agent và BOSS |

## Roadmap đề xuất

| Phase | Feature BOSS nhận được | Gate chính |
| --- | --- | --- |
| P0 | Local app, navigation/themes, đăng ký project/vault, CLI và CI nền tảng | Toolchain/contracts/state dùng được |
| P1 | Note Obsidian vào Candidate; search, duyệt, Deactivate | Không dùng nhầm note chưa duyệt/project khác |
| P2 | Gemini chat, history, Context và giữ ý quan trọng | API thật, context/history tách biệt, budget |
| P3 | Tự tạo Candidate hữu ích và gợi ý topics/links | Profile được duyệt, không tự Active |
| P4 | Một CLI worker, plan approval, managed terminal Single/Split | Sandbox thật và CLI thật đạt policy |
| P5 | Điều phối phase với nhiều agent; integrate, review/test, apply và report | Không conflict/ghi đè; application an toàn |
| P6 | Theo dõi GitHub Actions đúng commit/test/build | Read-only access và mapping đúng |
| P7 | Recovery, backup/restore, đánh giá toàn MVP | Không replay side effects mù quáng |

**S1 — sandbox feasibility** là nhánh riêng có thể làm từ P0. Nếu S1 chưa đạt, P0–P3 vẫn xây được second brain; P4 chưa được bật coding execution.

## FE/BE độc lập ra sao?

Ví dụ P1:

1. Chốt contract: Candidate trả những field nào, approve lỗi khi nào.
2. FE làm cột/accordion/search/review trong `apps/web/src/features/knowledge/`.
3. BE làm revisions/search/promotion trong `apps/runtime/src/modules/knowledge/`.
4. Integrator nối hai bên, quản lý schemas/migrations/lockfile.
5. Tester kiểm tra với vault và runtime thật.

**Contract** là thỏa thuận dữ liệu giữa hai bên. Nếu FE nghĩ `status` là A nhưng BE trả B, hai worktree riêng vẫn không giúp feature hoạt động.

FE có thể dùng fixture khi BE chưa xong. Fixture là dữ liệu phục vụ test giao diện, không phải bằng chứng API hoặc sandbox đã chạy thật.

## Các điểm thiết kế được làm rõ

- **Active revision khác file mới nhất:** BOSS sửa note thì có Candidate mới; agent vẫn dùng bản đã duyệt trước đó.
- **Context khác history:** context là phần gửi model lần này; history là toàn bộ chat được lưu. Summary không xóa history.
- **Scope trước relevance:** tìm đúng phạm vi được phép trước, rồi mới xếp hạng liên quan. Tương tự vấn đề không tự cho quyền đọc source project khác.
- **DoneLocal khác remote CI:** local pass không chứng minh commit trên GitHub/deployment đã pass.
- **Worktree khác sandbox:** worktree cách ly code; sandbox enforce quyền đọc/ghi/process/network.
- **Report khác knowledge:** kết quả và bài học có thể tạo Candidate, không tự thành Active.

## Đề xuất mới cần BOSS review

Các mục này chưa được coi là quyết định đã duyệt trong brainstorming:

| Đề xuất | Vì sao cần |
| --- | --- |
| Budget riêng cho mỗi conversation session | Chat/summary cũng tiêu tiền dù không nằm trong execution phase |
| Knowledge profile có budget mỗi batch và tổng mỗi ngày | Batch nhỏ nhưng chạy nhiều lần vẫn có thể tốn tiền |
| Approval phải có expiry do BOSS chọn; expiry/revoke chặn action mới và yêu cầu dừng worker | Không để một plan cũ có quyền vô thời hạn |
| Upstream mặc định strict: HEAD phải bằng upstream sau fetch | Định nghĩa rõ “up to date”; ahead/behind/missing upstream sẽ block |
| Topics/links tự phát triển; chưa tự di chuyển folders hàng loạt | Giữ đường dẫn Obsidian ổn định trong bản đầu |
| Be Vietnam Pro cho UI; monospace cho terminal | Chốt tên font và vai trò riêng của code output |
| HTTP + SSE cho state/chat, WebSocket cho terminal | Web và CLI dùng một runtime; terminal cần dữ liệu hai chiều |

Không cần BOSS chọn số tiền/model ngay trong bản thiết kế. Những giá trị đó phải được cấu hình trước khi gọi API hoặc giao task thật.

## Blockers không thể giải quyết chỉ bằng tài liệu

| Blocker | Cần làm gì để có evidence? |
| --- | --- |
| CLI/sandbox tương thích hay không | Kiểm tra phiên bản đã cài và chạy probe với fake secrets/test repo |
| Provider có metric 5h/1w hay không | Kiểm tra nguồn status thật của từng integration; thiếu thì hiện Unavailable |
| Gemini key/Keychain hoạt động | BOSS nhập credential qua Settings, sau đó chạy smoke flow và redaction tests |
| GitHub CI đọc được hay không | Cấu hình read-only auth, workflow/jobs và commit thật |
| Toolchain/conventions | Xác minh package/versions; giải quyết Corepack cache trong implementation đã duyệt |

Các blocker đều gắn với phase bị ảnh hưởng. Không cho một blocker CLI làm đình trệ toàn bộ knowledge app.

## Bước kế tiếp

Thiết kế đã được duyệt để planning. Bộ implementation plans file-level đã được lưu tại [plan index](../plans/2026-10-10-plan-index.md), gồm task IDs, file ownership, tests, thứ tự tích hợp và handoff. Bước tiếp theo là review plans và chọn execution method trước khi triển khai P0.

Implementation plans chỉ viết bằng English cho agent, không tạo bản dịch tiếng Việt. Hai bản English/tiếng Việt chỉ áp dụng cho reports cuối phase. File này là hướng dẫn review thiết kế, không phải implementation plan.

Chưa commit/push, chưa cài dependencies, chưa chạy worker. Chỉ hoàn thiện tài liệu thiết kế trong bước này.


Execution update 2026-10-10: P0 has completed local verification and independent review. Current progress is in `docs/superpowers/plans/execution-ledger.md`; final evidence is in `docs/reports/P0/run-p0-remediation-final/`. Earlier planning status above is historical. P1–P7/S1 and remote CI remain unverified.
