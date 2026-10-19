# MVP — Checklist đầu vào và việc thủ công của BOSS

Ngày lập: 2026-10-19. Phạm vi: Phase 1, M2 Chat → M3 Knowledge → M4 Integration.

File này gom các đầu vào còn thiếu thành một lần bàn giao. BOSS điền trực tiếp các ô `Trả lời` và chọn checkbox phù hợp. Những đề xuất bên dưới chưa trở thành quyết định cho đến khi BOSS chọn hoặc ghi rõ giao agent tự quyết.

Không ghi API key, token, mật khẩu hoặc nội dung riêng tư vào file này vì file có thể được commit. Với cấu hình bí mật, chỉ ghi đã cấu hình và tên biến môi trường.

## Cách hoàn tất checklist

Checklist này không phải bài kiểm tra kỹ thuật. BOSS chỉ cần quyết định dữ liệu nào được phép dùng, model có được tải hay không, và cách nghiệm thu. Các lựa chọn implementation như SQLite hay schema field cụ thể có thể giao agent tự quyết.

1. Đọc phần **Gợi ý cho MVP local** bên dưới. Đây là cấu hình đề xuất để giảm số quyết định; chúng chưa được xem là lựa chọn của BOSS cho tới khi BOSS xác nhận.
2. Ở mỗi mục OWNER-02–OWNER-07, đánh dấu một lựa chọn trong nhóm có chữ **Chọn một**. Có thể sửa phần `Trả lời` nếu muốn khác đề xuất.
3. Không cần tự sửa file nếu tiện hơn: copy câu trả lời mẫu ở cuối checklist, thay những chỗ trong ngoặc vuông, rồi gửi lại. Agent sẽ ghi quyết định vào file và kiểm tra xem còn thiếu gì.
4. Các ô đã đánh dấu ở OWNER-01 được điền từ output Ollama BOSS vừa gửi. Không cần chạy lại lệnh đó.

### Gợi ý cho MVP local

Nếu mục tiêu là làm MVP chạy trên máy cá nhân, các lựa chọn đơn giản nhất thường là:

- OWNER-02: agent chọn một model Ollama dựa trên cấu hình máy, nhưng chỉ tải sau khi BOSS đặt giới hạn dung lượng tải/ổ đĩa; cho phép prompt test tổng hợp, không nhạy cảm.
- OWNER-03: giao agent chọn persistence local tối thiểu; giữ history đến khi xóa; resume sau restart; delete history không xóa lesson đã lưu.
- OWNER-04: giao agent chọn Markdown schema tối thiểu trong `knowledge/`; keyword search; không embeddings.
- OWNER-05: chỉ dùng nội dung BOSS chủ động nhập; luôn preview/edit/cancel/confirm trước khi ghi lesson.
- OWNER-06: local-only, dùng Ollama; bỏ cloud khỏi MVP.
- OWNER-07: BOSS kiểm tra Obsidian thủ công ở đúng vault path sau khi agent cung cấp; chấp nhận các bước nghiệm thu trong bảng.

Đây là gợi ý, không phải quyết định đã được chấp thuận. Một câu trả lời như “Tôi đồng ý toàn bộ gợi ý cho MVP local; agent tự chọn chi tiết kỹ thuật” đủ để giao các quyết định đó. Riêng model download vẫn cần con số giới hạn dung lượng và xác nhận quyền chạy inference.

## 1. Tiến độ đã xác minh

| Hạng mục        | Trạng thái                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| M1 Foundation   | Hoàn tất; implementation commit `07e2407`, báo cáo commit `b88b826`                                                      |
| M2 Chat         | Chưa có Web/CLI chat, streaming hoặc history                                                                             |
| M3 Knowledge    | Chưa có preview/save lesson hoặc search                                                                                  |
| M4 Integration  | Chưa có end-to-end acceptance hoặc provider integration                                                                  |
| Validation M1   | Format, lint, typecheck, production build và dev HTTP 200 đã pass trong lượt thực thi trước                              |
| Automated tests | Chưa có test script; agent sẽ thêm test phù hợp khi có behavior                                                          |
| Ollama          | BOSS xác nhận CLI `0.40.6`; `127.0.0.1:11434/api/tags` trả HTTP thành công, nhưng hiện không có model nào (`models: []`) |

Các nhánh feature M1–M4 hiện cùng trỏ tới `b88b826`, chứa code M1 và báo cáo. Các worktree `blocked/m2`, `blocked/m3`, `blocked/m4` chỉ thêm hồ sơ blocker; không có implementation M2–M4.

## 2. BOSS cần làm ngay — Runtime và model

### OWNER-01 — Cài và mở Ollama trên máy chạy MVP

- [x] Ollama đã cài; CLI `0.40.6` và local endpoint `/api/tags` phản hồi thành công theo output BOSS gửi ngày 2026-10-19.
- [x] Output được chạy tại checkout `second-brain`; giả định runtime local dùng được từ máy chạy repo.
- [x] URL đã xác nhận qua lệnh: `http://127.0.0.1:11434`.

**Trả lời:**

```text
Runtime chạy trên máy: local với checkout (suy ra từ terminal output)
OLLAMA_BASE_URL: http://127.0.0.1:11434
Ollama đã cài và mở: Có (version 0.40.6; endpoint trả lời)
Model có sẵn tại lần kiểm tra 2026-10-20: `qwen3.5:latest` (7.6 GB, local); thêm `glm-5.3-flash:cloud` (remote, loại khỏi MVP)
```

Kiểm tra lại ngày 2026-10-20: Ollama `0.40.6`, `/api/tags` phản hồi thành công, `qwen3.5:latest` chạy inference prompt tổng hợp thành công.

BOSS có thể chạy lệnh sau và dán output vào phần trả lời. Agent có thể tự chạy lại các lệnh kiểm tra khi runtime sẵn sàng:

```bash
ollama --version
ollama list
curl --fail --show-error http://127.0.0.1:11434/api/tags
```

Nếu URL khác, thay URL trong lệnh. `/api/tags` liệt kê các model có sẵn theo [Ollama API](https://docs.ollama.com/api/tags). Endpoint trả lời thành công chưa chứng minh model inference hoạt động; agent sẽ kiểm tra request chat thực tế.

### OWNER-02 — Cung cấp model hoặc quyền chọn/tải model

**Cập nhật 2026-10-20:** Kiểm tra runtime xác nhận `qwen3.5:latest` là model local duy nhất (7.6 GB). `glm-5.3-flash:cloud` cũng hiện trong danh sách nhưng là remote/cloud, không thuộc MVP local. Một prompt thử nghiệm tổng hợp đã nhận được phản hồi từ `qwen3.5:latest` trong khoảng 38 giây. Chưa có SLA latency; đo và báo kết quả nghiệm thu.

Chọn **một** phương án:

- [x] **A — Dùng model local hiện có:** exact tag `qwen3.5:latest`; không dùng tag cloud trong MVP.
- [ ] **B — Giao agent chọn và tải:** cho phép agent kiểm tra phần cứng, tài liệu/license, chọn model local phù hợp và tải trong giới hạn bên dưới. Lựa chọn này thay thế hạn chế trước đây về việc agent không được tải model, chỉ trong phạm vi model local và giới hạn đã ghi.

**Trả lời (đã chốt):**

```text
Model local: qwen3.5:latest (7.6 GB; Ollama 0.40.6)
Model cloud trong danh sách Ollama: glm-5.3-flash:cloud (không dùng trong MVP)
Inference smoke test: thành công với prompt tổng hợp không nhạy cảm; khoảng 38 giây cho lần thử này
Performance: chưa đặt ngưỡng; đo và báo trong acceptance
Cho phép nghiệm thu local bằng prompt tổng hợp không nhạy cảm; không gửi dữ liệu riêng tư hoặc tự fallback cloud
```

**Cách làm nếu chọn A:** BOSS tự tải model bằng `ollama pull <model>` theo model mình chọn, sau đó chạy `ollama list` và ghi nguyên tag ở đây (ví dụ định dạng tag có thể là `tên-model:tag`; ví dụ này không khuyến nghị model cụ thể).

**Cách làm nếu chọn B:** ghi dung lượng tối đa được tải xuống và dung lượng tối đa model chiếm trên ổ đĩa. Agent sẽ kiểm tra cấu hình máy và chọn model trong giới hạn đó. Nếu không chấp nhận model phù hợp nào trong giới hạn, agent sẽ báo lại thay vì tự nâng giới hạn.

Chọn kỳ vọng performance:

- [x] MVP ưu tiên chạy đúng trên máy hiện tại; chưa có ngưỡng latency bắt buộc. Agent đo và báo thời gian phản hồi, không tự tuyên bố đạt performance production.
- [ ] Có yêu cầu cụ thể: `...` (ví dụ thời gian chờ tối đa chấp nhận được).

- [x] Cho phép agent gửi prompt test tổng hợp, không nhạy cảm đến model local để kiểm tra chat, streaming, cancel, resume, lesson generation và grounded answers. Không tự chuyển sang cloud khi local lỗi.

Đánh dấu dòng performance đầu tiên nếu chưa có mục tiêu tốc độ cụ thể. Quyền chạy inference là một xác nhận riêng: chỉ đánh dấu nếu đồng ý cho ứng dụng gửi prompt test tổng hợp tới model Ollama local.

**Hoàn tất khi:** exact model đã có sẵn hoặc có quyền tải rõ ràng; runtime có thể truy cập; agent được phép chạy local inference. Agent sẽ xác minh cả request thực tế và lỗi provider theo [API chat của Ollama](https://docs.ollama.com/api/chat).

## 3. BOSS cần quyết định một lần — Dữ liệu và phạm vi MVP

### OWNER-03 — History: cách lưu và hành vi dữ liệu

**Ý nghĩa:** history là các conversation và message đã chat. Quyết định này xác định chúng có tồn tại sau khi đóng/restart ứng dụng không, và hành động xóa có ảnh hưởng tới lesson đã lưu hay không.

Chọn một cách quyết định storage:

- [x] Giao agent chọn local persistence tối thiểu phù hợp repo, tài liệu hóa lựa chọn và trade-off; không cần hỏi lại về library/schema nội bộ.
- [ ] BOSS yêu cầu cụ thể: `...` (SQLite hiện chỉ là candidate trong plan, chưa phải yêu cầu đã chốt).

Chọn hoặc sửa hợp đồng hành vi đề xuất:

- [x] Lưu history trên máy, giữ đến khi người dùng chủ động xóa; không tự gửi đi cloud hoặc tự đồng bộ.
- [x] Sau khi restart app, có thể mở lại conversation và tiếp tục chat.
- [x] Stop response giữ phần nội dung đã nhận, đánh dấu interrupted; không giả vờ response đã hoàn tất.
- [x] Xóa conversation xóa history đó khỏi storage của ứng dụng; không xóa các lesson đã được xác nhận lưu riêng. Đây không phải yêu cầu secure erase trên filesystem/backup.

**Trả lời nếu khác đề xuất hoặc có retention tự động:** `...`

### OWNER-04 — Knowledge: tổ chức và format Markdown

**Ý nghĩa:** knowledge là các lesson/note được người dùng chủ động lưu để tìm lại hoặc dùng làm nguồn trả lời. Nếu không có schema riêng, giao agent định nghĩa frontmatter và naming rule để các file Markdown nhất quán, có thể mở bằng Obsidian.

Chọn một:

- [x] Giao agent chốt schema MVP tối thiểu theo các giới hạn dưới đây; không cần chờ BOSS học xong Lesson 08 hoặc duyệt lại từng field kỹ thuật.
- [ ] BOSS có schema/tài liệu bắt buộc: ghi đường dẫn hoặc nội dung không nhạy cảm tại đây: `...`

Giới hạn đề xuất để agent tự hoàn thiện schema:

- [x] Vault chính thức là thư mục `knowledge/` trong repo; Markdown là source of truth và có thể mở bằng Obsidian.
- [x] Frontmatter tối thiểu chứa title, tags, thời điểm tạo/cập nhật và source reference khi có; agent chọn tên field và định dạng nhất quán, ghi tài liệu kèm validation.
- [x] Mỗi knowledge item có keyword/slug duy nhất. Collision phải được phát hiện trước khi ghi: không tạo knowledge duplicate và không ghi đè. Nếu key đã tồn tại nhưng nội dung mới khác hoặc bổ sung, đưa ra proposal có diff để BOSS review cách bổ sung vào knowledge hiện có; chỉ ghi phần bổ sung sau xác nhận rõ ràng.
- [x] MVP dùng keyword/full-text search, trả source path/snippet; chưa cần embeddings, vector database, tự liên kết hay tự cập nhật note.

**Quy định naming/folder/Wikilink đặc biệt nếu có:** `...`

Không bắt buộc BOSS cung cấp note thật. Agent có thể tạo fixture tổng hợp trong thư mục test tạm, không coi chúng là tri thức thật hoặc tự seed chúng vào vault của BOSS.

### OWNER-05 — Privacy và quyền lưu lesson

**Ý nghĩa:** các checkbox này giới hạn dữ liệu đầu vào và ngăn lesson được ghi tự động. Với đề xuất an toàn cho MVP cá nhân, chỉ dùng nội dung do BOSS chủ động nhập và luôn yêu cầu review/xác nhận trước khi ghi file.

Chọn hoặc sửa:

- [x] MVP chỉ dùng dữ liệu cá nhân do BOSS chủ động nhập; không tự đọc repo/vault/tệp bên ngoài phạm vi đã chọn.
- [x] Không đưa secret, credential hoặc dữ liệu công ty/khách hàng vào dữ liệu nghiệm thu. Nếu BOSS cần xử lý dữ liệu đó, mô tả chính sách riêng trước.
- [x] “Save as Lesson” tạo bản đề xuất; BOSS có thể sửa, hủy hoặc xác nhận. Chỉ thao tác xác nhận trong sản phẩm mới ghi lesson vào vault.
- [x] Không tự lưu mọi conversation thành lesson. Lesson đã lưu tồn tại độc lập với history theo OWNER-03.
- [x] MVP chưa yêu cầu hệ thống tự phát hiện/redact mọi loại thông tin nhạy cảm. Không được mô tả ứng dụng là đã bảo đảm loại bỏ toàn bộ secret. Nếu cần redaction bắt buộc, điền rule và ví dụ không nhạy cảm bên dưới.

**Dữ liệu bị cấm / rule redaction / phạm vi đọc khác nếu có:** `...`

### OWNER-06 — Local-only hay cloud trong MVP

**Ý nghĩa:** chọn local-only nghĩa là conversation và inference chạy với Ollama local, không cần API key cloud. Chỉ chọn cloud nếu BOSS muốn dữ liệu gửi tới provider bên ngoài và có thể xác định provider, model, dữ liệu được gửi, cùng giới hạn chi phí.

Chọn **một**:

- [x] **Local-only MVP:** chỉ Ollama `qwen3.5:latest`; không cần API key, cloud adapter hay cloud selector. Chấp nhận MVP sau khi luồng local và Obsidian pass; cloud để giai đoạn sau.
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

**Ý nghĩa:** đây là bước nghiệm thu cuối, không phải setup cần làm ngay hôm nay. Agent sẽ cung cấp đường dẫn vault cụ thể sau khi implementation tạo ra lesson; lúc đó BOSS có thể mở path đó trong Obsidian và xác nhận nội dung đọc/sửa được.

- [x] BOSS đồng ý mở `knowledge/` của checkout tích hợp cuối cùng làm vault trong Obsidian. Agent phải cung cấp exact path trước bước kiểm tra này.
- [x] BOSS đồng ý bài nghiệm thu bên dưới.

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

- [x] BOSS sẽ tự kiểm tra thủ công khi agent cung cấp file/path và ghi kết quả; không đánh dấu owner acceptance trước bước này.
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

### Câu trả lời mẫu để copy và chỉnh

Mẫu này tương ứng với gợi ý local MVP ở trên. Hãy sửa/xóa những dòng BOSS chưa đồng ý; các giới hạn trong ngoặc vuông phải được điền trước khi cho phép agent tải model.

```text
OWNER-02: Giao agent kiểm tra cấu hình máy và chọn model Ollama. Chỉ tải tối đa [N] GB; model được phép dùng tối đa [N] GB ổ đĩa. Tôi cho phép prompt test tổng hợp, không nhạy cảm, gửi tới Ollama local. Chưa đặt ngưỡng latency; đo và báo kết quả.
OWNER-03: Giao agent chọn storage local tối thiểu. Đồng ý giữ history đến khi xóa, mở lại sau restart, giữ trạng thái interrupted khi dừng response, và không xóa lesson khi xóa conversation.
OWNER-04: Giao agent chọn schema/naming rule Markdown tối thiểu trong knowledge/. Mỗi knowledge item có keyword/slug unique; không duplicate hoặc overwrite. Nếu cùng key có kiến thức mới khác biệt, agent đưa proposal bổ sung có diff để tôi review/xác nhận. Chỉ keyword/full-text search; chưa cần embeddings/vector database.
OWNER-05: Chỉ dùng dữ liệu tôi chủ động nhập. Lesson phải preview/edit/cancel/confirm trước khi ghi. Không dùng dữ liệu công ty/khách hàng hoặc tự đọc file bên ngoài phạm vi đã duyệt.
OWNER-06: Local-only MVP với Ollama; không tích hợp cloud trong MVP.
OWNER-07: Đồng ý các bước nghiệm thu trong checklist. Tôi sẽ mở vault bằng Obsidian thủ công sau khi agent gửi exact path. UI tiếng Việt; use case bổ sung: không có.
Implementation: Trong các quyết định đã nêu, agent được tự chọn contract, schema kỹ thuật, library và test phù hợp; tiếp tục M2–M4, sửa lỗi và commit local. Không push, deploy hoặc merge protected branch.
```

- [x] OWNER-01: runtime URL và trạng thái setup đã có.
- [x] OWNER-02: dùng model local `qwen3.5:latest`; synthetic inference test được phép; không có latency SLA.
- [x] OWNER-03: giao agent chọn persistence local; retention/resume/stop/delete đã chốt.
- [x] OWNER-04: schema/search giao agent theo giới hạn đã chọn; keyword/slug unique, không duplicate/overwrite, khác biệt thì proposal bổ sung có review.
- [x] OWNER-05: privacy và xác nhận trước khi lưu lesson đã chốt.
- [x] OWNER-06: local-only với Ollama; cloud để giai đoạn sau.
- [x] OWNER-07: acceptance scenario đã chốt; BOSS kiểm tra Obsidian thủ công.

Sau khi BOSS điền, agent rà soát completeness, cập nhật plan/STATUS/HANDOFF/BLOCKERS theo quyết định mới và tiếp tục phần thực hiện được. Không giữ các quyết định đã được cung cấp trong trạng thái BLOCKED.

Checklist này xử lý các owner dependency hiện biết; lỗi kỹ thuật mới vẫn có thể xuất hiện trong quá trình tích hợp. Agent tự điều tra và sửa trong scope, chỉ ghi blocker khi thực sự cần đầu vào hoặc quyền nằm ngoài những gì đã cấp.
