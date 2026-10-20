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
      { error: "Nội dung yêu cầu phải là JSON hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveLesson(lesson);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không lưu được lesson.";
    if (message.startsWith("LESSON_EXISTS:")) {
      const existing = await getLessonBySlug(
        message.slice("LESSON_EXISTS:".length),
      );
      return NextResponse.json(
        { error: "Đã có lesson cùng tên.", ...existing },
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
      { error: "Nội dung yêu cầu phải là JSON hợp lệ." },
      { status: 400 },
    );
  }
  if (!input.slug || !input.content?.trim()) {
    return NextResponse.json(
      { error: "Cần khóa lesson và nội dung bổ sung." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await appendToLesson(input.slug, input.content));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không cập nhật được lesson.";
    if (message === "LESSON_DUPLICATE_CONTENT") {
      return NextResponse.json(
        { error: "Nội dung này đã có trong lesson." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
