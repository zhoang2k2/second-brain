import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const GET = async (
  _request: Request,
  context: RouteContext<"/api/conversations/[id]">,
) => {
  const { id } = await context.params;
  const conversation = await store.getConversation(id);
  if (!conversation)
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  return NextResponse.json(conversation);
};

export const DELETE = async (
  _request: Request,
  context: RouteContext<"/api/conversations/[id]">,
) => {
  const { id } = await context.params;
  const deleted = await store.deleteConversation(id);
  if (!deleted)
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  return new Response(null, { status: 204 });
};
