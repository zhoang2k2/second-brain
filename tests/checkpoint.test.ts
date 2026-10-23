import { describe, expect, it } from "vitest";

import { createCheckpointer } from "../lib/checkpoint";

const setup = () => {
  let time = 0;
  const saved: string[] = [];
  const checkpointer = createCheckpointer(
    async (content) => {
      saved.push(content);
    },
    1000,
    () => time,
  );
  return {
    saved,
    checkpointer,
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe("streaming checkpoint", () => {
  it("saves partial content once the interval has elapsed", async () => {
    const { saved, checkpointer, advance } = setup();

    advance(1000);
    checkpointer.update("Xin chào");
    await checkpointer.flush();

    expect(saved).toEqual(["Xin chào"]);
  });

  it("does not save every chunk within one interval", async () => {
    const { saved, checkpointer, advance } = setup();

    advance(1000);
    checkpointer.update("a");
    advance(300);
    checkpointer.update("ab");
    advance(300);
    checkpointer.update("abc");
    await checkpointer.flush();

    expect(saved).toEqual(["a"]);
  });

  it("saves again after the next interval with the latest content", async () => {
    const { saved, checkpointer, advance } = setup();

    advance(1000);
    checkpointer.update("a");
    await checkpointer.flush();
    advance(1000);
    checkpointer.update("abc");
    await checkpointer.flush();

    expect(saved).toEqual(["a", "abc"]);
  });

  it("keeps streaming when a checkpoint write fails", async () => {
    let time = 1000;
    const checkpointer = createCheckpointer(
      async () => {
        throw new Error("disk full");
      },
      1000,
      () => time,
    );

    checkpointer.update("a");
    await expect(checkpointer.flush()).resolves.toBeUndefined();
    time += 1000;
    expect(() => checkpointer.update("ab")).not.toThrow();
  });
});
