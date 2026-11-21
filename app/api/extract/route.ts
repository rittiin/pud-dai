import { NextResponse } from "next/server";
import { keywordExtract, postCheck } from "@/lib/extract";
import { aiEnabled, aiExtract } from "@/lib/ai";
import { sanitize } from "@/lib/sanitize";
import { todayISO } from "@/lib/flu/rules";
import type { Evidence } from "@/lib/types";

export async function POST(req: Request) {
  const { text, context } = (await req.json()) as { text: string; context?: string };
  const today = todayISO();
  const kw = keywordExtract(text ?? "", today);
  const finish = (mode: string, answers: ReturnType<typeof sanitize>, evidence: Evidence, dropped: string[]) => {
    const more = postCheck(text ?? "", answers, evidence);
    return NextResponse.json({ mode, answers, evidence, dropped: [...dropped, ...more] });
  };
  if (!aiEnabled()) return finish("keyword", sanitize(kw.answers), { ...kw.evidence }, []);
  try {
    const ai = await aiExtract(text, today, context);
    const answers = sanitize({ ...kw.answers, ...ai.answers });
    const evidence: Evidence = { ...kw.evidence, ...ai.evidence };
    return finish("ai", answers, evidence, ai.dropped);
  } catch (e) {
    console.error("aiExtract failed, using keywords", e);
    return finish("keyword", sanitize(kw.answers), { ...kw.evidence }, []);
  }
}
