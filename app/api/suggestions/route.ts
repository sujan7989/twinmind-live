import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

interface SuggestionResult {
  type: string;
  preview: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, previousSuggestions, prompt, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }
    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json(
        { error: "Not enough transcript content to generate suggestions" },
        { status: 422 }
      );
    }

    const groq = new Groq({ apiKey });

    const filledPrompt = prompt
      .replace("{transcript}", transcript)
      .replace("{previousSuggestions}", previousSuggestions || "(None)");

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are a precise AI assistant. Always respond with valid JSON only. No markdown, no explanation, just the JSON object.",
        },
        {
          role: "user",
          content: filledPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";

    let parsed: { suggestions?: SuggestionResult[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse suggestions JSON", raw: rawContent },
        { status: 500 }
      );
    }

    const suggestions = (parsed.suggestions ?? []).slice(0, 3);

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "No suggestions returned", raw: rawContent },
        { status: 500 }
      );
    }

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("Suggestions error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate suggestions";
    const status = (error as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
