import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getEmbeddingResponse, classifyWithEmbedding } from "@/lib/embedding-engine";
import { OUT_OF_SCOPE_INTENT } from "@/lib/intents";
import { RAG_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import type { ChatRequest, ChatResponse } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatRequest;
  const { message, type, history } = body;

  const start = Date.now();

  try {
    if (type === "nlu") {
      const response = await getEmbeddingResponse(message);
      return NextResponse.json({ ...response, latency: Date.now() - start });
    }

    if (type === "hybrid") {
      const result = await getHybridResponse(message);
      if (result instanceof Response) return result;
      return NextResponse.json({ ...result, latency: Date.now() - start });
    }

    // RAG: always stream via LLM — even for out-of-scope queries
    // The system prompt instructs the model to redirect politely and stay on topic
    if (type === "rag") {
      const classification = await classifyWithEmbedding(message);
      const intentName = classification.outOfScope ? null : (classification.intent?.name ?? null);
      return getRAGStreamingResponse(message, history, start, intentName);
    }
  } catch (err) {
    console.error(`[${type}] error:`, err);
    return NextResponse.json(
      { text: "An error occurred. Please try again.", error: true } as ChatResponse,
      { status: 500 }
    );
  }
}

// Simple intents → template response; complex intents → targeted RAG
const SIMPLE_INTENTS = new Set(["cpf_inquiry", "retirement_gap", "life_events"]);

async function getHybridResponse(message: string): Promise<ChatResponse | Response> {
  const result = await classifyWithEmbedding(message);

  if (result.outOfScope) {
    return {
      text: OUT_OF_SCOPE_INTENT.templateResponse.text,
      buttons: OUT_OF_SCOPE_INTENT.templateResponse.buttons,
      intent: OUT_OF_SCOPE_INTENT.name,
      outOfScope: true,
    };
  }

  const { intent, score } = result;

  // Simple intent → instant template (JSON)
  if (SIMPLE_INTENTS.has(intent.id)) {
    return {
      text: intent.templateResponse.text,
      intent: intent.name,
      confidence: Math.round(score * 100),
      buttons: intent.templateResponse.buttons,
    };
  }

  // Complex intent → streaming RAG
  return getHybridStreamingResponse(message, intent.name);
}

function getHybridStreamingResponse(message: string, intentName: string): Response {
  const systemPrompt = `${RAG_SYSTEM_PROMPT}

The user's question has been classified as relating to: ${intentName}. Focus your response on this topic.`;

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const encoder = new TextEncoder();
  const start = Date.now();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const payload = JSON.stringify({ type: "delta", text: event.delta.text, intent: intentName });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
        }
        const endPayload = JSON.stringify({ type: "end", latency: Date.now() - start });
        controller.enqueue(encoder.encode(`data: ${endPayload}\n\n`));
      } catch {
        const errPayload = JSON.stringify({ type: "error", text: "An error occurred." });
        controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function getRAGStreamingResponse(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  start: number,
  intentName: string | null
): Response {
  const messages = [
    ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const systemPrompt = intentName
    ? `${RAG_SYSTEM_PROMPT}\n\nThe user's question relates to: ${intentName}. Focus your response on this topic.`
    : RAG_SYSTEM_PROMPT;

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const payload = JSON.stringify({ type: "delta", text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
        }
        const endPayload = JSON.stringify({ type: "end", latency: Date.now() - start });
        controller.enqueue(encoder.encode(`data: ${endPayload}\n\n`));
      } catch (err) {
        const errPayload = JSON.stringify({ type: "error", text: "An error occurred." });
        controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
