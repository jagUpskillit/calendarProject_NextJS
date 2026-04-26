import { NextResponse } from "next/server";
import type { Session } from "@/types";
import { buildAssistantChatResult } from "@/lib/assistant/chatbot";
import { buildAssistantInsightReport, isInsightsIntent } from "@/lib/assistant/insights";

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

async function generateOpenAIReply(
  message: string,
  sessions: Session[],
  fallbackReply: string,
  insightContext?: ReturnType<typeof buildAssistantInsightReport>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackReply;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const contextSessions = sessions.slice(0, 20).map((session) => ({
    id: session.id,
    programName: session.programName,
    geo: session.geo ?? "Global",
    facilitator: session.facilitator ?? "TBD",
    dateISO: session.dateISO ?? "TBD",
    deliveryMode: session.deliveryMode,
    targetAudience: session.targetAudience ?? "N/A",
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 280,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant for a corporate training calendar app. Answer concisely and only based on provided context. If unsure, say you are not sure and suggest rephrasing.",
        },
        {
          role: "user",
          content: JSON.stringify({
            userQuestion: message,
            fallbackAnswer: fallbackReply,
            availableSessionCount: sessions.length,
            exampleSessions: contextSessions,
            insightContext,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || fallbackReply;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { message?: string; sessions?: Session[] };
    const message = typeof body.message === "string" ? body.message : "";
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];

    const result = buildAssistantChatResult(message, sessions);
    const insightContext = isInsightsIntent(message) ? buildAssistantInsightReport(sessions) : undefined;

    try {
      const aiReply = await generateOpenAIReply(message, sessions, result.reply, insightContext);
      return NextResponse.json({ ...result, reply: aiReply });
    } catch {
      return NextResponse.json(result);
    }
  } catch (error) {
    return NextResponse.json(
      {
        reply: `I couldn't process that request right now: ${error instanceof Error ? error.message : String(error)}`,
        matches: [],
        parsed: { keywords: [] },
      },
      { status: 500 }
    );
  }
}