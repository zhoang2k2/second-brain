import { NextResponse } from "next/server";
import {
  appendToLesson,
  getLessonBySlug,
  saveLesson,
  type LessonInput,
} from "@/lib/knowledge";

export const POST = async (request: Request) => {
  let lesson: LessonInput;
  try {
    lesson = (await request.json()) as LessonInput;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveLesson(lesson);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lesson could not be saved.";
    if (message.startsWith("LESSON_EXISTS:")) {
      const existing = await getLessonBySlug(
        message.slice("LESSON_EXISTS:".length),
      );
      return NextResponse.json(
        { error: "A lesson with this title already exists.", ...existing },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
};

export const PATCH = async (request: Request) => {
  let input: { slug?: string; content?: string };
  try {
    input = (await request.json()) as { slug?: string; content?: string };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  if (!input.slug || !input.content?.trim()) {
    return NextResponse.json(
      { error: "A lesson key and additive content are required." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await appendToLesson(input.slug, input.content));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lesson could not be updated.";
    if (message === "LESSON_DUPLICATE_CONTENT") {
      return NextResponse.json(
        { error: "This content is already in the lesson." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
