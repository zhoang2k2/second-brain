import { NextResponse } from "next/server";
import { getCitedSources } from "@/lib/citations";
import { searchKnowledge } from "@/lib/knowledge";
import { getOllamaBaseUrl, streamOllamaChat } from "@/lib/ollama";
import { store } from "@/lib/store";

type ChatRequest = { conversationId?: string; message?: string };

const encodeEvent = (event: Record<string, unknown>): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(event)}\n`);

export const POST = async (request: Request) => {
  let input: ChatRequest;
  try {
    input = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const message = input.message?.trim();
  if (!input.conversationId || !message || message.length > 20_000) {
    return NextResponse.json(
      {
        error:
          "Conversation ID and a message of at most 20,000 characters are required.",
      },
      { status: 400 },
    );
  }

  let conversation;
  try {
    conversation = await store.getConversation(input.conversationId);
    if (!conversation)
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    getOllamaBaseUrl();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chat configuration is invalid.",
      },
      { status: 400 },
    );
  }

  let knowledge;
  try {
    knowledge = await searchKnowledge(message);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Knowledge search failed.",
      },
      { status: 500 },
    );
  }

  await store.addMessage(conversation.id, "user", message);
  const assistant = await store.addMessage(
    conversation.id,
    "assistant",
    "",
    "streaming",
  );
  const history = conversation.messages.filter(
    (item) => item.status === "complete",
  );
  const responseController = new AbortController();
  request.signal.addEventListener("abort", () => responseController.abort(), {
    once: true,
  });

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let content = "";
      const run = async () => {
        try {
          for await (const chunk of streamOllamaChat(
            message,
            history,
            responseController.signal,
            getOllamaBaseUrl(),
            knowledge,
          )) {
            content += chunk;
            controller.enqueue(encodeEvent({ type: "delta", content: chunk }));
          }
          const sources = getCitedSources(content, knowledge);
          await store.updateMessage(
            conversation.id,
            assistant.id,
            content,
            "complete",
            sources,
          );
          controller.enqueue(encodeEvent({ type: "done", sources }));
          controller.close();
        } catch (error) {
          const interrupted = responseController.signal.aborted;
          await store.updateMessage(
            conversation.id,
            assistant.id,
            content,
            interrupted ? "interrupted" : "error",
          );
          if (interrupted) return;
          controller.enqueue(
            encodeEvent({
              type: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Local model request failed.",
            }),
          );
          controller.close();
        }
      };
      void run();
    },
    cancel() {
      responseController.abort();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
};
