# Phase 4 — BOSS chuẩn bị cho Independent AI

[Hướng dẫn chung](README.md) · [Implementation plan](../phase-4-independent-ai.md)

**Mục tiêu:** chứng minh các chức năng đã chọn hoạt động khi không có Internet, khôi phục được dữ liệu, và chạy trên máy độc lập nếu BOSS yêu cầu. Máy laptop chạy local không tự đáp ứng yêu cầu chạy 24/7 khi chính laptop đã tắt.

## Danh sách việc của BOSS

| Mã    | Việc                                                 | Thời điểm                                                          |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| P4-O1 | Chọn scope offline/hosting và máy đích               | Trước triển khai                                                   |
| P4-O2 | Chuẩn bị account/quyền truy cập môi trường           | Trước deploy/test trên máy đích                                    |
| P4-O3 | Chốt model/runtime/resource budget                   | Trước đóng gói hoặc tải thêm                                       |
| P4-O4 | Chốt các chức năng phải dùng được offline            | Trước triển khai                                                   |
| P4-O5 | Chuẩn bị backup destination, key và recovery targets | Chính sách trước triển khai; destination/key trước kiểm tra backup |
| P4-O6 | Chốt truy cập từ xa, vận hành và thời gian bảo trì   | Khi đưa hosting/remote access vào scope                            |
| P4-O7 | Thực hiện hoặc hỗ trợ offline/restore acceptance     | Sau khi agent chuẩn bị đủ artifacts                                |
| P4-O8 | Chốt bản vận hành cuối                               | Sau khi đủ bằng chứng                                              |

### P4-O1 — Máy nào phải tiếp tục chạy?

1. Chọn **A — Offline trên máy hiện có**, hoặc **B — Offline và máy chạy độc lập khi laptop tắt**.
2. Ghi tên máy, hệ điều hành và nơi máy hoạt động. Nếu chọn B, phải có một máy khác thực sự được cấp điện và quyền sử dụng; ghi cả người vận hành máy đó.
3. Ghi ngân sách nếu chưa có máy. Nếu chưa cho phép mua/thuê, agent khảo sát trên tài nguyên có sẵn và báo phần không khả thi; không tự mua hoặc thuê dịch vụ.

**Gửi lại:** A/B, máy đích, OS, tình trạng đã có máy và budget. Agent tự đo RAM/disk/version sau khi truy cập; BOSS không cần đoán một model có vừa máy không.

### P4-O2 — Chuẩn bị quyền truy cập đúng máy

1. Tạo hoặc chọn account mà agent được dùng trên máy đích; ghi quyền cài phần mềm, khởi động service, ghi data và thư mục được phép.
2. Nếu kết nối từ máy khác, BOSS hoàn tất login/cấp quyền qua luồng phù hợp; không dán password/private key vào chat hoặc file plan.
3. Cho agent chạy preflight đọc thông tin máy và kiểm tra kết nối trước khi triển khai. Việc có IP hoặc account chưa chứng minh kết nối đã hoạt động.

**Gửi lại:** tên máy/địa chỉ kết nối không chứa secret, account role, read/write paths, quyền được cấp và kết quả preflight. Quyền admin chỉ cấp nếu phương án cụ thể cần và đã được duyệt; agent không tự mở rộng quyền để vượt lỗi.

### P4-O3 — Model, runtime và tài nguyên

1. Chọn giữ model/runtime hiện có hay giao agent chọn phương án phù hợp máy đích.
2. Nếu giao chọn, điền giới hạn RAM, disk, tổng GB tải thêm, chi phí và mục đích dùng model: chỉ dùng cá nhân hay còn muốn chia sẻ/phân phối cho người khác. Agent kiểm tra license tương ứng. Có thể chọn không tải thêm; khi đó agent chỉ dùng artifacts đang có.
3. Chốt bài đo latency/quality trên máy đích. Không lấy kết quả warm trên Mac hiện tại làm bằng chứng cho server khác.

**Gửi lại:** lựa chọn model/runtime hoặc quyền chọn có giới hạn; giới hạn tải và yêu cầu latency/quality. Agent xác minh license, compatibility và assets trước khi download/đóng gói. Việc vận hành local không đồng nghĩa mọi model có cùng quyền phân phối.

### P4-O4 — Offline phải làm được những gì?

1. Chọn các dòng cần đạt; cloud hoặc dịch vụ chỉ có online phải được ghi là không dùng được offline.

| Luồng                                               | Gợi ý để BOSS chọn                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Khởi động ứng dụng và runtime khi không có Internet | Bắt buộc                                                                     |
| Chat với model đã lưu local                         | Bắt buộc                                                                     |
| Mở history, tìm/đọc knowledge, review/save lesson   | Bắt buộc                                                                     |
| Semantic retrieval/MCP                              | Bắt buộc nếu đã chọn và quảng bá là dùng được offline                        |
| AI Agent actions                                    | Chỉ các action đã duyệt từ Phase 3, dùng tài nguyên local đã chuẩn bị        |
| Tải package/model, gọi cloud/search Internet        | Không có trong bài offline; phải có thông báo phù hợp nếu người dùng yêu cầu |

2. Chọn thời lượng thử và có cần cold start/restart không. **Gợi ý:** 30 phút không có Internet, gồm restart và các luồng bắt buộc; đây là bài test chức năng, không chứng minh uptime dài hạn.
3. Chọn máy test tách biệt để cắt mạng không làm mất quyền điều khiển agent. Nếu dùng cùng máy đang kết nối agent cloud, chuẩn bị theo P4-O7 trước khi tắt mạng.

**Gửi lại:** danh sách luồng, thời lượng, cách ngắt mạng và cách lưu bằng chứng. Agent chuẩn bị đủ model weights, runtime, dependencies và assets để không cần download trong bài test.

### P4-O5 — Backup và khôi phục được đến mức nào?

RPO là dữ liệu mới có thể mất tối đa khi phải khôi phục từ backup. RTO là thời gian chấp nhận để khôi phục hoạt động. Hai số này khác với checkpoint của một response đang stream.

1. Chọn nơi backup bằng path/destination cụ thể, quyền ghi và dung lượng. Không để bản duy nhất nằm trong worktree sẽ bị xóa; chọn có cần thêm một bản ở thiết bị khác hay không.
2. Chốt nội dung backup: knowledge, history/metadata, cấu hình cần thiết và manifest phiên bản. Nếu yêu cầu restore hoàn toàn offline trên máy sạch, model weights/runtime/dependencies phải có trong backup hoặc kho offline riêng đã kiểm tra truy cập được.
3. Chọn mã hóa và cách giữ key. **Gợi ý:** backup có dữ liệu riêng được mã hóa; BOSS giữ key ở nơi tách biệt và có thể lấy lại khi restore. Không gửi key vào report hoặc Git.
4. Chốt lịch và giới hạn mất dữ liệu/thời gian khôi phục. Một gợi ý cho dự án cá nhân để duyệt: backup hằng ngày, giữ 7 bản ngày và 4 bản tuần, RPO 24 giờ, RTO 2 giờ. Nếu BOSS muốn mất ít hơn hoặc phục hồi nhanh hơn, ghi số khác để agent thiết kế và đo lại.

**Gửi lại:** destination, quyền, dung lượng, dữ liệu được backup, vị trí quản lý key không chứa giá trị key, lịch/retention/RPO/RTO và nơi restore test. Backup đã tạo chưa có nghĩa restore đã thành công.

Các giá trị ở trên là đề xuất cho dự án này, không phải ngưỡng bắt buộc từ tiêu chuẩn. [NIST: hướng dẫn lập kế hoạch khôi phục](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final).

### P4-O6 — Truy cập từ xa và vận hành

1. Chọn chỉ dùng trên máy đích, dùng trong mạng riêng hay truy cập từ Internet. **Gợi ý ban đầu:** chỉ trên máy đích/mạng riêng đã duyệt; không mặc định mở ứng dụng ra Internet.
2. Nếu cần remote access, ghi ai được dùng, cách đăng nhập/thu hồi quyền và quyền network cụ thể. Agent đề xuất phương án phù hợp và kiểm tra trước khi mở quyền truy cập.
3. Chốt có tự khởi động sau reboot, tự restart khi lỗi, lịch backup và thời gian được dừng app để bảo trì hay không.
4. Ghi người xử lý sự cố và nơi xem report. **Gợi ý:** report/status local trước; email/Slack chỉ khi có đích gửi và quyền gửi cụ thể.

**Gửi lại:** access model, users, quyền triển khai trên đúng máy, lịch bảo trì và người vận hành. Agent chuẩn bị bản deploy/rollback có thể review trước bước triển khai cần phê duyệt; checklist không tự cấp quyền thay firewall hoặc publish app.

Nếu có nhiều người dùng hoặc nhiều server process cùng ghi dữ liệu, agent phải đánh giá lại persistence và isolation. JSON history hiện tại được thiết kế cho một process local; không mặc định nó đã đáp ứng scope hosting mới.

### P4-O7 — Chạy bài offline và restore sau khi đã chuẩn bị

1. Agent giao trước: đúng URL/commands trên máy đích, script kiểm tra nếu cần, expected results, nơi lưu log, bản backup và kế hoạch khôi phục. Chưa có bộ này thì BOSS chưa cần tắt mạng.
2. Chạy kiểm tra online để chắc bộ test có thể khởi động. Ghi lại model/runtime/commit và trạng thái tải assets.
3. Agent thực hiện isolation network trên máy test nếu được duyệt; hoặc BOSS ngắt Internet của máy đích theo kế hoạch. Giữ đường khôi phục truy cập để không tự khóa mình khỏi máy.
4. Thực hiện P4-O4, gồm restart nếu đã chọn. Lưu kết quả local, không cần agent cloud trực tuyến trong suốt bài test nếu đã giao script.
5. Restore backup vào một môi trường sạch/test đã được duyệt, không ghi đè vault đang dùng. So sánh note/history/metadata và chạy lại các luồng bắt buộc; đo thời gian restore.
6. Kết nối lại mạng nếu đã ngắt; gửi report/log đã loại thông tin nhạy cảm và kết quả đạt/chưa đạt.

**Hoàn thành khi:** có bằng chứng mạng thực sự bị ngắt với đúng luồng và có một lần restore thật. Việc nhìn thấy UI offline hoặc thấy file backup không thay thế hai bài kiểm tra này.

### P4-O8 — Chốt vận hành

1. Đọc report phần cứng, model/runtime, offline, backup/restore, access control và phần còn hạn chế.
2. Xác nhận BOSS có thể tự khởi động/dừng, lấy backup và làm theo hướng dẫn restore đã được thử.
3. Ghi rõ chấp nhận mode A hay B, trên đúng máy và version. Nếu chọn B, phải chứng minh service vẫn chạy khi laptop không còn hoạt động; không suy ra điều đó từ một lần chạy local.

## Mẫu trả lời

```text
Phase 4:
P4-O1: Mode A/B; máy [tên/OS]; đã có máy [Có/Chưa]; budget mua/thuê [0 hoặc giới hạn].
P4-O2: Quyền truy cập [account role, read/write paths, quyền cài/service]; preflight [kết quả].
P4-O3: Model/runtime [giữ hiện có/ủy quyền chọn]; giới hạn RAM/disk/download/chi phí [số]; tiêu chí latency/quality [mô tả].
P4-O4: Các luồng offline [danh sách]; thời lượng [phút]; cold start/restart [Có/Không]; máy và cách ngắt mạng [mô tả].
P4-O5: Backup [destination]; dữ liệu [danh sách]; mã hóa/key [cách quản lý, không đưa key]; lịch/retention/RPO/RTO [giá trị]; restore target [path/máy test].
P4-O6: Access [local/private network/Internet]; users [danh sách]; quyền deploy [phạm vi]; lịch bảo trì [thời gian]; người vận hành [tên].
P4-O7: Tôi hỗ trợ các bước trực tiếp cần thiết sau khi agent giao đủ bộ test và phương án khôi phục truy cập.
P4-O8: Tôi nghiệm thu đúng mode/máy/version sau khi có bằng chứng offline và restore.
```
