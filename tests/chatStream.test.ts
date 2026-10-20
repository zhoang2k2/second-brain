import { describe, expect, it } from "vitest";

import { applyChatEvent, readChatStream } from "../lib/chatStream";
import type {
  ChatMessage,
  ChatStreamEvent,
  Conversation,
} from "../lib/chatTypes";

const assistant: ChatMessage = {
  id: "server-assistant",
  role: "assistant",
  content: "",
  createdAt: "2026-10-20T00:00:00.000Z",
  status: "streaming",
  sources: [],
};

const conversation: Conversation = {
  id: "conversation",
  title: "Conversation",
  createdAt: assistant.createdAt,
  updatedAt: assistant.createdAt,
  messages: [assistant],
};

describe("chat streaming state", () => {
  it("updates the persisted assistant after reopening an in-flight conversation", () => {
    const updated = applyChatEvent(conversation, {
      type: "delta",
      messageId: assistant.id,
      content: "Hello",
    });

    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].content).toBe("Hello");
    expect(conversation.messages[0].content).toBe("");
  });

  it("uses the final server message even when earlier deltas were missed", () => {
    const completed = {
      ...assistant,
      content: "Complete answer",
      status: "complete" as const,
    };
    const updated = applyChatEvent(conversation, {
      type: "done",
      message: completed,
      sources: [],
    });

    expect(updated.messages).toEqual([completed]);
  });

  it("finishes on the done event without waiting for HTTP EOF", async () => {
    const completed = {
      ...assistant,
      content: "Xin chào",
      status: "complete" as const,
    };
    const events: ChatStreamEvent[] = [];
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const bytes = new TextEncoder().encode(
          `${JSON.stringify({ type: "start", message: assistant })}\n${JSON.stringify({ type: "done", message: completed, sources: [] })}\n`,
        );
        controller.enqueue(bytes.slice(0, bytes.length - 8));
        controller.enqueue(bytes.slice(bytes.length - 8));
      },
      cancel() {
        cancelled = true;
      },
    });

    await readChatStream(stream, (event) => events.push(event));

    expect(events.map((event) => event.type)).toEqual(["start", "done"]);
    expect(cancelled).toBe(true);
  }, 1000);

  it("reports a broken stream instead of treating EOF as a complete answer", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    await expect(readChatStream(stream, () => undefined)).rejects.toThrow(
      "before the response completed",
    );
  });
});
