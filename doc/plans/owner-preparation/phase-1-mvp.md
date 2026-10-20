# Phase 1 — BOSS chuẩn bị để hoàn tất MVP

[Hướng dẫn chung](README.md) · [Implementation plan](../phase-1-mvp.md)

**Hiện tại:** M1 Foundation đã xong; Phase 1 MVP đang sửa lỗi và nghiệm thu. Các quyết định cũ trong [checklist MVP](../../../.agent-runs/MVP-OWNER-CHECKLIST.md) vẫn có hiệu lực. Chỉ trả lời thêm những phần dưới đây còn thiếu hoặc BOSS muốn thay đổi.

## Danh sách việc của BOSS

| Mã    | Việc                                                | Khi nào?                                                 |
| ----- | --------------------------------------------------- | -------------------------------------------------------- |
| P1-O1 | Xác nhận có thay đổi scope cũ không                 | Trước khi giao phần còn lại; có thể trả lời `Giữ nguyên` |
| P1-O2 | Chốt độ trễ mong muốn và giới hạn đổi model nếu cần | Trước khi yêu cầu tối ưu theo một mốc thời gian bắt buộc |
| P1-O3 | Chốt yêu cầu giữ response khi app bị tắt đột ngột   | Trước khi agent hoàn tất phần history/recovery           |
| P1-O4 | Chọn dữ liệu và bài nghiệm thu                      | Có thể giao agent tự tạo toàn bộ dữ liệu tổng hợp        |
| P1-O5 | Đọc/sửa lesson trong Obsidian                       | Sau khi agent giao bản đã sửa                            |
| P1-O6 | Chốt đạt/chưa đạt trên đúng bản cuối                | Sau khi đủ bằng chứng kỹ thuật và owner test             |

### P1-O1 — Giữ hay thay đổi scope đã duyệt?

1. Đọc mục “Những quyết định đã có” trong [hướng dẫn chung](README.md).
2. Nếu vẫn đúng, trả lời `P1-O1: Giữ nguyên scope đã duyệt`.
3. Nếu đổi model, vault, retention hoặc quyền dữ liệu, ghi đúng mục muốn đổi. Agent kiểm tra tác động trước khi đổi hoặc chuyển dữ liệu.

**Không cần làm lại:** cài project, chọn database/library, viết schema, chọn thuật toán chống trùng. Các việc này agent tự xử lý trong scope đã có.

### P1-O2 — Chờ bao lâu thì BOSS thấy chấp nhận được?

“Nội dung đầu tiên” là phần answer đầu tiên hiện lên; dòng `Thinking…` không được tính. “Warm” nghĩa là model đã load; “cold” nghĩa là model phải load lại. Agent phải ghi prompt/history/hardware khi đo.

1. Chọn một phương án:
   - **A — Giữ quyết định cũ:** đo và báo kết quả, chưa có giới hạn thời gian bắt buộc.
   - **B — Có giới hạn:** ghi số giây tối đa cho warm, cold và thời gian chờ trước khi báo lỗi/cho phép thử lại.
2. Nếu chọn B, có thể bắt đầu thảo luận bằng mục tiêu **warm 5 giây, cold 15 giây** cho câu hỏi ngắn. Đây là gợi ý cần benchmark, chưa phải kết quả máy hiện tại bảo đảm đạt được.
3. Chọn cách xử lý nếu model hiện tại không đạt: tiếp tục tối ưu trong scope, hoặc cho phép agent đánh giá model nhẹ hơn với giới hạn tải thêm/disk/RAM cụ thể. Không tự bật cloud.

**Gửi lại:** phương án A/B; nếu B thì số giây, workload mẫu và giới hạn đổi model. Hiện chưa có quyền tải thêm model; nếu không cấp quyền mới thì agent giữ model hiện tại và báo rõ mục tiêu nào chưa đạt.

### P1-O3 — Nếu app bị tắt giữa câu trả lời thì giữ lại đến đâu?

Hiện graceful cancel đã có bằng chứng API giữ được phần text đã nhận. Crash đột ngột là trường hợp khác và chưa có bảo đảm checkpoint.

1. Chọn yêu cầu cho nút Dừng, đóng tab, restart bình thường và process bị tắt bất ngờ.
2. **Gợi ý:** với Dừng/lỗi được bắt, giữ toàn bộ phần đã hiển thị; với crash, chấp nhận mất tối đa khoảng **2 giây** nội dung mới nhất nhờ checkpoint.
3. Hoặc ghi rõ crash recovery chưa thuộc Phase 1, để agent không mô tả tính năng này là đã có.

**Gửi lại:** có/không đưa crash recovery vào phase và mức mất dữ liệu chấp nhận được. Agent tự chọn cách ghi file/checkpoint và kiểm tra trong môi trường test; BOSS không cần tự tắt process để thử.

### P1-O4 — Dữ liệu và bài nghiệm thu

1. Chọn `Agent tự tạo dữ liệu tổng hợp` nếu BOSS chưa muốn chuẩn bị note thật. Quyền dùng synthetic prompts đã có; không cần cung cấp dữ liệu công ty hoặc secret.
2. Nếu muốn kiểm tra tình huống cá nhân, cung cấp 3–5 câu hỏi không nhạy cảm và một câu mô tả kết quả mong muốn cho mỗi câu.
3. Chốt có đưa use case bổ sung nào ngoài bảng dưới đây vào scope không.

| Tình huống bắt buộc                                      | Kết quả mong muốn                                              |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| Gửi chat rồi mở lại conversation trong lúc stream        | Response tiếp tục cập nhật; không cần reload để thấy answer    |
| Dừng giữa response                                       | Có trạng thái dừng và giữ phần đã nhận                         |
| Restart rồi mở lại history                               | Đọc lại được conversation đã lưu                               |
| Sửa proposal rồi Hủy                                     | Không tạo hoặc sửa file knowledge                              |
| Xác nhận lưu lesson                                      | Nội dung file đúng bản đã duyệt                                |
| Hai request cùng bổ sung một nội dung                    | Không ghi nội dung giống nhau hai lần                          |
| Sửa lesson                                               | Metadata và nội dung phản ánh thay đổi đúng chính sách đã chốt |
| Provider lỗi, path/metadata sai, search không có kết quả | UI/API phản hồi rõ ràng; dữ liệu cũ được giữ                   |
| Hỏi về lesson vừa lưu                                    | Tìm đúng note và có source path đúng khi dùng note để trả lời  |

**Gửi lại:** `Agent tự tạo fixtures theo bảng; use case bổ sung: Không có` hoặc danh sách bổ sung. Agent phải cung cấp kết quả từng dòng, không chỉ một dòng “tests pass”.

### P1-O5 — Nghiệm thu Obsidian bằng từng bước

Chỉ làm sau khi agent báo bản cuối và bài test đã sẵn sàng.

1. Mở bản preview agent cung cấp; địa chỉ hiện tại là `http://127.0.0.1:3210`.
2. Chat một nội dung không nhạy cảm, chọn **Lưu câu trả lời thành lesson**, sửa thành note ngắn rồi xác nhận lưu. Ghi lại đường dẫn ứng dụng trả về.
3. Trong Obsidian, chọn tên vault ở góc dưới trái → **Manage vaults…** → **Open folder as vault** → **Open**.
4. Ở cửa sổ chọn thư mục trên Mac, bấm `Cmd+Shift+G`, dán đúng đường dẫn dưới đây rồi mở:

```text
/Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2/knowledge/
```

5. Mở note vừa lưu. Đọc nội dung và thêm một dòng không nhạy cảm, ví dụ `Tôi đã kiểm tra note trong Obsidian.`
6. Quay về ứng dụng, tìm một cụm từ riêng trong dòng mới để xác nhận đang đọc cùng file. Báo lại tên note, đọc/sửa/tìm được hay không và thời điểm kiểm tra.

Nếu agent chuyển checkout/vault sau này, agent phải giao path mới và kế hoạch bảo toàn dữ liệu trước khi BOSS mở lại. Không tự xóa hoặc di chuyển worktree đang chứa history/vault.

**Hoàn thành khi:** BOSS xác nhận đã thực sự đọc/sửa note; việc thấy vault trong danh sách chưa thay thế được bước này. [Hướng dẫn Obsidian chính thức](https://github.com/obsidianmd/obsidian-help/blob/master/en/Files%20and%20folders/Manage%20vaults.md).

### P1-O6 — Chốt bản cuối

1. Agent giao commit, report, URL và acceptance matrix của cùng một bản.
2. BOSS làm P1-O5 và các use case cá nhân đã chọn, rồi trả lời `Đạt` hoặc `Chưa đạt: ...` kèm tình huống cụ thể.
3. Chỉ sau khi các finding bắt buộc và acceptance đều đạt mới chốt Phase 1 hoàn tất. Việc push/merge vẫn theo quyền riêng đã cấp; không tự merge để “đóng phase”.

## Việc agent phải tự hoàn tất

Sửa lỗi concurrency ghi trùng, metadata `updated`, feedback khi provider lỗi; kiểm tra history/recovery theo P1-O3; chạy Web/CLI và các failure paths; kiểm tra retrieve/citation, checks và production build. Theo dõi [audit hiện tại](../../../.agent-runs/reports/2026-10-20-mvp-status-audit.md). Không yêu cầu BOSS cung cấp implementation cho các finding này.

## Mẫu trả lời

```text
Phase 1:
P1-O1: Giữ nguyên scope đã duyệt / [thay đổi cụ thể]
P1-O2: A / B: warm [giây], cold [giây], timeout [giây], workload [mô tả]
Nếu cần đổi model: Không cho tải thêm / Cho agent chọn trong giới hạn [tổng GB tải thêm, RAM, disk]
P1-O3: Crash recovery [Có/Chưa thuộc phase]; chấp nhận mất tối đa [giây] nếu có.
P1-O4: Agent tự tạo fixtures theo bảng; use case bổ sung [Không có/danh sách].
P1-O5: Tôi sẽ đọc/sửa note sau khi agent giao bản cuối; kết quả hiện tại [Chưa thực hiện/đã thực hiện và bằng chứng].
P1-O6: Agent hoàn tất phần kỹ thuật và report trước; tôi chốt nghiệm thu trên đúng commit.
```

P1-O5/O6 là việc sau implementation. Chưa làm được hai bước đó không phải lý do để agent dừng các bản sửa độc lập đã được ủy quyền.
