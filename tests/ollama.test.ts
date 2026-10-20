import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "../lib/chatTypes";
import { getOllamaBaseUrl, streamOllamaChat } from "../lib/ollama";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe("local Ollama adapter", () => {
  it("rejects non-local provider URLs", () => {
    expect(() => getOllamaBaseUrl("https://example.com")).toThrow(
      "local Ollama",
    );
  });

  it("streams content from the explicitly selected local model", async () => {
    const history: ChatMessage[] = Array.from({ length: 22 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 ? "assistant" : "user",
      content: `history-${index}`,
      createdAt: "2026-10-20T00:00:00.000Z",
      status: "complete",
      sources: [],
    }));
    const server = createServer((request, response) => {
      expect(request.url).toBe("/api/chat");
      let body = "";
      request.on("data", (chunk: Buffer) => (body += chunk.toString()));
      request.on("end", () => {
        const payload = JSON.parse(body);
        expect(payload.model).toBe("qwen3.5:latest");
        expect(payload.stream).toBe(true);
        expect(payload.messages).toHaveLength(22);
        expect(payload.messages[1]).toEqual({
          role: "user",
          content: "history-2",
        });
        expect(payload.messages.at(-1)).toEqual({
          role: "user",
          content: "hello",
        });
        expect(payload).not.toHaveProperty("options");
        response.writeHead(200, { "content-type": "application/x-ndjson" });
        response.end(
          '{"message":{"content":"hello"},"done":false}\n{"message":{"content":" world"},"done":true}\n',
        );
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a local TCP address");

    const chunks = [];
    for await (const chunk of streamOllamaChat(
      "hello",
      history,
      new AbortController().signal,
      `http://127.0.0.1:${address.port}`,
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["hello", " world"]);
  });

  it("finishes when Ollama sends done even if the transport stays open", async () => {
    const server = createServer((request, response) => {
      request.resume();
      response.writeHead(200, { "content-type": "application/x-ndjson" });
      response.write('{"message":{"content":"Complete"},"done":true}\n');
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected TCP address");

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const consume = async () => {
      const chunks = [];
      for await (const chunk of streamOllamaChat(
        "hello",
        [],
        new AbortController().signal,
        `http://127.0.0.1:${address.port}`,
      ))
        chunks.push(chunk);
      return chunks;
    };

    try {
      const result = await Promise.race([
        consume(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Still waiting after done")),
            500,
          );
        }),
      ]);
      expect(result).toEqual(["Complete"]);
    } finally {
      clearTimeout(timeout);
    }
  });
});
