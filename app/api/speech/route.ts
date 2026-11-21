import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const dynamic = "force-dynamic";

const publicVoiceAllowed = () => !PUBLIC_DEMO_MODE || process.env.ALLOW_PUBLIC_OPENAI_TTS === "1";
const canUseOpenAiVoice = () => publicVoiceAllowed() && Boolean(process.env.OPENAI_API_KEY);
const perIpRequests = new Map<string, { startedAt: number; count: number }>();

export async function GET() {
  const available = canUseOpenAiVoice();
  const reason = available ? "ready" : !publicVoiceAllowed() ? "public_voice_disabled" : "server_key_missing";
  return NextResponse.json({ available, reason }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!canUseOpenAiVoice()) return NextResponse.json({ error: "voice_unavailable" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; consent?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (body?.consent !== true || !text || text.length > 1200) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = perIpRequests.get(ip);
  if (recent && now - recent.startedAt < 60_000 && recent.count >= 30) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  if (!recent || now - recent.startedAt >= 60_000) perIpRequests.set(ip, { startedAt: now, count: 1 });
  else perIpRequests.set(ip, { ...recent, count: recent.count + 1 });
  if (perIpRequests.size > 5000) {
    for (const [key, value] of perIpRequests) if (now - value.startedAt >= 60_000) perIpRequests.delete(key);
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
