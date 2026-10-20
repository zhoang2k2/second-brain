# Second Brain

Ứng dụng AI cá nhân local-first. Chat và history chạy trên máy của bạn; lesson được lưu thành Markdown trong `knowledge/` để có thể mở bằng Obsidian.

Việc BOSS cần chuẩn bị: [checklist từng phase, có hướng dẫn tiếng Việt và mẫu trả lời](doc/plans/owner-preparation/README.md).

## Yêu cầu

- Node.js `>=20.9.0`
- pnpm `10.24.0`
- Ollama đang chạy tại `http://127.0.0.1:11434`
- Model local `qwen3.5:latest` đã được cài. MVP không dùng model cloud và không tự fallback sang cloud.

## Cài đặt và chạy

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000). Nếu Ollama chạy ở local URL khác, đặt `OLLAMA_BASE_URL` trong `.env.local`; ứng dụng từ chối URL không phải loopback.

## Sử dụng CLI

Giữ web server đang chạy, sau đó mở terminal khác:

```bash
pnpm chat
```

CLI tạo conversation và gọi cùng `/api/chat` với Web. Dùng `Ctrl+C` để dừng response hiện tại và giữ lại phần text đã nhận; dùng `/exit` để thoát. Để mở lại conversation:

```bash
pnpm chat <conversation-id>
```

## History và knowledge

- History lưu cục bộ tại `data/second-brain.json`, giữ đến khi xóa conversation.
- Conversation có thể tiếp tục sau khi khởi động lại ứng dụng. Response còn `streaming` sau restart được đánh dấu `interrupted`.
- Xóa conversation không xóa lesson đã lưu.
- Lesson được preview, chỉnh sửa hoặc hủy trước khi ghi. Markdown được lưu trong `knowledge/` với title, tags, thời điểm tạo/cập nhật và source conversation.
- Tên lesson trùng bị từ chối; ứng dụng không ghi đè. Keyword search hiện tìm title/nội dung Markdown và trả source path cùng snippet.
- Chỉ đưa nội dung bạn chủ động nhập vào ứng dụng. Không nhập secret, credential hoặc dữ liệu công ty/khách hàng.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Ranh giới MVP

MVP hỗ trợ Web chat streaming, CLI chat, history local, dừng response, lesson preview/confirm, Markdown keyword search và trả source paths khi dùng context từ knowledge. Chưa có cloud provider, embeddings, vector search, automatic secret redaction, đồng bộ hoặc nhiều người dùng. Lưu history dùng JSON file và khóa ghi trong một process; không thiết kế cho nhiều server process ghi chung một thư mục data.

Mở **Manage vaults → Open folder as vault** trong Obsidian và chọn thư mục `knowledge/` của checkout đang chạy ứng dụng. Ví dụ, bản preview MVP dùng `.worktrees/feature-m2/knowledge/`, không phải `knowledge/` ở repo gốc. Lưu một lesson tạo file Markdown trong thư mục đó; ứng dụng không tự đăng ký vault vào Obsidian. Cấu hình cá nhân `.obsidian/` được bỏ qua bởi Git.

Chat tự cập nhật theo stream và hoàn tất ngay khi nhận event `done`; không cần reload trang. Request gửi Ollama gồm system instruction, tối đa 20 message history đã hoàn tất và input mới. Đây là giới hạn số message, chưa có token-budget hoặc context summarization. `temperature`, `num_ctx` và giới hạn output `num_predict` hiện chưa được ứng dụng truyền; Ollama dùng cấu hình mặc định/model tương ứng.

Chat MVP gửi `think: false` tới `qwen3.5:latest` để giảm thời gian chờ nội dung đầu tiên. Model này mặc định bật thinking, trong khi UI chỉ hiển thị phần answer. Tắt thinking giảm bước suy luận trước câu trả lời; các bài toán phức tạp có thể cần chế độ thinking riêng trong tương lai. Thời gian phản hồi vẫn phụ thuộc độ dài context, model load và tài nguyên máy.
