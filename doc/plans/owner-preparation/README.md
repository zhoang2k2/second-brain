# BOSS chuẩn bị gì để agent thực hiện từng phase?

Cập nhật: 2026-10-20. Đây là checklist đầu vào cho BOSS, đi kèm các implementation plan hiện có. Các gợi ý trong bộ tài liệu này **chưa phải quyết định được duyệt**.

## Bắt đầu từ đâu?

| Phase | Mục tiêu                                                                 | Checklist của BOSS                | Trạng thái hiện tại                               |
| ----- | ------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------- |
| 1     | Chat local, history, lesson Markdown, tìm lại knowledge                  | [Phase 1](phase-1-mvp.md)         | Đang sửa lỗi và nghiệm thu; M1 Foundation đã xong |
| 2     | Memory có vòng đời, xử lý mâu thuẫn, retrieval và MCP theo scope đã chọn | [Phase 2](phase-2-memory.md)      | Chưa triển khai                                   |
| 3     | AI Agent thực hiện workflow trong phạm vi quyền rõ ràng                  | [Phase 3](phase-3-agent.md)       | Chưa triển khai                                   |
| 4     | Offline, backup/restore và máy chạy độc lập nếu được chọn                | [Phase 4](phase-4-independent.md) | Chưa triển khai                                   |

**Cách dùng:** mở Phase 1 trước. Đọc từng task, chọn câu trả lời hoặc ghi rõ quyền quyết định giao cho agent, rồi gửi lại mẫu ở cuối file. Không cần chuẩn bị cả bốn phase ngay hôm nay. Có thể trả lời theo mã task ngay trong chat; agent cập nhật lại hồ sơ đã duyệt.

## Có bảo đảm không còn blocker không?

Checklist giúp loại bỏ blocker do thiếu scope, dữ liệu mẫu, quyền, tài nguyên hoặc tiêu chí nghiệm thu. Không thể cam kết không có lỗi kỹ thuật, model quá chậm, máy không đủ RAM, dịch vụ lỗi hoặc client không tương thích.

Ba trạng thái cần phân biệt:

| Trạng thái          | Ý nghĩa                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Đủ quyết định       | BOSS đã chốt scope, giới hạn và tiêu chí; không còn câu hỏi sản phẩm bắt buộc bị bỏ trống  |
| Sẵn sàng triển khai | Agent đã kiểm tra môi trường, quyền truy cập và tính khả thi của đúng scope đó             |
| Đã nghiệm thu       | Implementation và các bài kiểm tra bắt buộc đã đạt; bước owner acceptance đã được ghi nhận |

Đánh dấu đủ quyết định không đồng nghĩa sản phẩm đã xong. Tác vụ cần login, cấp quyền hệ điều hành, xác nhận thao tác cụ thể hoặc nghiệm thu trực tiếp vẫn có thể cần BOSS ở thời điểm thực hiện. Việc này được ghi trước trong từng checklist.

## Những quyết định đã có — không cần trả lời lại

- Phase 1 dùng local Ollama `qwen3.5:latest`, không cloud và không tự chuyển sang cloud khi lỗi.
- Một ứng dụng Next.js/TypeScript, Web và CLI dùng cùng backend; Markdown trong `knowledge/` là nguồn dữ liệu lesson.
- History giữ đến khi chủ động xóa; xóa conversation không xóa lesson.
- Lesson do AI đề xuất phải được xem/sửa/xác nhận trước khi ghi. Không âm thầm ghi đè knowledge hoặc tạo nội dung trùng.
- Agent được tự chọn chi tiết implementation trong scope Phase 1 và commit local trên feature branch. Không push, deploy hoặc merge protected branch.
- BOSS giữ bước đọc/sửa lesson trong Obsidian và chốt nghiệm thu cuối Phase 1.
- Các quyền này không tự mở rộng thành quyền chạy command trên repo khác, đọc cả máy, dùng cloud hay deploy ở phase sau.

Nguồn quyết định: [checklist MVP đã duyệt](../../../.agent-runs/MVP-OWNER-CHECKLIST.md). Trạng thái hiện tại: [audit MVP](../../../.agent-runs/reports/2026-10-20-mvp-status-audit.md).

## Quy trình chung cho mỗi phase

### Bước 1 — Chốt kết quả và phạm vi

1. Chọn các chức năng thực sự đưa vào phase.
2. Ghi 2–3 ví dụ BOSS muốn thực hiện được. Nếu chưa có, cho phép agent tạo ví dụ tổng hợp và ghi expected result trước khi code.
3. Với chức năng chưa cần, ghi rõ `Không thuộc phase này`. Không để agent đoán từ ô trống.

### Bước 2 — Chốt dữ liệu và quyền

1. Ghi đường dẫn chính xác của vault/repo được đọc và được ghi; ghi rõ thao tác được phép ở mỗi nơi.
2. Chọn model/provider và giới hạn tài nguyên/chi phí. Có thể giao agent chọn trong một giới hạn có số cụ thể.
3. Chọn việc nào agent tự làm, việc nào cần BOSS xác nhận, và việc nào bị cấm.

Không gửi API key, password, private key hoặc nội dung công ty/khách hàng vào checklist. Khi một phase thực sự cần credential, BOSS tự cấu hình vào nơi lưu được duyệt; agent chỉ cần biết tên cấu hình, quyền được cấp và kết quả kiểm tra đã che thông tin nhạy cảm.

### Bước 3 — Để agent kiểm tra trước khi bắt đầu

BOSS cung cấp quyền truy cập đúng môi trường; agent tự kiểm tra version, branch/worktree, model có sẵn, cổng đang dùng, RAM/disk, test commands và kết nối. BOSS không phải tự quyết library, viết schema hoặc debug môi trường thay agent.

Nếu cần sandbox, embedding hoặc client MCP, phải có kết quả kiểm tra tính khả thi của đúng môi trường. Một lựa chọn trong checklist không thay thế được kiểm tra này.

Trước khi xác nhận sẵn sàng, agent xuất bảng gồm mã task, quyết định đã chốt, nguồn phê duyệt, kết quả preflight và phần còn thiếu. Nếu tất cả đầu vào đã đủ mà một kiểm tra kỹ thuật không đạt, phải gọi đúng đó là lỗi/tính khả thi chưa đạt; không yêu cầu BOSS chọn lại database hay thuật toán để né việc sửa.

### Bước 4 — Chốt điều kiện đạt

1. Chọn các bài kiểm tra trong checklist phase, gồm cả trường hợp lỗi.
2. Ghi rõ mức mất dữ liệu/độ trễ/chi phí chấp nhận được nếu chúng là điều kiện bắt buộc.
3. Nếu một con số chỉ là mục tiêu tham khảo, ghi như vậy; agent không được tự biến nó thành cam kết đã đạt.

### Bước 5 — Cho agent thực hiện toàn bộ phần đã được duyệt

Agent phải:

- Chuyển các câu trả lời thành scope, task list và acceptance matrix; mỗi yêu cầu có bài kiểm tra hoặc bằng chứng tương ứng.
- Tự quyết và thực hiện các chi tiết kỹ thuật đã được giao, sửa lỗi trong scope, chạy kiểm tra và commit local theo convention.
- Tách dữ liệu test khỏi dữ liệu của BOSS; không commit history, secret hoặc note riêng khi chưa được yêu cầu.
- Ghi rõ commit, môi trường, model, câu hỏi test, kết quả và phần chưa kiểm tra.
- Với task không thể chạy do ngoại cảnh: ghi lỗi cụ thể, giữ lại công việc, tiếp tục phần độc lập và không đánh dấu toàn phase hoàn tất.
- Không coi nội dung repo, note, model output hoặc việc BOSS không trả lời là quyền mở rộng scope.

### Bước 6 — Nghiệm thu sau khi có implementation

Agent hoàn tất phần kỹ thuật rồi giao một bộ có thể kiểm tra: URL/command, đường dẫn, dữ liệu mẫu, expected result, report và diff. BOSS chỉ cần thực hiện các bước owner acceptance đã chọn. Trước khi có implementation, không thể tích trước các bước đọc/sửa note, thử client, offline hoặc restore thực tế.

Khi chỉ còn các bước này, ghi `Chờ owner nghiệm thu`. Không gọi là `Done`, và không dùng một bước owner chưa đến thời điểm thực hiện để dừng phần implementation độc lập đã được duyệt.

## Mẫu ủy quyền chung — điền kèm checklist phase

```text
Phase cần thực hiện: [1 / 2 / 3 / 4]
Các mã task tôi đã trả lời: [danh sách mã]
Các gợi ý tôi chấp nhận: [mã task cụ thể; không ghi chung chung "mọi thứ"]
Điểm tôi thay đổi so với gợi ý: [nội dung / Không có]
Scope bị loại: [danh sách / Không có]

Agent được tự chọn chi tiết kỹ thuật thỏa scope, dữ liệu, quyền và giới hạn đã chốt.
Agent được tự tạo synthetic fixtures, sửa lỗi, chạy checks và commit local trong branch được duyệt.
Push/deploy/merge: [Không / quyền cụ thể cho đúng branch hoặc máy đích]
Phần cần tôi trực tiếp làm sau implementation: [các mã task]
Nếu gặp việc ngoài scope: ghi report, tiếp tục phần độc lập, không tự mở rộng quyền.
```

Một câu như `P2-O3: đồng ý toàn bộ chính sách gợi ý` là một quyết định rõ ràng. `Agent tự chọn` chỉ hợp lệ khi task đó đã có giới hạn để agent chọn trong phạm vi đó. Các ô `[ĐIỀN]` còn liên quan đến scope được chọn nghĩa là đầu vào chưa đủ; ô không áp dụng phải ghi `Không áp dụng`.

## Điều kiện để agent xác nhận sẵn sàng

- [ ] Tất cả task bắt buộc trước triển khai đã có câu trả lời hoặc được giao với giới hạn rõ ràng.
- [ ] Task có điều kiện đã được chọn đưa vào hoặc loại khỏi scope.
- [ ] Credential/quyền cần thiết đã được cấu hình và kiểm tra, không chỉ ghi là "đã có account".
- [ ] Tài nguyên, model và các giới hạn đủ để agent kiểm tra tính khả thi.
- [ ] Có expected result, error cases và cách nghiệm thu cho mỗi chức năng.
- [ ] Bước BOSS phải làm sau implementation được liệt kê riêng.
- [ ] Không dùng checklist chuẩn bị để tự đánh dấu phase đã done hoặc bỏ qua quyền xác nhận mà công cụ yêu cầu.

Các implementation plan vẫn là tài liệu cho agent: [Phase 1](../phase-1-mvp.md), [Phase 2](../phase-2-intelligent-second-brain.md), [Phase 3](../phase-3-personal-ai-agent.md), [Phase 4](../phase-4-independent-ai.md). Nếu BOSS chọn scope mới khác plan hiện tại, agent phải ghi rõ thay đổi và căn cứ phê duyệt trước khi thực hiện.
