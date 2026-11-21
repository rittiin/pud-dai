import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const dynamic = "force-dynamic";
type Dialect = "unknown" | "isan" | "north" | "south" | "other";
type Candidate = { term: string; meaning: string; dialect: Dialect; status: "pending_review"; createdAt: string };
const FILE = path.join(process.cwd(), "data", "dialect-candidates.json");

export async function POST(req: Request) {
  if (PUBLIC_DEMO_MODE) return NextResponse.json({ stored: false, readOnly: true }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Partial<Candidate> & { consent?: boolean } | null;
  const term = typeof body?.term === "string" ? body.term.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 60) : "";
  const meaning = typeof body?.meaning === "string" ? body.meaning.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 200) : "";
  const dialects: Dialect[] = ["unknown", "isan", "north", "south", "other"];
  if (body?.consent !== true || term.length < 1 || meaning.length < 1 || /(?:\+?\d[\d\s-]{7,}\d)/.test(term + meaning) || !dialects.includes(body.dialect as Dialect)) {
    return NextResponse.json({ stored: false }, { status: 400 });
  }
  const candidate: Candidate = { term, meaning, dialect: body.dialect as Dialect, status: "pending_review", createdAt: new Date().toISOString() };
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const current = await fs.readFile(FILE, "utf8").then((s) => JSON.parse(s) as Candidate[]).catch(() => []);
    await fs.writeFile(FILE, JSON.stringify([...current, candidate], null, 2));
  } catch {
    return NextResponse.json({ stored: false }, { status: 503 });
  }
  return NextResponse.json({ stored: true, status: "pending_review" });
}
