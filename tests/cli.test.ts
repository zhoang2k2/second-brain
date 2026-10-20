import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

describe("CLI chat", () => {
  it("cancels the active response on SIGINT without exiting the CLI", async () => {
    let responseClosed = false;
    server = createServer((request, response) => {
      if (request.url !== "/api/chat") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            id: "cli-test",
            title: "CLI test",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [],
          }),
        );
        return;
      }

      response.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
      });
      response.write(
        `${JSON.stringify({ type: "delta", messageId: "assistant", content: "Phần trả lời đã nhận" })}\n`,
      );
      response.on("close", () => {
        responseClosed = true;
      });
    });

    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No server port");

    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), "scripts/chat.mjs"), "cli-test"],
      {
        env: {
          ...process.env,
          SECOND_BRAIN_URL: `http://127.0.0.1:${address.port}`,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stdin.write("Kiểm tra dừng CLI\n");

    await expect.poll(() => output).toContain("Phần trả lời đã nhận");
    child.kill("SIGINT");
    await expect.poll(() => output).toContain("Đã dừng");
    await expect.poll(() => responseClosed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    child.kill("SIGINT");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(child.exitCode).toBeNull();
    child.stdin.end("/exit\n");

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    expect(exitCode).toBe(0);
    expect(responseClosed).toBe(true);
  }, 10_000);
});
