import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ChatMessage,
  Conversation,
  MessageRole,
  MessageStatus,
} from "./chatTypes";

export type {
  ChatMessage,
  Conversation,
  MessageRole,
  MessageStatus,
} from "./chatTypes";

type StoreData = { version: 1; conversations: Conversation[] };

const DEFAULT_TITLE = "Cuộc trò chuyện mới";
const DEFAULT_TITLES = new Set([DEFAULT_TITLE, "New conversation"]);

const createEmptyData = (): StoreData => ({ version: 1, conversations: [] });

export const createStore = (
  filePath = path.join(process.cwd(), "data", "second-brain.json"),
) => {
  let writeQueue = Promise.resolve();

  const read = async (): Promise<StoreData> => {
    try {
      const data = JSON.parse(
        await readFile(/*turbopackIgnore: true*/ filePath, "utf8"),
      ) as StoreData;
      if (data.version !== 1 || !Array.isArray(data.conversations)) {
        throw new Error("Dữ liệu lịch sử có định dạng không hỗ trợ.");
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return createEmptyData();
      throw error;
    }
  };

  const update = async <T>(mutate: (data: StoreData) => T): Promise<T> => {
    const operation = writeQueue.then(async () => {
      const data = await read();
      const result = mutate(data);
      await mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(data, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, filePath);
      return result;
    });
    writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  let initialization: Promise<void> | undefined;
  const ensureInitialized = (): Promise<void> => {
    initialization ??= update((data) => {
      for (const conversation of data.conversations) {
        for (const message of conversation.messages) {
          if (message.status === "streaming") message.status = "interrupted";
        }
      }
    });
    return initialization;
  };

  const getConversation = async (
    id: string,
  ): Promise<Conversation | undefined> => {
    await ensureInitialized();
    return (await read()).conversations.find(
      (conversation) => conversation.id === id,
    );
  };

  return {
    filePath,
    listConversations: async (): Promise<Conversation[]> => {
      await ensureInitialized();
      return (await read()).conversations.sort((first, second) =>
        second.updatedAt.localeCompare(first.updatedAt),
      );
    },
    getConversation,
    createConversation: async (): Promise<Conversation> => {
      await ensureInitialized();
      return update((data) => {
        const now = new Date().toISOString();
        const conversation = {
          id: randomUUID(),
          title: DEFAULT_TITLE,
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        data.conversations.push(conversation);
        return conversation;
      });
    },
    deleteConversation: async (id: string): Promise<boolean> => {
      await ensureInitialized();
      return update((data) => {
        const index = data.conversations.findIndex(
          (conversation) => conversation.id === id,
        );
        if (index < 0) return false;
        data.conversations.splice(index, 1);
        return true;
      });
    },
    addMessage: async (
      conversationId: string,
      role: MessageRole,
      content: string,
      status: MessageStatus = "complete",
      sources: string[] = [],
    ): Promise<ChatMessage> => {
      await ensureInitialized();
      return update((data) => {
        const conversation = data.conversations.find(
          (item) => item.id === conversationId,
        );
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
        const message: ChatMessage = {
          id: randomUUID(),
          role,
          content,
          createdAt: new Date().toISOString(),
          status,
          sources,
        };
        conversation.messages.push(message);
        if (role === "user" && DEFAULT_TITLES.has(conversation.title)) {
          conversation.title = content.trim().slice(0, 60) || DEFAULT_TITLE;
        }
        conversation.updatedAt = message.createdAt;
        return message;
      });
    },
    updateMessage: async (
      conversationId: string,
      messageId: string,
      content: string,
      status: MessageStatus,
      sources: string[] = [],
    ): Promise<void> => {
      await ensureInitialized();
      return update((data) => {
        const conversation = data.conversations.find(
          (item) => item.id === conversationId,
        );
        const message = conversation?.messages.find(
          (item) => item.id === messageId,
        );
        if (!conversation || !message) throw new Error("MESSAGE_NOT_FOUND");
        message.content = content;
        message.status = status;
        message.sources = sources;
        conversation.updatedAt = new Date().toISOString();
      });
    },
  };
};

export type ConversationStore = ReturnType<typeof createStore>;

declare global {
  var secondBrainStore: ConversationStore | undefined;
}

export const store = (globalThis.secondBrainStore ??= createStore());
