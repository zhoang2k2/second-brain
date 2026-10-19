import { randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type LessonInput = {
  title: string;
  tags: string[];
  content: string;
  sourceReference?: string;
  createdAt?: string;
};

export type KnowledgeResult = {
  title: string;
  path: string;
  snippet: string;
  score: number;
};

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
  "one",
  "short",
  "sentence",
  "explain",
  "according",
  "please",
  "giai",
  "thich",
  "mot",
  "trong",
  "la",
  "cua",
  "toi",
  "ban",
]);

const KNOWLEDGE_DIRECTORY = path.join(process.cwd(), "knowledge");

export const createSlug = (title: string): string =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const findLessonCollision = (
  slug: string,
  paths: string[],
): string | undefined =>
  paths.find((filePath) => path.basename(filePath, ".md") === slug);

export const createLessonMarkdown = (lesson: LessonInput): string => {
  const title = lesson.title.trim();
  const content = lesson.content.trim();
  const tags = lesson.tags.map((tag) => tag.trim()).filter(Boolean);

  if (!title || !content || !createSlug(title)) {
    throw new Error("Lesson title and content are required.");
  }

  if (tags.some((tag) => tag.length > 40)) {
    throw new Error("Lesson tags must be 40 characters or fewer.");
  }

  const createdAt = lesson.createdAt ?? new Date().toISOString();
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `tags: ${JSON.stringify([...new Set(tags)])}`,
    `created: ${JSON.stringify(createdAt)}`,
    `updated: ${JSON.stringify(createdAt)}`,
    ...(lesson.sourceReference
      ? [`source: ${JSON.stringify(lesson.sourceReference)}`]
      : []),
    "---",
  ];

  return `${frontmatter.join("\n")}\n\n${content}\n`;
};

export const createAdditiveLessonMarkdown = (
  existingMarkdown: string,
  addition: string,
  updatedAt = new Date().toISOString(),
): string => {
  const content = addition.trim();
  if (!content) throw new Error("Lesson content is required.");
  const body = existingMarkdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  if (body.includes(content)) throw new Error("LESSON_DUPLICATE_CONTENT");
  const updatedFrontmatter = existingMarkdown.replace(
    /^updated:\s*.+$/m,
    `updated: ${JSON.stringify(updatedAt)}`,
  );
  return `${updatedFrontmatter.trim()}\n\n${body}\n\n${content}\n`;
};

const listMarkdownFiles = async (directory: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listMarkdownFiles(entryPath);
        if (entry.isFile() && entry.name.endsWith(".md")) return [entryPath];
        return [];
      }),
  );
  return nested.flat();
};

export const scoreKnowledgeDocument = (
  query: string,
  document: string,
): number => {
  const terms = new Set(
    (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
      (term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term),
    ),
  );
  const words = new Set(document.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return [...terms].reduce(
    (score, term) => score + (words.has(term) ? 1 : 0),
    0,
  );
};

export const saveLesson = async (
  lesson: LessonInput,
): Promise<{ path: string }> => {
  const markdown = createLessonMarkdown(lesson);
  const slug = createSlug(lesson.title);
  const files = await listMarkdownFiles(KNOWLEDGE_DIRECTORY);
  const collision = findLessonCollision(slug, files);
  if (collision) throw new Error(`LESSON_EXISTS:${slug}`);

  await mkdir(KNOWLEDGE_DIRECTORY, { recursive: true });
  const filePath = path.join(KNOWLEDGE_DIRECTORY, `${slug}.md`);
  await writeFile(filePath, markdown, { encoding: "utf8", flag: "wx" });
  return { path: path.relative(process.cwd(), filePath) };
};

export const appendToLesson = async (
  slug: string,
  content: string,
): Promise<{ path: string }> => {
  if (createSlug(slug) !== slug) throw new Error("Invalid lesson key.");
  const files = await listMarkdownFiles(KNOWLEDGE_DIRECTORY);
  const collision = findLessonCollision(slug, files);
  if (!collision) throw new Error("LESSON_NOT_FOUND");
  await appendLessonUpdate(collision, content);
  return { path: path.relative(process.cwd(), collision) };
};

export const appendLessonUpdate = async (
  filePath: string,
  content: string,
): Promise<void> => {
  const existingMarkdown = await readFile(filePath, "utf8");
  const addition = content.trim();
  if (!addition) throw new Error("Lesson content is required.");
  const body = existingMarkdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  if (body.includes(addition)) throw new Error("LESSON_DUPLICATE_CONTENT");
  const updatedAt = new Date().toISOString();
  await appendFile(filePath, `\n\n## Update (${updatedAt})\n\n${addition}\n`, {
    encoding: "utf8",
  });
};

export const getLessonBySlug = async (
  slug: string,
): Promise<{ path: string; markdown: string } | undefined> => {
  if (createSlug(slug) !== slug) return undefined;
  const files = await listMarkdownFiles(KNOWLEDGE_DIRECTORY);
  const filePath = findLessonCollision(slug, files);
  if (!filePath) return undefined;
  return {
    path: path.relative(process.cwd(), filePath),
    markdown: await readFile(filePath, "utf8"),
  };
};

const extractTitle = (markdown: string, fallback: string): string => {
  const match = markdown.match(/^title:\s*(.+)$/m);
  if (!match) return fallback;
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return match[1].replace(/^['"]|['"]$/g, "");
  }
};

export const searchKnowledge = async (
  query: string,
): Promise<KnowledgeResult[]> => {
  if (!query.trim()) return [];

  const files = await listMarkdownFiles(KNOWLEDGE_DIRECTORY);
  const results = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, "utf8");
      const body = markdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
      const score = scoreKnowledgeDocument(
        query,
        `${extractTitle(markdown, "")} ${body}`,
      );
      if (score === 0) return undefined;
      const normalizedBody = body
        .replace(/[#*_`>\[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        title: extractTitle(markdown, path.basename(filePath, ".md")),
        path: path.relative(process.cwd(), filePath),
        snippet: normalizedBody.slice(0, 240),
        score,
      } satisfies KnowledgeResult;
    }),
  );

  return results
    .filter((result): result is KnowledgeResult => result !== undefined)
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
};

export const createProposalId = (): string => randomUUID();
