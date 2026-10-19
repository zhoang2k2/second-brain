import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendLessonUpdate,
  createAdditiveLessonMarkdown,
  createLessonMarkdown,
  createSlug,
  findLessonCollision,
  scoreKnowledgeDocument,
} from "../lib/knowledge";

describe("knowledge helpers", () => {
  it("creates stable URL-safe slugs from Vietnamese titles", () => {
    expect(createSlug("Promise và async/await")).toBe("promise-va-async-await");
  });

  it("writes validated frontmatter and escaped content", () => {
    const markdown = createLessonMarkdown({
      title: "Promise: basics",
      tags: ["javascript", "async"],
      content: "Line one\n---\nLine two",
      sourceReference: "conversation:123",
      createdAt: "2026-10-20T00:00:00.000Z",
    });

    expect(markdown).toContain('title: "Promise: basics"');
    expect(markdown).toContain('source: "conversation:123"');
    expect(markdown).toContain("Line two");
  });

  it("detects a slug collision without replacing the existing note", () => {
    expect(findLessonCollision("promise", ["knowledge/promise.md"])).toBe(
      "knowledge/promise.md",
    );
  });

  it("proposes additive content while preserving existing Markdown", () => {
    const existing = createLessonMarkdown({
      title: "Promises",
      tags: [],
      content: "Existing note",
      createdAt: "2026-10-19T00:00:00.000Z",
    });
    const updated = createAdditiveLessonMarkdown(
      existing,
      "New information",
      "2026-10-20T00:00:00.000Z",
    );

    expect(updated).toContain("Existing note");
    expect(updated).toContain("New information");
    expect(updated).toContain('updated: "2026-10-20T00:00:00.000Z"');
  });

  it("appends a reviewed update without replacing concurrent note content", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "second-brain-"));
    const filePath = path.join(directory, "lesson.md");
    await writeFile(filePath, "---\ntitle: Lesson\n---\n\nOriginal", "utf8");

    try {
      await Promise.all([
        appendLessonUpdate(filePath, "Update one"),
        appendLessonUpdate(filePath, "Update two"),
      ]);
      const result = await readFile(filePath, "utf8");
      expect(result).toContain("Original");
      expect(result).toContain("Update one");
      expect(result).toContain("Update two");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not return notes that match only common question words", () => {
    expect(
      scoreKnowledgeDocument(
        "In one short sentence, explain a Promise",
        "This is an unrelated note.",
      ),
    ).toBe(0);
  });

  it("matches meaningful knowledge keywords", () => {
    expect(
      scoreKnowledgeDocument(
        "What is a Promise?",
        "A Promise represents asynchronous work.",
      ),
    ).toBeGreaterThan(0);
  });
});
