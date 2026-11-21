import { NextResponse } from "next/server";
import { listCases } from "@/lib/store";
import { clusterFacts, detectClusters, templateReport } from "@/lib/surveillance";
import { aiEnabled, aiReport } from "@/lib/ai";
import { todayISO } from "@/lib/flu/rules";

export async function POST(req: Request) {
  const { clusterKey } = (await req.json()) as { clusterKey: string };
  const today = todayISO();
  const cl = detectClusters(await listCases()).find((c) => c.key === clusterKey);
  if (!cl) return NextResponse.json({ error: "not found" }, { status: 404 });
  const facts = clusterFacts(cl, today);
  if (aiEnabled() && cl.cases.length > 0 && cl.cases.every((c) => c.aiConsent === true)) {
    try {
      const md = await aiReport(facts);
      if (md) return NextResponse.json({ mode: "ai", markdown: md, facts });
    } catch (e) {
      console.error("aiReport failed", e);
    }
  }
  return NextResponse.json({ mode: "template", markdown: templateReport(cl, today), facts });
}
