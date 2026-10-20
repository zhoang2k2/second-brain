# Phase 3 — BOSS chuẩn bị cho Personal AI Agent

[Hướng dẫn chung](README.md) · [Implementation plan](../phase-3-personal-ai-agent.md)

**Phân biệt:** “agent lập trình” là công cụ đang xây Second Brain cùng BOSS. “AI Agent của sản phẩm” là tính năng Phase 3 sẽ xây để đọc repo, đề xuất hoặc thực hiện hành động. Quyền hiện tại của agent lập trình không tự trở thành quyền của sản phẩm.

**Điều kiện vào phase:** policy Phase 2 và scope/quyền Phase 3 được duyệt. Chức năng execution chỉ được bật sau khi phương án isolation vượt kiểm tra tính khả thi.

## Danh sách việc của BOSS

| Mã    | Việc                                             | Thời điểm                                                  |
| ----- | ------------------------------------------------ | ---------------------------------------------------------- |
| P3-O1 | Chọn workflow, repo và dữ liệu test              | Trước triển khai                                           |
| P3-O2 | Chốt read/write/command/network permissions      | Trước triển khai                                           |
| P3-O3 | Chốt cách phê duyệt, hết hạn và thu hồi quyền    | Trước triển khai                                           |
| P3-O4 | Chốt giới hạn thời gian, số lần gọi và model     | Trước triển khai                                           |
| P3-O5 | Chọn có quan sát session/điều khiển app không    | Trước triển khai; cài/cấp quyền khi có cấu hình cụ thể     |
| P3-O6 | Duyệt tiêu chí isolation và kết quả feasibility  | Tiêu chí trước triển khai; kết quả trước khi bật execution |
| P3-O7 | Chốt log, dữ liệu được giữ và khôi phục          | Trước triển khai                                           |
| P3-O8 | Nghiệm thu bằng cả tình huống cho phép và bị cấm | Sau implementation                                         |

### P3-O1 — Giao một công việc có điểm bắt đầu và kết thúc

1. Chọn một repo test không chứa secret/dữ liệu công ty; ghi path, branch được phép và kết quả mong muốn. Có thể giao agent lập trình tạo một repo fixture riêng, không cần dùng repo thật ngay.
2. Chọn một mức scope:
   - **A — Inspect/plan/propose:** đọc đầu vào được duyệt và trả patch/report; không thực thi command hoặc ghi vào repo mục tiêu.
   - **B — Execution có giới hạn:** thêm việc áp dụng patch/chạy command được duyệt, trong môi trường isolation đã kiểm tra.
3. Viết một use case, ví dụ: “đọc log lỗi tổng hợp, đề xuất sửa một function, giải thích diff”. Nếu chọn B, bổ sung command cụ thể dùng để chứng minh bản sửa đúng.

**Gửi lại:** A/B, repo/branch/path test, đầu vào và expected result. Chọn A không được báo là đã có autonomous execution; nếu B được chọn thì không thể bỏ qua gate P3-O6.

### P3-O2 — Agent được chạm tới đâu?

1. Điền bảng cho đúng repo/môi trường test. Không dùng `toàn bộ máy`, `mọi command` hoặc wildcard phủ cả home folder.

| Hành động    | Phạm vi cần ghi                            | Gợi ý ban đầu                                                            |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Đọc file     | Đường dẫn repo/vault và các phần loại trừ  | Chỉ repo fixture và knowledge đã duyệt                                   |
| Ghi file     | Đường dẫn, loại file, nhánh                | Scope A: không ghi repo mục tiêu. Scope B: chỉ workspace test được duyệt |
| Chạy command | Executable, arguments/script, thư mục chạy | Chỉ command có trong plan đã duyệt; không có quyền shell chung           |
| Network      | Dịch vụ/host được phép và mục đích         | Chỉ inference local; package install hoặc Internet cần quyền riêng       |
| Git          | Commit/push/merge và branch                | Local commit nếu được duyệt; không push/merge mặc định                   |
| App control  | Tên app/window và hành động                | Tắt mặc định, chọn riêng tại P3-O5                                       |

2. Ghi các vùng cấm: credential, `.env` chứa secret, SSH keys, dữ liệu ngoài target, tài khoản cá nhân và project khác. Agent lập trình phải chuyển chính sách này thành kiểm tra thực sự, không chỉ chèn vào prompt.
3. Với command test, nhớ rằng script trong repo cũng có thể thực thi code; tên `test` không tự làm nó an toàn. Cần isolation tương ứng với quyền chạy.

**Gửi lại:** bảng quyền và đường dẫn. BOSS quyết quyền; agent chọn cách kiểm tra/enforce trong scope đã chốt. [OWASP: quyền tối thiểu và kiểm tra ngoài model](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

### P3-O3 — Phê duyệt một lần tới mức nào?

1. Chọn theo loại hành động: đọc trong scope có thể tự thực hiện; patch là proposal; write/command phải khớp quyền đã duyệt cho đúng task và target.
2. **Gợi ý:** quyền execution gắn với một plan/task/target cụ thể, hết hạn sau 30 phút hoặc khi task kết thúc, thu hồi được ngay. Diff/command phải xem được trước khi phê duyệt.
3. Chọn có cho duyệt một batch hành động cụ thể hay duyệt từng hành động. Batch phải liệt kê được hành động, target và giới hạn; thay đổi ngoài batch cần quyền mới.

**Gửi lại:** loại approval, thời hạn, cách thu hồi và quyền batch nếu có. Quy định xác nhận ở thời điểm thao tác của công cụ/hệ điều hành vẫn phải được tuân thủ; checklist không thể cam kết bỏ mọi lần bấm xác nhận.

### P3-O4 — Giới hạn để task không chạy vô tận

1. Ghi model/provider, chi phí được phép và mục tiêu thời gian của một task.
2. **Gợi ý để duyệt:** local-only, không tải model thêm; tối đa 10 phút/task, 20 tool calls, thử lại cùng một thao tác lỗi tối đa 2 lần. Nếu cần token budget, ghi số và agent xác minh runtime có thể enforce ra sao.
3. Chọn hành vi khi hết giới hạn: dừng an toàn, giữ diff/log tối thiểu, báo kết quả chưa hoàn tất; không tự tăng budget hoặc đổi provider.

**Gửi lại:** các giới hạn có số và cách xử lý hết hạn mức. “Tự làm cho tới khi xong” không đủ để đặt giới hạn vận hành cho AI Agent của sản phẩm.

### P3-O5 — Quan sát session và điều khiển app có thuộc scope không?

1. **Gợi ý:** chưa bật quan sát session hoặc điều khiển app ở lần đầu; dùng log mẫu BOSS chủ động nhập.
2. Nếu chọn bật quan sát: ghi đúng app/session, loại dữ liệu được đọc, thời điểm bắt đầu/kết thúc và có được lưu hay không. Không mặc định chụp màn hình hoặc đọc toàn bộ lịch sử của ứng dụng.
3. Nếu chọn app control: ghi đúng app/window và hành động. BOSS chuẩn bị app/account và cấp các quyền macOS cần thiết khi agent đã giao hướng dẫn cho adapter cụ thể. Agent phải kiểm tra capability thật, không chỉ suy ra từ việc app đã cài.

**Gửi lại:** `Không thuộc phase` hoặc danh sách nguồn/hành động/quyền. Computer use cần một bài feasibility và permission test riêng; không đánh đồng nó với automation trong repo test.

### P3-O6 — Kiểm tra isolation trước khi execution

Isolation ở đây là giới hạn kỹ thuật đối với file, process và network; một Git worktree chỉ tách trạng thái Git, không đủ chứng minh các giới hạn đó.

1. BOSS duyệt tiêu chí: chỉ truy cập đúng file được cấp; chặn path escape/symlink escape; không tự nhận secret môi trường; command/network ngoài quyền bị chặn; thu hồi/hết hạn/cancel hoạt động.
2. Cho phép agent lập trình khảo sát và thử trong một môi trường test có giới hạn. Agent báo phương án, tài nguyên cần thêm, quyền cần thiết và kết quả thử. BOSS không cần tự chọn công nghệ sandbox khi chưa có report.
3. Trước khi bật B, BOSS duyệt phương án cụ thể hoặc ủy quyền có điều kiện: chỉ chọn phương án đáp ứng toàn bộ tiêu chí và resource budget đã ghi. Nếu không phương án nào đạt, giữ execution tắt và báo feasibility chưa đạt.

**Gửi lại:** tiêu chí, resource budget, quyền tạo môi trường test, cùng cách duyệt kết quả. Nếu BOSS muốn đổi sang scope A sau feasibility, ghi thành thay đổi scope; không gọi đó là đã hoàn thành scope B.

### P3-O7 — Lưu bằng chứng gì, ở đâu?

1. Chọn thư mục riêng cho job artifacts và thời gian giữ. **Gợi ý:** 7 ngày cho log kỹ thuật; giữ report/diff được BOSS chấp nhận theo chính sách project.
2. Ghi loại dữ liệu được lưu: task ID, target, approval, command đã được phép, exit code, diff và lỗi đã che thông tin nhạy cảm. Không mặc định lưu screenshot/raw prompt, credential hoặc toàn bộ repo.
3. Chọn cách phục hồi khi task lỗi. **Gợi ý:** chạy trên bản test, giữ snapshot trước thay đổi, giao diff trước khi áp dụng vào repo chính; không tự xóa dữ liệu hoặc reset branch của BOSS.

**Gửi lại:** path artifacts, retention và quyền backup/cleanup. Xóa vĩnh viễn vẫn theo chính sách xác nhận có hiệu lực tại thời điểm thực hiện.

### P3-O8 — Nghiệm thu sau implementation

1. Agent giao một task thành công kèm diff/command/log để BOSS đọc được chuyện gì đã xảy ra.
2. Agent phải chứng minh các trường hợp: denied/expired/revoked approval, path escape, command bị cấm, hết budget, cancel, tool lỗi và nội dung repo cố yêu cầu mở rộng quyền.
3. BOSS thử approve/deny/cancel trên UI; xác nhận đúng target và không có hành động ẩn. Scope B chỉ đạt khi isolation và toàn bộ quyền execution đã được kiểm tra.

**Hoàn thành khi:** mọi hành động đã bật đều có bằng chứng thực thi trong đúng quyền; tính năng chưa đạt phải để tắt và được ghi rõ trong kết luận phase.

## Mẫu trả lời

```text
Phase 3:
P3-O1: Scope A/B; repo test [path/cho agent tạo fixture]; branch [tên]; use case [mô tả].
P3-O2: Quyền read/write/commands/network/Git/app [bảng cụ thể].
P3-O3: Approval [từng action/batch cụ thể]; hết hạn [phút]; thu hồi [yêu cầu]; quyền batch [danh sách/Không].
P3-O4: Model/provider [tên]; tối đa [phút], [tool calls], [retries], [chi phí/token nếu áp dụng].
P3-O5: Observation/app control [Không thuộc phase / nguồn, dữ liệu và hành động cụ thể].
P3-O6: Cho khảo sát isolation trong [môi trường]; resource budget [giới hạn]; bật execution chỉ khi [tiêu chí đạt và cách duyệt].
P3-O7: Artifacts [path]; retention [thời gian]; backup/cleanup [phạm vi].
P3-O8: Tôi thử approval/deny/cancel khi agent giao bản có thể nghiệm thu.
```
