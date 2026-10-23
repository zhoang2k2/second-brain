import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const GET = async () =>
  NextResponse.json(await store.listConversations());

export const POST = async () =>
  NextResponse.json(await store.createConversation(), { status: 201 });
