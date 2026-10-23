import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "../lib/store";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const makeStore = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "second-brain-"));
  directories.push(directory);
  return createStore(path.join(directory, "history.json"));
};

describe("conversation store", () => {
  it("persists conversations so they can be resumed after a store restart", async () => {
    const store = await makeStore();
    const conversation = await store.createConversation();
    await store.addMessage(conversation.id, "user", "Explain promises");

    const reopenedStore = createStore(store.filePath);
    const resumed = await reopenedStore.getConversation(conversation.id);

    expect(resumed?.messages[0]?.content).toBe("Explain promises");
  });

  it("preserves interrupted partial assistant responses", async () => {
    const store = await makeStore();
    const conversation = await store.createConversation();
    const message = await store.addMessage(
      conversation.id,
      "assistant",
      "Partial answer",
      "interrupted",
    );

    expect(message.status).toBe("interrupted");
    expect(
      (await store.getConversation(conversation.id))?.messages[0]?.content,
    ).toBe("Partial answer");
  });

  it("marks a response left streaming by a process restart as interrupted", async () => {
    const store = await makeStore();
    const conversation = await store.createConversation();
    await store.addMessage(
      conversation.id,
      "assistant",
      "Saved partial",
      "streaming",
    );

    const resumedStore = createStore(store.filePath);
    const resumed = await resumedStore.getConversation(conversation.id);

    expect(resumed?.messages[0]?.status).toBe("interrupted");
  });

  it("deletes one conversation without affecting others", async () => {
    const store = await makeStore();
    const first = await store.createConversation();
    const second = await store.createConversation();
    await store.deleteConversation(first.id);

    expect(await store.getConversation(first.id)).toBeUndefined();
    expect(await store.getConversation(second.id)).toBeDefined();
  });
});
