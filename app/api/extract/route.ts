import { NextResponse } from "next/server";
import { keywordExtract, postCheck } from "@/lib/extract";
import { aiEnabled, aiExtract } from "@/lib/ai";
import { sanitize } from "@/lib/sanitize";
import { todayISO } from "@/lib/flu/rules";
import type { Evidence } from "@/lib/types";

const perIpRequests = new Map<string, { startedAt: number; count: number }>();
/** Cap AI calls per IP (20/min) so a public demo cannot drain API credit. */
function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = perIpRequests.get(ip);
  if (recent && now - recent.startedAt < 60_000) {
    if (recent.count >= 20) return true;
    recent.count += 1;
  } else perIpRequests.set(ip, { startedAt: now, count: 1 });
  if (perIpRequests.size > 5000) for (const [k, v] of perIpRequests) if (now - v.startedAt >= 60_000) perIpRequests.delete(k);
  return false;
}

export async function POST(req: Request) {
  const { text, context, aiConsent } = (await req.json()) as { text: string; context?: string; aiConsent?: boolean };
  const today = todayISO();
  const safeText = typeof text === "string" ? text.slice(0, 2000) : "";
  const kw = keywordExtract(safeText, today);
  const finish = (mode: string, answers: ReturnType<typeof sanitize>, evidence: Evidence, dropped: string[]) => {
    const more = postCheck(safeText, answers, evidence);
    return NextResponse.json({ mode, answers, evidence, dropped: [...dropped, ...more] });
  };
  if (aiConsent !== true || !aiEnabled() || rateLimited(req)) return finish("keyword", sanitize(kw.answers), { ...kw.evidence }, []);
  try {
    const ai = await aiExtract(safeText, today, context);
    const answers = sanitize({ ...kw.answers, ...ai.answers });
    const evidence: Evidence = { ...kw.evidence, ...ai.evidence };
    return finish("ai", answers, evidence, ai.dropped);
  } catch (e) {
    // Never log health text or provider payloads.
    console.error("aiExtract failed, using keywords", e instanceof Error ? e.name : "unknown");
    return finish("keyword", sanitize(kw.answers), { ...kw.evidence }, []);
  }
}
