"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { applyChatEvent, readChatStream } from "@/lib/chatStream";
import type { Conversation } from "@/lib/chatTypes";

import { MessageContent } from "./MessageContent";

type SearchResult = { title: string; path: string; snippet: string };
type LessonConflict = { path: string; markdown: string };

const readError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
};

export const ChatWorkspace = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonTags, setLessonTags] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonConflict, setLessonConflict] = useState<LessonConflict | null>(
    null,
  );
  const [savedPath, setSavedPath] = useState("");
  const abortController = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    setConversations((await response.json()) as Conversation[]);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    const response = await fetch(`/api/conversations/${id}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readError(response));
    setActiveConversation((await response.json()) as Conversation);
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/conversations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as Conversation[];
      })
      .then((items) => {
        if (!cancelled) setConversations(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load conversations.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createConversation = async () => {
    const response = await fetch("/api/conversations", { method: "POST" });
    if (!response.ok) throw new Error(await readError(response));
    const conversation = (await response.json()) as Conversation;
    setActiveConversation(conversation);
    setError("");
    await refreshConversations();
  };

  const deleteConversation = async (id: string) => {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await readError(response));
    if (activeConversation?.id === id) setActiveConversation(null);
    await refreshConversations();
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setError("");
    setBusy(true);

    let conversation = activeConversation;
    let conversationIdForRefresh: string | undefined;
    try {
      if (!conversation) {
        const response = await fetch("/api/conversations", { method: "POST" });
        if (!response.ok) throw new Error(await readError(response));
        conversation = (await response.json()) as Conversation;
      }
      const conversationId = conversation.id;
      conversationIdForRefresh = conversationId;
      setActiveConversation({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: message,
            createdAt: new Date().toISOString(),
            status: "complete",
            sources: [],
          },
        ],
      });
      setDraft("");
      abortController.current = new AbortController();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
        signal: abortController.current.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(await readError(response));

      await readChatStream(response.body, (event) => {
        setActiveConversation((current) =>
          current?.id === conversationId
            ? applyChatEvent(current, event)
            : current,
        );
      });
      await refreshConversations();
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The local model request failed.",
        );
      }
      if (conversationIdForRefresh)
        await openConversation(conversationIdForRefresh).catch(() => undefined);
    } finally {
      abortController.current = null;
      setBusy(false);
    }
  };

  const searchNotes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch(
      `/api/knowledge/search?q=${encodeURIComponent(query)}`,
    );
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setResults((await response.json()) as SearchResult[]);
  };

  const saveLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedPath("");
    setLessonConflict(null);
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: lessonTitle,
        tags: lessonTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        content: lessonContent,
        sourceReference: activeConversation
          ? `conversation:${activeConversation.id}`
          : undefined,
      }),
    });
    if (!response.ok) {
      if (response.status === 409) {
        const conflict = (await response.json()) as {
          path?: string;
          markdown?: string;
          error?: string;
        };
        if (conflict.path && conflict.markdown) {
          setLessonConflict({
            path: conflict.path,
            markdown: conflict.markdown,
          });
          setError(
            "Đã có lesson cùng tên. Hãy xem nội dung hiện tại và phần bổ sung trước khi xác nhận.",
          );
          return;
        }
      }
      setError(await readError(response));
      return;
    }
    const result = (await response.json()) as { path: string };
    setSavedPath(result.path);
    setLessonOpen(false);
  };

  const appendLesson = async () => {
    if (!lessonConflict) return;
    const slug = lessonConflict.path.split("/").at(-1)?.replace(/\.md$/, "");
    const response = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, content: lessonContent }),
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    const result = (await response.json()) as { path: string };
    setSavedPath(result.path);
    setLessonConflict(null);
    setLessonOpen(false);
    setError("");
  };

  const conversationTitle =
    conversations.find(
      (conversation) => conversation.id === activeConversation?.id,
    )?.title ??
    activeConversation?.title ??
    "Không gian suy nghĩ của bạn";
  const messages = activeConversation?.messages ?? [];
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content);
  const conversationItems = conversations.map((conversation) => (
    <li className="ConversationList__item" key={conversation.id}>
      <button
        className="ConversationList__open"
        onClick={() => void openConversation(conversation.id)}
        type="button"
      >
        {conversation.title}
      </button>
      <button
        aria-label={`Xóa ${conversation.title}`}
        className="ConversationList__delete"
        disabled={busy && activeConversation?.id === conversation.id}
        onClick={() => void deleteConversation(conversation.id)}
        type="button"
      >
        Xóa
      </button>
    </li>
  ));
  const messageItems = messages.map((message) => (
    <article className={`Message Message--${message.role}`} key={message.id}>
      <p className="Message__role">
        {message.role === "user" ? "You" : "Second Brain"}
      </p>
      <MessageContent
        content={
          message.content || (message.status === "streaming" ? "Thinking…" : "")
        }
      />
      {message.status === "interrupted" ? (
        <p className="Message__status">
          Interrupted. The received text is saved.
        </p>
      ) : null}
      {message.status === "error" ? (
        <p className="Message__status">
          The local model could not finish this response.
        </p>
      ) : null}
      {message.sources.length > 0 ? (
        <p className="Message__sources">
          Sources: {message.sources.join(", ")}
        </p>
      ) : null}
    </article>
  ));
  const searchItems = results.map((result) => (
    <li className="SearchResults__item" key={result.path}>
      <strong>{result.title}</strong>
      <code>{result.path}</code>
      <p>{result.snippet}</p>
    </li>
  ));

  return (
    <main className="Workspace">
      <aside aria-label="Workspace navigation" className="Workspace__sidebar">
        <div className="Workspace__brand">
          <span className="Workspace__mark">SB</span>
          <div>
            <strong>Second Brain</strong>
            <small>Local workspace</small>
          </div>
        </div>
        <button
          className="Workspace__new"
          onClick={() => void createConversation()}
          type="button"
        >
          ＋ Cuộc trò chuyện mới
        </button>
        <section className="ConversationList">
          <h2 className="Workspace__section-title">Lịch sử</h2>
          <ul>
            {conversationItems.length ? (
              conversationItems
            ) : (
              <li className="Workspace__muted">
                Các cuộc trò chuyện sẽ xuất hiện ở đây.
              </li>
            )}
          </ul>
        </section>
        <form
          className="SearchForm"
          onSubmit={(event) => void searchNotes(event)}
        >
          <label className="Workspace__section-title" htmlFor="knowledge-query">
            Tìm trong knowledge
          </label>
          <div className="SearchForm__row">
            <input
              id="knowledge-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm lesson đã lưu"
              value={query}
            />
            <button type="submit">Tìm</button>
          </div>
          <ul className="SearchResults">{searchItems}</ul>
          {results.length === 0 && query ? (
            <p className="Workspace__muted">Chưa tìm thấy lesson phù hợp.</p>
          ) : null}
        </form>
        <p className="Workspace__privacy">
          Conversation và lesson được lưu trong checkout này.
        </p>
      </aside>

      <section aria-label="Chat workspace" className="ChatPanel">
        <header className="ChatPanel__header">
          <div>
            <span className="ChatPanel__eyebrow">AI CÁ NHÂN</span>
            <h1>{conversationTitle}</h1>
          </div>
          <span className="ModelStatus">
            <span className="ModelStatus__dot" />
            Local · qwen3.5
          </span>
        </header>

        <div aria-live="polite" className="MessageList">
          {messageItems.length ? (
            messageItems
          ) : (
            <div className="Welcome">
              <span className="Welcome__symbol">✳</span>
              <h2>Hôm nay bạn đang nghĩ về điều gì?</h2>
              <p>
                Đặt câu hỏi, khám phá một ý tưởng hoặc cùng AI phân tích điều
                bạn muốn ghi nhớ.
              </p>
              <div className="Welcome__hint">
                Tin nhắn được xử lý bằng model Ollama local.
              </div>
            </div>
          )}
        </div>

        {error ? (
          <p className="ChatPanel__error" role="alert">
            {error}
          </p>
        ) : null}
        {savedPath ? (
          <p className="ChatPanel__saved" role="status">
            Saved to <code>{savedPath}</code>. Open <code>knowledge/</code> as
            an Obsidian vault.
          </p>
        ) : null}
        {lastAssistantMessage && !lessonOpen ? (
          <button
            className="ChatPanel__save"
            onClick={() => {
              setLessonTitle(activeConversation?.title ?? "Lesson");
              setLessonContent(lastAssistantMessage.content);
              setLessonOpen(true);
            }}
            type="button"
          >
            Lưu câu trả lời thành lesson
          </button>
        ) : null}

        {lessonOpen ? (
          <form
            className="LessonEditor"
            onSubmit={(event) => void saveLesson(event)}
          >
            <div className="LessonEditor__heading">
              <div>
                <span className="ChatPanel__eyebrow">
                  KIỂM TRA TRƯỚC KHI LƯU
                </span>
                <h2>Lesson mới</h2>
              </div>
              <button onClick={() => setLessonOpen(false)} type="button">
                Hủy
              </button>
            </div>
            <label>
              Tiêu đề
              <input
                maxLength={120}
                onChange={(event) => setLessonTitle(event.target.value)}
                required
                value={lessonTitle}
              />
            </label>
            <label>
              Tags
              <input
                onChange={(event) => setLessonTags(event.target.value)}
                placeholder="javascript, async"
                value={lessonTags}
              />
            </label>
            <label>
              Nội dung Markdown
              <textarea
                onChange={(event) => setLessonContent(event.target.value)}
                required
                rows={5}
                value={lessonContent}
              />
            </label>
            <div className="LessonEditor__preview">
              <span>Xem trước</span>
              <MessageContent content={lessonContent} />
            </div>
            {lessonConflict ? (
              <section
                aria-label="Additive lesson proposal"
                className="LessonConflict"
              >
                <h3>Đề xuất bổ sung vào {lessonConflict.path}</h3>
                <p>Nội dung hiện có</p>
                <pre>{lessonConflict.markdown}</pre>
                <p>Phần sẽ được nối thêm sau khi bạn xác nhận</p>
                <div className="LessonConflict__addition">
                  <MessageContent content={lessonContent} />
                </div>
                <button onClick={() => void appendLesson()} type="button">
                  Xác nhận nối thêm vào lesson hiện có
                </button>
              </section>
            ) : null}
            <button className="Workspace__new" type="submit">
              Xác nhận và lưu lesson mới
            </button>
          </form>
        ) : null}

        <form
          className="Composer"
          onSubmit={(event) => void sendMessage(event)}
        >
          <label className="Composer__label" htmlFor="message-draft">
            Tin nhắn
          </label>
          <textarea
            id="message-draft"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Nhập câu hỏi… Shift + Enter để xuống dòng"
            rows={3}
            value={draft}
          />
          <div className="Composer__footer">
            <span>Inference local · Lưu lịch sử conversation</span>
            {busy ? (
              <button
                className="Composer__stop"
                onClick={() => abortController.current?.abort()}
                type="button"
              >
                Dừng phản hồi
              </button>
            ) : (
              <button
                className="Composer__send"
                disabled={!draft.trim()}
                type="submit"
              >
                Gửi <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
};
