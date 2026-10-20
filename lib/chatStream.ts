import type { ChatStreamEvent, Conversation } from "./chatTypes";

export const applyChatEvent = (
  conversation: Conversation,
  event: ChatStreamEvent,
): Conversation => {
  if (event.type === "error") return conversation;

  if (event.type === "delta") {
    return {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === event.messageId
          ? { ...message, content: message.content + event.content }
          : message,
      ),
    };
  }

  const exists = conversation.messages.some(
    (message) => message.id === event.message.id,
  );
  const messages = exists
    ? conversation.messages.map((message) =>
        message.id === event.message.id ? event.message : message,
      )
    : [...conversation.messages, event.message];

  return { ...conversation, messages };
};

export const readChatStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const applyLine = (line: string): boolean => {
    if (!line.trim()) return false;
    const event = JSON.parse(line) as ChatStreamEvent;
    if (event.type === "error") throw new Error(event.message);
    onEvent(event);
    return event.type === "done";
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!applyLine(line)) continue;
        await reader.cancel();
        return;
      }

      if (!done) continue;
      if (applyLine(buffer)) return;
      throw new Error("Kết nối bị đóng trước khi câu trả lời hoàn tất.");
    }
  } finally {
    reader.releaseLock();
  }
};
