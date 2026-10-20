export type MessageRole = "user" | "assistant";
export type MessageStatus = "complete" | "streaming" | "interrupted" | "error";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
  sources: string[];
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type ChatStreamEvent =
  | { type: "start"; message: ChatMessage }
  | { type: "delta"; messageId: string; content: string }
  | { type: "done"; message: ChatMessage; sources: string[] }
  | { type: "error"; message: string };
