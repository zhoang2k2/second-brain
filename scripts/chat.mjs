import { createInterface } from "node:readline";

const baseUrl = process.env.SECOND_BRAIN_URL ?? "http://127.0.0.1:3000";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const parsedBaseUrl = new URL(baseUrl);
if (
  parsedBaseUrl.protocol !== "http:" ||
  !localHosts.has(parsedBaseUrl.hostname)
) {
  throw new Error("SECOND_BRAIN_URL phải trỏ tới server Second Brain local.");
}

const request = async (path, options) => {
  const response = await fetch(new URL(path, parsedBaseUrl), options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Yêu cầu thất bại (${response.status}).`);
  }
  return response;
};

const existingId = process.argv[2];
const conversation = existingId
  ? await (
      await request(`/api/conversations/${encodeURIComponent(existingId)}`)
    ).json()
  : await (await request("/api/conversations", { method: "POST" })).json();

console.log(`Cuộc trò chuyện: ${conversation.id}`);
console.log(
  "Nhập tin nhắn. Ctrl+C để dừng câu trả lời đang chạy, gõ /exit để thoát.",
);

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
let activeController;
let lastInterruptAt = 0;
const handleInterrupt = () => {
  const interruptAt = Date.now();
  if (interruptAt - lastInterruptAt < 100) return;
  lastInterruptAt = interruptAt;

  if (activeController) {
    if (activeController.signal.aborted) return;
    activeController.abort();
    console.log("\nĐã dừng. Phần nội dung đã nhận được giữ lại.");
    return;
  }
  readline.close();
};
readline.on("SIGINT", handleInterrupt);
process.on("SIGINT", handleInterrupt);

try {
  for await (const line of readline) {
    const message = line.trim();
    if (!message) continue;
    if (message === "/exit") break;

    activeController = new AbortController();
    try {
      const response = await request("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, message }),
        signal: activeController.signal,
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const eventLine of lines) {
          if (!eventLine) continue;
          const event = JSON.parse(eventLine);
          if (event.type === "delta") process.stdout.write(event.content);
          if (event.type === "error")
            console.error(`\nLỗi model local: ${event.message}`);
          if (event.type === "done" && event.sources.length)
            console.log(`\nNguồn: ${event.sources.join(", ")}`);
        }
        if (done) break;
      }
      if (buffer) {
        const event = JSON.parse(buffer);
        if (event.type === "error")
          console.error(`\nLỗi model local: ${event.message}`);
      }
      console.log("\n");
    } catch (error) {
      if (error.name !== "AbortError") console.error(`\n${error.message}`);
    } finally {
      activeController = undefined;
    }
  }
} finally {
  readline.close();
}
