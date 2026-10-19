import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { getOllamaBaseUrl, streamOllamaChat } from "../lib/ollama";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
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
    const server = createServer((request, response) => {
      expect(request.url).toBe("/api/chat");
      let body = "";
      request.on("data", (chunk: Buffer) => (body += chunk.toString()));
      request.on("end", () => {
        expect(JSON.parse(body).model).toBe("qwen3.5:latest");
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
      [],
      new AbortController().signal,
      `http://127.0.0.1:${address.port}`,
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["hello", " world"]);
  });
});
