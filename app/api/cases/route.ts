import { NextResponse } from "next/server";
import { addCase, listCases, resetDemo, updateReview, updateTest } from "@/lib/store";
import { sanitize } from "@/lib/sanitize";
import { assess, todayISO } from "@/lib/flu/rules";
import { aiEnabled, aiProvider } from "@/lib/ai";
import type { Answers, CaseRecord, ChatTurn, Evidence } from "@/lib/types";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ cases: await listCases(), today: todayISO(), ai: aiEnabled(), provider: aiEnabled() ? aiProvider() : null, readOnly: PUBLIC_DEMO_MODE });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { answers: Record<string, unknown>; evidence: Evidence; transcript: ChatTurn[]; storeConsent?: boolean; aiConsent?: boolean };
  const answers = sanitize(body.answers ?? {}) as Answers;
  const assessment = assess(answers);
  if (answers.consent !== true || body.storeConsent !== true || PUBLIC_DEMO_MODE) return NextResponse.json({ assessment, stored: false, demo: PUBLIC_DEMO_MODE });
  const rec = await addCase({
    createdAt: new Date().toISOString(),
    answers,
    evidence: body.evidence ?? {},
    transcript: (body.transcript ?? []).slice(-80),
    assessment,
    aiConsent: body.aiConsent === true,
    review: "pending",
  });
  return NextResponse.json({ assessment, stored: true, id: rec.id });
}

export async function PATCH(req: Request) {
  if (PUBLIC_DEMO_MODE) return NextResponse.json({ ok: false, readOnly: true }, { status: 403 });
  const { id, review, reset, test } = (await req.json()) as { id?: string; review?: CaseRecord["review"]; reset?: boolean; test?: unknown };
  if (reset) {
    await resetDemo();
    return NextResponse.json({ ok: true });
  }
  if (id && test !== undefined) {
    const t = sanitize({ test }).test;
    if (!t) return NextResponse.json({ ok: false }, { status: 400 });
    const c = await updateTest(id, t);
    return NextResponse.json({ ok: !!c, case: c ? { assessment: c.assessment } : undefined }); // never echo personal data back
  }
  if (!id || !review) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, case: await updateReview(id, review) });
}
