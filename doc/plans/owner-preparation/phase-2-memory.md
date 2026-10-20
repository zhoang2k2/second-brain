# Phase 2 — BOSS chuẩn bị cho Intelligent Second Brain

[Hướng dẫn chung](README.md) · [Implementation plan](../phase-2-intelligent-second-brain.md)

**Điều kiện vào phase:** Phase 1 đã được nghiệm thu; scope Phase 2 và chính sách dữ liệu được duyệt. Những lựa chọn dưới đây là đề xuất mới, chưa được coi là BOSS đồng ý.

## Danh sách việc của BOSS

| Mã    | Việc                                                     | Bắt buộc khi nào?                                         |
| ----- | -------------------------------------------------------- | --------------------------------------------------------- |
| P2-O1 | Chọn các chức năng đưa vào phase                         | Luôn cần                                                  |
| P2-O2 | Chốt nguồn dữ liệu, project và quyền chia sẻ             | Luôn cần                                                  |
| P2-O3 | Chốt vòng đời memory và cách xử lý mâu thuẫn             | Luôn cần                                                  |
| P2-O4 | Chốt bộ câu hỏi và tiêu chí retrieval                    | Luôn cần; có thể giao agent tạo fixtures                  |
| P2-O5 | Quyết định có embeddings hay không, cùng resource budget | Khi chọn semantic search hoặc cho phép đánh giá để bật nó |
| P2-O6 | Chọn MCP client, quyền và chuẩn bị truy cập              | Khi chọn MCP                                              |
| P2-O7 | Chốt log/retention và quyền dùng model                   | Luôn cần                                                  |
| P2-O8 | Kiểm tra client và nhận kết quả cuối                     | Sau khi có implementation                                 |

### P2-O1 — Chọn kết quả cần dùng

1. Chọn `Có` hoặc `Không thuộc phase` cho từng dòng; không mặc định tất cả roadmap đều phải làm cùng lúc.

| Chức năng                                                                 | Lựa chọn của BOSS |
| ------------------------------------------------------------------------- | ----------------- |
| Ghi nhớ preference/decision từ nội dung BOSS chủ động cung cấp, có review | [CHỌN]            |
| So sánh note mới với note cũ, phát hiện trùng và mâu thuẫn                | [CHỌN]            |
| Liên kết note có nguồn rõ ràng                                            | [CHỌN]            |
| Cải thiện keyword retrieval và đánh giá bằng bộ câu hỏi                   | [CHỌN]            |
| Semantic search bằng embeddings khi có bằng chứng cần thiết               | [CHỌN theo P2-O5] |
| MCP để một AI client truy cập Second Brain                                | [CHỌN theo P2-O6] |

2. **Gợi ý ban đầu:** memory có review, kiểm tra trùng/mâu thuẫn, note links và keyword evaluation. MCP có thể làm nếu BOSS chuẩn bị được client; embeddings chỉ bật khi evaluation và resource budget cho phép.
3. Ghi 2–3 tình huống thực tế, ví dụ: “nhớ package manager tôi chọn”, “biết một quyết định đã được thay thế”, “tìm lại lesson dù câu hỏi diễn đạt khác”.

**Gửi lại:** các dòng Có/Không và tình huống mong muốn. Agent viết acceptance tương ứng trước khi code; chức năng bị loại không được báo là đã triển khai.

### P2-O2 — Dữ liệu nào được đọc và chia sẻ?

1. Liệt kê đường dẫn chính xác của từng vault/project được đọc. Có thể giữ một vault hiện tại để bắt đầu; không cấp quyền đọc toàn bộ home folder.
2. Với từng nơi, ghi: được đọc, được tạo proposal, được ghi sau review, được chia sẻ qua MCP hay không.
3. Chọn có cho đọc chéo project hay không. **Gợi ý:** mặc định không; chỉ dùng knowledge của project đang chọn, knowledge chung phải được BOSS đánh dấu riêng.
4. Ghi số người dùng và quy mô dự kiến. **Gợi ý:** một người dùng; nếu chưa biết số note, giao agent đo vault được cấp quyền và báo quy mô đã kiểm tra. Nhu cầu nhiều người dùng phải được ghi riêng trước khi thiết kế permissions/storage.

```text
Nguồn: [đường dẫn đầy đủ]
Project/nhãn: [tên]
Cho đọc: [Có/Không]
Cho tạo proposal từ nội dung này: [Có/Không]
Cho ghi sau khi tôi xác nhận: [Có/Không]
Cho client MCP đọc: [Có/Không/Không áp dụng]
Các thư mục/file loại trừ: [danh sách]
```

**Hoàn thành khi:** mỗi nguồn có quyền rõ ràng. Không gửi nội dung nhạy cảm để “làm sample”; agent được dùng dữ liệu tổng hợp để kiểm tra quyền và isolation.

### P2-O3 — Memory được thêm, sửa và quên như thế nào?

1. Đọc bảng gợi ý. BOSS có thể trả lời `Đồng ý toàn bộ P2-O3` hoặc sửa từng dòng.

| Tình huống                            | Chính sách gợi ý để duyệt                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| AI muốn nhớ một thông tin mới         | Tạo proposal; chỉ dùng làm knowledge sau khi BOSS xác nhận                                            |
| Nội dung giống hệt note đã có         | Không tạo bản trùng, kể cả khi hai request chạy đồng thời                                             |
| Cùng chủ đề nhưng có thông tin mới    | Hiện nội dung cũ, phần đề xuất thay đổi và nguồn; chờ xác nhận                                        |
| Hai nguồn mâu thuẫn                   | Gắn cờ mâu thuẫn; không tự đoán cái nào đúng hoặc xuất bản cả hai như cùng đúng                       |
| BOSS từ chối proposal                 | Không tự đề xuất lại cùng phiên bản nội dung; bản có nội dung/nguồn thay đổi được xem xét riêng       |
| BOSS chủ động sửa note trong Obsidian | Xem là nội dung BOSS chủ động sửa; validate và cập nhật retrieval. Quyền ghi của AI vẫn cần review    |
| BOSS chọn Quên/Archive                | Ngừng dùng trong retrieval ở cả app và MCP; giữ bản gốc để khôi phục. Xóa file thật là thao tác riêng |

2. Chốt có lưu revision/provenance hay không. **Gợi ý:** giữ nguồn, thời điểm, người/phương thức xác nhận và dấu nhận diện phiên bản để kiểm tra vì sao một memory được dùng.
3. Với quyết định không thể tự phân xử, sản phẩm phải hiển thị để BOSS review. Agent lập trình vẫn hoàn thành được chức năng bằng fixtures; không phải chờ BOSS cung cấp mâu thuẫn thật.

**Gửi lại:** đồng ý bảng hoặc thay đổi cụ thể; cách xử lý manual edit và Quên phải được chốt, không để agent tự invent lifecycle.

### P2-O4 — Chuẩn bị bài kiểm tra retrieval

1. Chọn BOSS tự cung cấp hay giao agent tạo **20 cặp câu hỏi → note đúng** không nhạy cảm, kèm trường hợp không có câu trả lời và khác project.
2. Mỗi cặp ghi đường dẫn/tên note đúng và thông tin phải tìm được. Ví dụ: “Tôi chọn pnpm vì sao?” → note quyết định package manager; “mật khẩu dịch vụ” → không có dữ liệu để trả lời.
3. **Gợi ý để duyệt:** ít nhất 16/20 câu trả đúng note trong 3 kết quả đầu; 100% trường hợp bị cấm không được lộ nguồn; note đã Quên/từ chối không xuất hiện; citation chỉ ghi nguồn thực sự được cung cấp và dùng. Agent đánh giá sự đúng của answer riêng với điểm tìm note.

**Gửi lại:** ai tạo dataset, expected results và ngưỡng đạt. Nếu dùng fixtures do agent tạo, agent phải lưu dataset/evaluation để có thể kiểm tra lại; không tự thay bộ câu hỏi chỉ để nâng điểm.

### P2-O5 — Có cần semantic search ngay không?

Embeddings là cách biểu diễn nội dung để tìm theo ý nghĩa; việc BOSS chọn tính năng này không tự chứng minh nó cần thiết hoặc chạy vừa RAM.

1. Chọn **A — Chưa đưa vào phase**, hoặc **B — Cho agent đánh giá có điều kiện**.
2. Nếu B, chốt local/cloud. **Gợi ý:** local-only, chi phí API bằng 0; agent chọn phương án sau khi kiểm tra compatibility/license và đo trên máy thật.
3. Điền giới hạn tổng dung lượng tải thêm, RAM/disk thêm được phép và điều kiện bật. Một đề xuất để duyệt: tải thêm tối đa 2 GB, RAM thêm tối đa 2 GB; chỉ bật nếu keyword không đạt P2-O4 và phương án mới đạt ngưỡng tốt hơn đã chốt. Đây là giới hạn lựa chọn, không phải bảo đảm có model phù hợp.

**Gửi lại:** A hoặc B với đủ giới hạn và kết quả phải đạt. Nếu không có phương án khả thi, agent ghi evaluation không đạt và giữ phần keyword độc lập; không được báo semantic search đã xong hoặc âm thầm dùng cloud. Việc có chấp nhận scope keyword-only sau đó phải được ghi rõ.

### P2-O6 — Chuẩn bị MCP client nếu chọn tích hợp

MCP ở đây là giao diện để client khác gọi chức năng của Second Brain; nó không tự cấp quyền đọc/ghi dữ liệu.

1. Chọn **một client BOSS thực sự muốn dùng đầu tiên**; ghi tên, version và máy đang cài. Agent xác minh cách kết nối tương ứng version, không đoán cấu hình từ tên app.
2. Chọn tools/quyền. **Gợi ý:** chỉ tìm và đọc knowledge đã được duyệt trong P2-O2; không ghi file, chạy command, đọc history riêng hoặc đọc project khác. Nếu cần tạo proposal, ghi riêng; proposal không đồng nghĩa được ghi note.
3. Mở client và sẵn sàng thực hiện login/enable connection/cấp quyền nếu client yêu cầu ở thời điểm setup. Agent chuẩn bị hướng dẫn và cấu hình cụ thể trước; BOSS không phải tự viết MCP config.

**Gửi lại:** tên/version/client target, các quyền đã chọn, account đã đăng nhập hay chưa, và `Tôi sẽ thực hiện bước UI bắt buộc khi cấu hình sẵn sàng`. Nếu không chọn MCP, ghi `Không áp dụng`, không cần cài thêm client.

**Cần chốt đích dữ liệu:** client có thể đưa kết quả tool vào context của model mà nó sử dụng. Agent phải xác minh luồng dữ liệu của client đã chọn. Nếu có model cloud, BOSS phải duyệt provider đích và loại note được gửi; không suy ra dữ liệu vẫn local chỉ vì MCP server chạy local. Nếu giữ local-only, chỉ chọn cách tích hợp đáp ứng đúng giới hạn đó.

Client/transport có thể không tương thích dù đã có account. Phải có một lần gọi tool thật từ client trước khi đánh dấu acceptance. [Lưu ý chính thức về quyền của MCP server local](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md).

### P2-O7 — Log, retention và model

1. Chọn model/provider cho proposal và answer; có thể giữ local model đã có. Nếu đổi model, cấp giới hạn chọn/tải cụ thể như P2-O5.
   - Nếu muốn thêm điều khiển thinking, temperature, giới hạn output hoặc context policy, ghi rõ đưa tính năng nào vào scope. BOSS chọn nhu cầu/giới hạn; agent xác minh parameter tương ứng model/provider. Không mặc định mọi API có cùng tên hoặc cùng dải giá trị.
   - Với context policy mới, chốt cách ưu tiên input mới, system instruction, knowledge và history cũ. Có thể giao agent đề xuất và kiểm tra theo budget; không coi cắt theo số message là bằng chứng đã tối ưu token.
2. Chọn dữ liệu được ghi log và giữ bao lâu. **Gợi ý:** log metadata lỗi/hành động tối đa 7 ngày, không lưu nguyên prompt/answer hoặc secret vào diagnostic log; history sản phẩm theo chính sách riêng đã duyệt.
3. Chốt cloud có thuộc phase không. **Gợi ý:** không. Nếu Có, cần provider/model, dữ liệu được gửi, ngân sách, cấu hình credential và cách xử lý khi hết hạn mức; agent không được tự chuyển provider.

**Gửi lại:** model/provider, retention/log và quyền network. Agent phải kiểm tra nguồn dữ liệu được phép trước khi gọi model hoặc trả dữ liệu qua MCP.

### P2-O8 — Nghiệm thu sau implementation

1. Agent giao dataset, điểm retrieval, các test lifecycle/quyền và report trên đúng commit.
2. BOSS thử thêm/sửa/từ chối/Quên một memory mẫu và kiểm tra nó có được dùng đúng hay không.
3. Nếu chọn MCP, mở client đã chọn, gọi tìm/đọc note và thử một yêu cầu ngoài scope; yêu cầu ngoài scope phải bị từ chối. BOSS ghi kết quả, không chỉ “đã cài client”.

**Hoàn thành khi:** scope đã chọn có đủ bằng chứng, permission tests đạt và owner chốt nghiệm thu. Xử lý mâu thuẫn đúng bằng cách chờ review là hành vi sản phẩm hợp lệ; agent không tự xác nhận thay BOSS.

## Mẫu trả lời

```text
Phase 2:
P2-O1: Các chức năng Có [danh sách]; Không thuộc phase [danh sách]; tình huống [2–3 ví dụ / giao agent tạo synthetic].
P2-O2: Nguồn và quyền [điền theo mẫu]; đọc chéo project [Không/Có với phạm vi].
P2-O3: Đồng ý toàn bộ bảng gợi ý / [các thay đổi].
P2-O4: Dataset [agent tạo/tôi cung cấp]; ngưỡng [16/20 trong top 3 hoặc số khác]; các deny case phải đạt 100%.
P2-O5: A / B với [giới hạn tải, RAM/disk, provider, điều kiện bật, điều kiện đạt].
P2-O6: MCP [Không áp dụng / tên client, version, quyền]; đích dữ liệu [local / provider cloud đã duyệt và loại note]; bước UI bắt buộc [tôi thực hiện khi sẵn sàng].
P2-O7: Model/provider [tên hoặc ủy quyền có giới hạn]; cloud [Không/Có với budget]; log [loại và thời hạn].
P2-O8: Tôi nghiệm thu lifecycle và client sau khi agent giao bản có thể thử.
```

## Câu trả lời của BOSS — 2026-10-20

Chốt qua hỏi–đáp trực tiếp với agent. Đây là quyết định đã duyệt. **Điều kiện vào phase vẫn giữ nguyên:** chỉ bắt đầu implementation Phase 2 sau khi BOSS nghiệm thu Phase 1 (P1-O5/P1-O6).

Máy hiện tại khi chốt: Apple M1, RAM 16 GB, ổ đĩa trống ~7.6 GB. Agent phải kiểm tra lại dung lượng trống trước khi tải bất kỳ thứ gì.

```text
Phase 2:
P2-O1: Có — ghi nhớ preference/decision có review; so sánh note mới/cũ phát hiện trùng và mâu thuẫn;
       liên kết note có nguồn; cải thiện keyword retrieval và đánh giá bằng bộ câu hỏi.
       Semantic search: theo P2-O5. MCP: Không thuộc phase.
       Tình huống: (1) nhớ package manager tôi chọn; (2) biết một quyết định đã được thay thế;
       (3) tìm lại lesson dù câu hỏi diễn đạt khác. Agent tạo dữ liệu tổng hợp cho cả 3.
P2-O2: Nguồn: knowledge/ của checkout tích hợp cuối (hiện tại
       /Users/hoang.nguyen/Personals/second-brain/.worktrees/feature-m2/knowledge/)
       Project/nhãn: second-brain
       Cho đọc: Có
       Cho tạo proposal từ nội dung này: Có
       Cho ghi sau khi tôi xác nhận: Có
       Cho client MCP đọc: Không áp dụng
       Các thư mục/file loại trừ: Không có
       Đọc chéo project: Không. Một người dùng; agent tự đo quy mô vault và báo lại.
P2-O3: Đồng ý toàn bộ bảng gợi ý, gồm lưu revision/provenance (nguồn, thời điểm, phương thức xác nhận, phiên bản).
P2-O4: Dataset do agent tạo (20 cặp tổng hợp, gồm case không có câu trả lời và khác project), lưu lại để kiểm tra lại;
       ngưỡng ≥16/20 đúng note trong top 3; deny case đạt 100%; note đã Quên/từ chối không xuất hiện.
P2-O5: B — đánh giá có điều kiện, chỉ local, chi phí API = 0. Tải thêm tối đa 1 GB; RAM thêm tối đa 2 GB.
       Chỉ bật nếu keyword không đạt P2-O4 và embeddings đạt ngưỡng tốt hơn. Không khả thi thì giữ keyword và ghi rõ.
P2-O6: MCP Không áp dụng.
P2-O7: Model qwen3.5:latest (local); cloud: Không. Log chỉ metadata lỗi/hành động, giữ tối đa 7 ngày,
       không lưu nguyên prompt/answer hoặc secret. Thinking/temperature/context policy: agent đề xuất và kiểm tra trong scope.
P2-O8: Tôi nghiệm thu lifecycle sau khi agent giao bản có thể thử.

Push/deploy/merge: Không. Chỉ commit local trên feature branch.
Agent không hỏi lại trong phạm vi đã duyệt; tự xử lý chi tiết kỹ thuật và tiếp tục mọi việc độc lập.
Nếu gặp việc ngoài scope: ghi report, tiếp tục phần độc lập, không tự mở rộng quyền.
```
