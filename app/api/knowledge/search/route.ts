import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge";

export const GET = async (request: Request) => {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 500)
    return NextResponse.json(
      { error: "Search query is too long." },
      { status: 400 },
    );
  return NextResponse.json(await searchKnowledge(query));
};
