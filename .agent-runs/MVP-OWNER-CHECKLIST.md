# MVP — Checklist đầu vào và việc thủ công của BOSS

Ngày lập: 2026-10-19. Phạm vi: Phase 1, M2 Chat → M3 Knowledge → M4 Integration.

File này gom các đầu vào còn thiếu thành một lần bàn giao. BOSS điền trực tiếp các ô `Trả lời` và chọn checkbox phù hợp. Những đề xuất bên dưới chưa trở thành quyết định cho đến khi BOSS chọn hoặc ghi rõ giao agent tự quyết.

Không ghi API key, token, mật khẩu hoặc nội dung riêng tư vào file này vì file có thể được commit. Với cấu hình bí mật, chỉ ghi đã cấu hình và tên biến môi trường.

## 1. Tiến độ đã xác minh

| Hạng mục        | Trạng thái                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------- |
| M1 Foundation   | Hoàn tất; implementation commit `07e2407`, báo cáo commit `b88b826`                                 |
| M2 Chat         | Chưa có Web/CLI chat, streaming hoặc history                                                        |
| M3 Knowledge    | Chưa có preview/save lesson hoặc search                                                             |
| M4 Integration  | Chưa có end-to-end acceptance hoặc provider integration                                             |
| Validation M1   | Format, lint, typecheck, production build và dev HTTP 200 đã pass trong lượt thực thi trước         |
| Automated tests | Chưa có test script; agent sẽ thêm test phù hợp khi có behavior                                     |
| Ollama          | Probe trước: không tìm thấy CLI; endpoint local không kết nối được. Agent sẽ kiểm tra lại sau setup |

Các nhánh feature M1–M4 hiện cùng trỏ tới `b88b826`, chứa code M1 và báo cáo. Các worktree `blocked/m2`, `blocked/m3`, `blocked/m4` chỉ thêm hồ sơ blocker; không có implementation M2–M4.

## 2. BOSS cần làm ngay — Runtime và model

### OWNER-01 — Cài và mở Ollama trên máy chạy MVP

- [ ] Cài Ollama theo [hướng dẫn chính thức](https://docs.ollama.com/quickstart), mở ứng dụng và giữ runtime hoạt động khi agent thực hiện acceptance.
- [ ] Xác định runtime chạy trên cùng máy với repo, hay trên máy khác.
- [ ] Điền URL agent được phép sử dụng. Đề xuất cho cùng máy: `http://127.0.0.1:11434`.

**Trả lời:**

```text
Runtime chạy trên máy: ...
OLLAMA_BASE_URL: ...
Ollama đã cài và mở: Có / Chưa
```

BOSS có thể chạy lệnh sau và dán output vào phần trả lời. Agent có thể tự chạy lại các lệnh kiểm tra khi runtime sẵn sàng:

```bash
ollama --version
ollama list
curl --fail --show-error http://127.0.0.1:11434/api/tags
```

Nếu URL khác, thay URL trong lệnh. `/api/tags` liệt kê các model có sẵn theo [Ollama API](https://docs.ollama.com/api/tags). Endpoint trả lời thành công chưa chứng minh model inference hoạt động; agent sẽ kiểm tra request chat thực tế.

### OWNER-02 — Cung cấp model hoặc quyền chọn/tải model

Chọn **một** phương án:

- [ ] **A — BOSS tự tải model:** tải một model local qua Ollama, rồi ghi exact tag từ `ollama list` bên dưới. Không dùng tên viết tắt hoặc tag cloud.
- [ ] **B — Giao agent chọn và tải:** cho phép agent kiểm tra phần cứng, tài liệu/license, chọn model local phù hợp và tải trong giới hạn bên dưới. Lựa chọn này thay thế hạn chế trước đây về việc agent không được tải model, chỉ trong phạm vi model local và giới hạn đã ghi.

**Trả lời:**

```text
Phương án A / B: ...
Exact model tag nếu chọn A: ...
Giới hạn tải nếu chọn B (GB): ...
Dung lượng đĩa được phép sử dụng cho model nếu chọn B (GB): ...
Ứng dụng khác cần chạy đồng thời: ...
```

Chọn kỳ vọng performance:

- [ ] MVP ưu tiên chạy đúng trên máy hiện tại; chưa có ngưỡng latency bắt buộc. Agent đo và báo thời gian phản hồi, không tự tuyên bố đạt performance production.
- [ ] Có yêu cầu cụ thể: `...` (ví dụ thời gian chờ tối đa chấp nhận được).

- [ ] Cho phép agent gửi prompt test không nhạy cảm đến model local để kiểm tra chat, streaming, cancel, resume, lesson generation và grounded answers. Không tự chuyển sang cloud khi local lỗi.

**Hoàn tất khi:** exact model đã có sẵn hoặc có quyền tải rõ ràng; runtime có thể truy cập; agent được phép chạy local inference. Agent sẽ xác minh cả request thực tế và lỗi provider theo [API chat của Ollama](https://docs.ollama.com/api/chat).

## 3. BOSS cần quyết định một lần — Dữ liệu và phạm vi MVP

### OWNER-03 — History: cách lưu và hành vi dữ liệu

Chọn một cách quyết định storage:

- [ ] Giao agent chọn local persistence tối thiểu phù hợp repo, tài liệu hóa lựa chọn và trade-off; không cần hỏi lại về library/schema nội bộ.
- [ ] BOSS yêu cầu cụ thể: `...` (SQLite hiện chỉ là candidate trong plan, chưa phải yêu cầu đã chốt).

Chọn hoặc sửa hợp đồng hành vi đề xuất:

- [ ] Lưu history trên máy, giữ đến khi người dùng chủ động xóa; không tự gửi đi cloud hoặc tự đồng bộ.
- [ ] Sau khi restart app, có thể mở lại conversation và tiếp tục chat.
- [ ] Stop response giữ phần nội dung đã nhận, đánh dấu interrupted; không giả vờ response đã hoàn tất.
- [ ] Xóa conversation xóa history đó khỏi storage của ứng dụng; không xóa các lesson đã được xác nhận lưu riêng. Đây không phải yêu cầu secure erase trên filesystem/backup.

**Trả lời nếu khác đề xuất hoặc có retention tự động:** `...`

### OWNER-04 — Knowledge: tổ chức và format Markdown

Chọn một:

- [ ] Giao agent chốt schema MVP tối thiểu theo các giới hạn dưới đây; không cần chờ BOSS học xong Lesson 08 hoặc duyệt lại từng field kỹ thuật.
- [ ] BOSS có schema/tài liệu bắt buộc: ghi đường dẫn hoặc nội dung không nhạy cảm tại đây: `...`

Giới hạn đề xuất để agent tự hoàn thiện schema:

- [ ] Vault chính thức là thư mục `knowledge/` trong repo; Markdown là source of truth và có thể mở bằng Obsidian.
- [ ] Frontmatter tối thiểu chứa title, tags, thời điểm tạo/cập nhật và source reference khi có; agent chọn tên field và định dạng nhất quán, ghi tài liệu kèm validation.
- [ ] Tên file ổn định, tránh collision; không overwrite note đã có một cách im lặng. Agent tự chọn naming rule và cách hiển thị conflict.
- [ ] MVP dùng keyword/full-text search, trả source path/snippet; chưa cần embeddings, vector database, tự liên kết hay tự cập nhật note.

**Quy định naming/folder/Wikilink đặc biệt nếu có:** `...`

Không bắt buộc BOSS cung cấp note thật. Agent có thể tạo fixture tổng hợp trong thư mục test tạm, không coi chúng là tri thức thật hoặc tự seed chúng vào vault của BOSS.

### OWNER-05 — Privacy và quyền lưu lesson

Chọn hoặc sửa:

- [ ] MVP chỉ dùng dữ liệu cá nhân do BOSS chủ động nhập; không tự đọc repo/vault/tệp bên ngoài phạm vi đã chọn.
- [ ] Không đưa secret, credential hoặc dữ liệu công ty/khách hàng vào dữ liệu nghiệm thu. Nếu BOSS cần xử lý dữ liệu đó, mô tả chính sách riêng trước.
- [ ] “Save as Lesson” tạo bản đề xuất; BOSS có thể sửa, hủy hoặc xác nhận. Chỉ thao tác xác nhận trong sản phẩm mới ghi lesson vào vault.
- [ ] Không tự lưu mọi conversation thành lesson. Lesson đã lưu tồn tại độc lập với history theo OWNER-03.
- [ ] MVP chưa yêu cầu hệ thống tự phát hiện/redact mọi loại thông tin nhạy cảm. Không được mô tả ứng dụng là đã bảo đảm loại bỏ toàn bộ secret. Nếu cần redaction bắt buộc, điền rule và ví dụ không nhạy cảm bên dưới.

**Dữ liệu bị cấm / rule redaction / phạm vi đọc khác nếu có:** `...`

### OWNER-06 — Local-only hay cloud trong MVP

Chọn **một**:

- [ ] **Local-only MVP:** chỉ Ollama; không cần API key, cloud adapter hay cloud selector. Chấp nhận MVP sau khi luồng local và Obsidian pass; hybrid cloud chuyển sang giai đoạn sau.
- [ ] **Bao gồm cloud:** điền đầy đủ phần dưới; cloud chỉ chạy khi người dùng chọn rõ provider. Local lỗi không tự chuyển cloud.

Chỉ điền nếu chọn cloud:

```text
Provider và API cụ thể: ...
Exact model ID: ...
Chức năng được gửi cloud (chat / tạo lesson / trả lời từ knowledge): ...
Loại dữ liệu được phép gửi: ...
Giới hạn chi phí cho agent nghiệm thu: ...
Giới hạn/cách chặn chi phí trong sản phẩm: ...
Tên biến môi trường chứa key: ...
Key đã cấu hình riêng tại máy: Có / Chưa
Cho phép agent chạy request cloud nghiệm thu trong hạn mức: Có / Không
```

Không dán key vào file, chat hoặc báo cáo. Nếu chọn local-only, không cần thực hiện phần cloud này. Agent cập nhật scope M4 theo lựa chọn của BOSS.

## 4. BOSS cần chuẩn bị cho nghiệm thu

### OWNER-07 — Obsidian và bài nghiệm thu MVP

- [ ] Cài/mở Obsidian và đồng ý mở `knowledge/` của checkout tích hợp cuối cùng làm vault. Worktree cuối có thể khác repo root; agent phải cung cấp exact path trước bước kiểm tra này.
- [ ] Đồng ý bài nghiệm thu bên dưới hoặc sửa một lần trong phần trả lời.

| Bước           | Điều kiện đạt                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Web chat       | Gửi câu hỏi đến model local và thấy response streaming, loading/error rõ ràng                             |
| CLI chat       | CLI gọi cùng server-side logic; có chat, dừng và tiếp tục conversation                                    |
| History        | Restart ứng dụng rồi mở lại conversation; xóa theo OWNER-03                                               |
| Save lesson    | Sinh proposal, sửa, hủy không ghi file; xác nhận mới lưu Markdown                                         |
| Obsidian       | BOSS mở đúng file lesson, đọc và sửa được bằng Obsidian                                                   |
| Retrieve       | Search tìm lesson; câu trả lời dùng nội dung đã lưu và nêu source reference đúng                          |
| Failure paths  | Provider unavailable/cancel, search không kết quả, metadata/path không hợp lệ và file conflict được xử lý |
| Quality        | Lint, typecheck, test được thêm cho behavior mới và production build pass trên checkout tích hợp cuối     |
| Cloud nếu chọn | Chọn provider rõ ràng; có kiểm tra cấu hình lỗi, hạn mức và không implicit fallback                       |

**Ngôn ngữ UI mong muốn (hoặc giao agent chọn):** `...`

**Use case/câu hỏi mẫu không nhạy cảm, yêu cầu bổ sung nếu có:** `...`

**Cách thực hiện phần Obsidian:**

- [ ] BOSS sẽ kiểm tra thủ công khi agent cung cấp file/path và ghi kết quả; không đánh dấu owner acceptance trước bước này.
- [ ] Cho phép agent thao tác Obsidian qua UI có sẵn để kiểm tra vault test/lesson test; nếu UI không truy cập được thì vẫn cần BOSS kiểm tra sau.

Việc kiểm tra Obsidian diễn ra khi có lesson thật từ flow MVP; không phải việc cần hoàn thành ngay hôm nay. [Obsidian: tạo hoặc mở vault](https://help.obsidian.md/vault).

## 5. Quyền thực thi đã có và phần giao agent

Các chỉ dẫn trong phiên đã cho phép thực thi tự động, local commit trên feature branch, chạy quality checks, giữ blocker trong worktree riêng và tiếp tục phần độc lập. Không yêu cầu BOSS cấp lại quyền bắt đầu từng milestone. Agent phải đối chiếu lại câu “M1 only” trong plan cũ với chỉ dẫn mới và các lựa chọn đã điền ở đây.

BOSS có thể dùng một câu để giao các chi tiết implementation còn lại:

```text
Tôi chọn các phương án đã đánh dấu trong file này. Trong phạm vi đó,
agent được tự quyết contract, schema kỹ thuật, library và test cần thiết,
thực thi M2–M4 đến MVP, sửa lỗi và commit local mà không hỏi lại các bước
implementation thông thường. Không push, deploy hoặc merge protected branch.
Các giới hạn model download, dữ liệu, cloud và chi phí theo đúng file này.
```

Không yêu cầu BOSS tự chọn test framework, viết test, dựng FE/BE contract, tạo fixture test, sửa lỗi build hoặc quản lý worktree. Đây là công việc của agent.

## 6. Kiểm tra đầu vào trước khi bàn giao lại

- [ ] OWNER-01: runtime URL và trạng thái setup đã có.
- [ ] OWNER-02: model local đã có exact tag, hoặc có quyền chọn/tải với hạn mức rõ ràng; cho phép local inference test.
- [ ] OWNER-03: history storage được chốt hoặc giao agent; hành vi retention/resume/delete rõ ràng.
- [ ] OWNER-04: knowledge schema được cung cấp hoặc giao agent theo giới hạn đã chọn.
- [ ] OWNER-05: privacy và xác nhận trước khi lưu lesson được chốt.
- [ ] OWNER-06: đã chọn local-only hoặc cung cấp đủ thông tin cloud và setup riêng.
- [ ] OWNER-07: acceptance scenario và cách kiểm tra Obsidian đã chốt.

Sau khi BOSS điền, agent rà soát completeness, cập nhật plan/STATUS/HANDOFF/BLOCKERS theo quyết định mới và tiếp tục phần thực hiện được. Không giữ các quyết định đã được cung cấp trong trạng thái BLOCKED.

Checklist này xử lý các owner dependency hiện biết; lỗi kỹ thuật mới vẫn có thể xuất hiện trong quá trình tích hợp. Agent tự điều tra và sửa trong scope, chỉ ghi blocker khi thực sự cần đầu vào hoặc quyền nằm ngoài những gì đã cấp.
