import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ available: !PUBLIC_DEMO_MODE && Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(req: Request) {
  if (PUBLIC_DEMO_MODE) return NextResponse.json({ error: "voice_unavailable" }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; consent?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (body?.consent !== true || !text || text.length > 1200) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      instructions: "Speak in clear, gentle, natural Central Thai. Read exactly what is written. Do not add medical advice or change the meaning.",
      response_format: "mp3",
    });
    return new Response(await speech.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Never log user health text, API credentials, or provider error payloads.
    return NextResponse.json({ error: "voice_generation_failed" }, { status: 502 });
  }
}
