import type { KnowledgeResult } from "./knowledge";
import type { ChatMessage } from "./store";

export const OLLAMA_MODEL = "qwen3.5:latest";
const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const getOllamaBaseUrl = (
  value = process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL,
): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Set OLLAMA_BASE_URL to a local Ollama URL.");
  }

  if (
    url.protocol !== "http:" ||
    !LOCAL_HOSTS.has(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error("Only a local Ollama URL is allowed in this MVP.");
  }

  return url.toString().replace(/\/$/, "");
};

const createMessages = (
  prompt: string,
  history: ChatMessage[],
  knowledge: KnowledgeResult[],
) => {
  const systemMessage = knowledge.length
    ? `Answer using the provided saved notes when they are relevant. If a note does not contain the answer, say so. Cite sources using their exact paths in square brackets.\n\nSaved notes:\n${knowledge.map((item) => `[${item.path}] ${item.title}: ${item.snippet}`).join("\n")}`
    : "You are a helpful personal assistant. Do not claim to have read saved knowledge unless it is provided.";

  return [
    { role: "system", content: systemMessage },
    ...history
      .slice(-20)
      .map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: prompt },
  ];
};

export const streamOllamaChat = async function* (
  prompt: string,
  history: ChatMessage[],
  signal: AbortSignal,
  baseUrl = getOllamaBaseUrl(),
  knowledge: KnowledgeResult[] = [],
): AsyncGenerator<string> {
  const response = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      messages: createMessages(prompt, history, knowledge),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as {
          message?: { content?: string };
          error?: string;
        };
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.message?.content) yield chunk.message.content;
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const chunk = JSON.parse(buffer) as {
        message?: { content?: string };
        error?: string;
      };
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.message?.content) yield chunk.message.content;
    }
  } finally {
    reader.releaseLock();
  }
};
