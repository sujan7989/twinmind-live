import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, suggestionType, suggestionPreview, prompt, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const filledPrompt = prompt
      .replace("{transcript}", transcript)
      .replace("{suggestionType}", suggestionType)
      .replace("{suggestionPreview}", suggestionPreview);

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: filledPrompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 1024,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (error: unknown) {
    console.error("Detail error:", error);
    const message = error instanceof Error ? error.message : "Failed to get detail";
    const status = (error as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
