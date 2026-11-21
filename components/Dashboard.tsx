"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnswerKey, CaseRecord } from "@/lib/types";
import { addDays, CLASS_LABEL, thaiDate, URGENCY_LABEL } from "@/lib/flu/rules";
import { detectClusters, epiCurve, type Cluster } from "@/lib/surveillance";
import { describe, FIELD_LABEL } from "@/lib/labels";
import { CASE_DEFINITION } from "@/lib/flu/knowledge";
import ShareQR from "./ShareQR";

const URG_STYLE: Record<string, string> = {
  emergency: "bg-red-soft text-red",
  urgent: "bg-amber-soft text-amber",
  soon: "bg-amber-soft text-amber",
  selfcare: "bg-brand-soft text-brand",
  recovered: "bg-green-soft text-green",
};

export default function Dashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [today, setToday] = useState("");
  const [ai, setAi] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [sel, setSel] = useState<CaseRecord | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [report, setReport] = useState<{ title: string; md: string; mode: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [readOnly, setReadOnly] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/cases", { cache: "no-store" });
    const d = (await r.json()) as { cases: CaseRecord[]; today: string; ai: boolean; provider: string | null; readOnly: boolean };
    setCases(d.cases);
    setToday(d.today);
    setAi(d.ai);
    setProvider(d.provider);
    setReadOnly(d.readOnly);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live: new citizen reports show up within seconds
    return () => clearInterval(t);
  }, [load]);

  const clusters = useMemo(() => detectClusters(cases), [cases]);
  const shown = useMemo(() => {
    if (filter === "all") return cases;
    const cl = clusters.find((c) => c.key === filter);
    return cl ? cl.cases : cases;
  }, [filter, cases, clusters]);
  const curve = useMemo(() => (today ? epiCurve(shown, addDays(today, -20), today) : []), [shown, today]);

  const counted = cases.filter((c) => c.assessment.classification !== "not_case" && c.review !== "dismissed");
  const alerts = cases.flatMap((c) => c.assessment.alerts.filter((a) => a.level === "red").map((a) => ({ ...a, c })));
  const pending = cases.filter((c) => c.review === "pending").length;

  async function review(id: string, review: CaseRecord["review"]) {
    if (readOnly) return;
    await fetch("/api/cases", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, review }) });
    await load();
    setSel((s) => (s && s.id === id ? { ...s, review } : s));
  }

  async function draft(cl: Cluster) {
    setLoadingReport(cl.key);
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clusterKey: cl.key }) });
      const d = (await r.json()) as { markdown: string; mode: string };
      setReport({ title: cl.place, md: d.markdown, mode: d.mode });
    } finally {
      setLoadingReport(null);
    }
  }

  async function reset() {
    if (readOnly) return;
    if (!confirm("รีเซ็ตข้อมูลเป็นชุดสาธิตใหม่? ข้อมูลที่ประชาชนส่งเข้ามาจะถูกลบ")) return;
    await fetch("/api/cases", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) });
    load();
  }

  function exportCsv() {
    const cols: AnswerKey[] = ["age", "sex", "province", "district", "onsetDate", "symptoms", "status", "redFlags", "chronic", "placeName", "sickContact", "poultry", "vaccinated", "test"];
    const head = ["id", "reported", ...cols, "classification", "urgency", "review"];
    const rows = shown.map((c) => [
      c.id,
      c.createdAt.slice(0, 10),
      ...cols.map((k) => (k === "onsetDate" ? (c.answers.onsetDate ?? "") : describe(k, c.answers[k] as never))),
      CLASS_LABEL[c.assessment.classification],
      URGENCY_LABEL[c.assessment.urgency],
      c.review ?? "",
    ]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `pud-dai-linelist-${today}.csv`;
    a.click();
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">
            พด
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight">ศูนย์เฝ้าระวัง · ไข้หวัดใหญ่</div>
            <div className="text-xs text-muted">
              ข้อมูล ณ {thaiDate(today)} · อัปเดตอัตโนมัติทุก 5 วินาที · ตัวสกัดข้อมูล: {ai ? `AI ${provider} + คำค้น` : "คำค้น (ยังไม่ได้ตั้ง API key)"}{readOnly ? " · โหมดสาธิต อ่านอย่างเดียว" : ""}
            </div>
          </div>
          <button onClick={() => setShowQR(true)} className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white">
            QR สำหรับประชาชน
          </button>
          <button onClick={exportCsv} className="rounded-full border border-line px-3 py-1.5 text-sm">
            ส่งออก CSV
          </button>
          {!readOnly && <button onClick={reset} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted">
            รีเซ็ตข้อมูลสาธิต
          </button>}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {readOnly && <div className="rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-ink-2">โหมดสาธิต: แสดงข้อมูลสมมติเท่านั้น รายงานจากผู้ใช้จะไม่ถูกบันทึก และไม่สามารถแก้ไขสถานะเคสได้</div>}
        {/* Alerts */}
        {(clusters.some((c) => c.meetsOutbreak) || alerts.length > 0) && (
          <section className="space-y-2">
            {clusters
              .filter((c) => c.meetsOutbreak)
              .map((c) => (
                <div key={c.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-red/30 bg-red-soft px-4 py-3">
                  <span className="rounded-full bg-red px-2 py-0.5 text-xs font-bold text-white">เข้าเกณฑ์สอบสวนการระบาด</span>
                  <span className="text-sm">
                    <b>{c.place}</b> พบผู้ป่วย {c.maxIn7Days} รายภายใน 7 วัน ({thaiDate(c.firstOnset)} – {thaiDate(c.lastOnset)})
                  </span>
                  <button
                    onClick={() => draft(c)}
                    disabled={loadingReport === c.key}
                    className="ml-auto rounded-full bg-red px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loadingReport === c.key ? "กำลังร่าง…" : "ร่างรายงานสอบสวน"}
                  </button>
                </div>
              ))}
            {alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => setSel(a.c)}
                className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-red/30 bg-surface px-4 py-2.5 text-left"
              >
                <span className="rounded-full bg-red-soft px-2 py-0.5 text-xs font-bold text-red">{a.code === "avian" ? "สงสัยไข้หวัดนก" : "อาการรุนแรง"}</span>
                <span className="text-sm">
                  {a.c.id} · {describe("age", a.c.answers.age)} · อ.{a.c.answers.district} — {a.text}
                </span>
              </button>
            ))}
          </section>
        )}

        {/* KPI tiles */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="รายงานทั้งหมด" value={cases.length} />
          <Stat label="เข้าเกณฑ์ผู้ป่วยสงสัยขึ้นไป" value={counted.length} />
          <Stat label="กลุ่มเสี่ยงที่ยังป่วย" value={counted.filter((c) => c.assessment.highRisk.length && c.assessment.urgency !== "recovered").length} />
          <Stat label="มีสัญญาณอันตราย" value={cases.filter((c) => c.assessment.urgency === "emergency").length} tone="red" />
          <Stat label="รอเจ้าหน้าที่ตรวจสอบ" value={pending} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {/* Epi curve */}
          <div className="rounded-2xl bg-surface p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="flex-1 font-semibold">ผู้ป่วยตามวันเริ่มป่วย (21 วันล่าสุด)</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                <option value="all">ทุกพื้นที่</option>
                {clusters.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.place}
                  </option>
                ))}
              </select>
            </div>
            <EpiCurve data={curve} />
            <p className="mt-2 text-xs text-muted">นับเฉพาะผู้ที่เข้าเกณฑ์ผู้ป่วยสงสัยขึ้นไป · {CASE_DEFINITION.incubation}</p>
          </div>

          {/* Clusters */}
          <div className="rounded-2xl bg-surface p-4 shadow-sm">
            <h2 className="mb-1 font-semibold">กลุ่มก้อนตามสถานที่</h2>
            <p className="mb-3 text-xs text-muted">เกณฑ์ 5.2: ผู้ป่วยสงสัย ≥ 5 รายใน 1 สัปดาห์ ในสถานที่เดียวกัน</p>
            <div className="space-y-2">
              {clusters.length === 0 && <div className="text-sm text-muted">ยังไม่พบ</div>}
              {clusters.map((c) => (
                <div key={c.key} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate font-medium">{c.place}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.meetsOutbreak ? "bg-red-soft text-red" : "bg-bg text-ink-2"}`}>
                      {c.maxIn7Days}/5
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-bg">
                    <div className={`h-1.5 rounded-full ${c.meetsOutbreak ? "bg-red" : "bg-amber"}`} style={{ width: `${Math.min(100, (c.maxIn7Days / 5) * 100)}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-muted">
                    อ.{c.district} จ.{c.province} · {c.cases.length} ราย · {thaiDate(c.firstOnset)}–{thaiDate(c.lastOnset)}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setFilter(c.key)} className="rounded-full border border-line px-2.5 py-1 text-xs">
                      ดูเฉพาะกลุ่มนี้
                    </button>
                    <button onClick={() => draft(c)} disabled={loadingReport === c.key} className="rounded-full border border-line px-2.5 py-1 text-xs">
                      {loadingReport === c.key ? "กำลังร่าง…" : "ร่างรายงาน"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Line list */}
        <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3">
            <h2 className="flex-1 font-semibold">Line list {filter !== "all" && <span className="text-sm font-normal text-muted">· กรองตามสถานที่</span>}</h2>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-sm text-brand">
                แสดงทั้งหมด
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-bg text-left text-xs text-ink-2">
                <tr>
                  {["รหัส", "รับรายงาน", "อายุ/เพศ", "พื้นที่", "เริ่มป่วย", "อาการ", "สถานที่", "ประเภทผู้ป่วย", "ความเร่งด่วน", "ตรวจสอบ"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} onClick={() => setSel(c)} className={`cursor-pointer border-t border-line hover:bg-bg ${c.review === "dismissed" ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.id}
                      {!c.demo && <span className="ml-1 rounded bg-blue-soft px-1 text-[10px] text-blue">ใหม่</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-2">{thaiDate(c.createdAt.slice(0, 10))}</td>
                    <td className="px-3 py-2">
                      {c.answers.age ?? "-"} {c.answers.sex === "M" ? "ช" : c.answers.sex === "F" ? "ญ" : ""}
                    </td>
                    <td className="px-3 py-2">{c.answers.district ?? "-"}</td>
                    <td className="px-3 py-2">{thaiDate(c.answers.onsetDate)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2" title={describe("symptoms", c.answers.symptoms)}>
                      {describe("symptoms", c.answers.symptoms)}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2">{c.answers.placeName ?? "-"}</td>
                    <td className="px-3 py-2">{CLASS_LABEL[c.assessment.classification]}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URG_STYLE[c.assessment.urgency]}`}>{URGENCY_LABEL[c.assessment.urgency]}</span>
                      {c.assessment.alerts.some((a) => a.level === "red") && <span className="ml-1 text-red">●</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{c.review === "verified" ? "ยืนยันแล้ว" : c.review === "dismissed" ? "ตัดออก" : "รอตรวจ"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {sel && <CaseDrawer c={cases.find((x) => x.id === sel.id) ?? sel} onClose={() => setSel(null)} onReview={review} readOnly={readOnly} />}
      {report && <ReportModal r={report} onClose={() => setReport(null)} />}
      {showQR && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={() => setShowQR(false)}>
          <div className="rise rounded-3xl bg-surface p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-2xl font-bold">สแกนเพื่อประเมินอาการ</div>
            <p className="mb-5 text-ink-2">{readOnly ? "แดชบอร์ดนี้แสดงข้อมูลสมมติสำหรับสาธิต" : "แล้วดูเคสของคุณขึ้นบนจอนี้ภายใน 5 วินาที"}</p>
            <ShareQR size={300} />
            <button onClick={() => setShowQR(false)} className="mt-5 block w-full rounded-xl border border-line py-2.5">
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tone === "red" && value > 0 ? "text-red" : ""}`}>{value}</div>
    </div>
  );
}

function EpiCurve({ data }: { data: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 28, r: 8, t: 12, b: 28 };
  const max = Math.max(4, ...data.map((d) => d.count));
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  const bw = data.length ? (W - pad.l - pad.r) / data.length : 0;
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Epidemic curve">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + 1;
          const w = Math.max(1, bw - 2);
          const h = H - pad.b - y(d.count);
          const r = Math.min(4, w / 2, h);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill={hover === i ? "var(--bg)" : "transparent"} />
              {d.count > 0 && (
                <path
                  d={`M${x},${H - pad.b} V${y(d.count) + r} Q${x},${y(d.count)} ${x + r},${y(d.count)} H${x + w - r} Q${x + w},${y(d.count)} ${x + w},${y(d.count) + r} V${H - pad.b} Z`}
                  fill="var(--brand)"
                />
              )}
              {i % 3 === 0 || i === data.length - 1 ? (
                <text x={pad.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {thaiDate(d.date).split(" ").slice(0, 2).join(" ")}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--ink-2)" strokeWidth={1} />
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow"
          style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          {thaiDate(data[hover].date)} · <b>{data[hover].count}</b> ราย
        </div>
      )}
    </div>
  );
}

function CaseDrawer({ c, onClose, onReview, readOnly }: { c: CaseRecord; onClose: () => void; onReview: (id: string, r: CaseRecord["review"]) => void; readOnly: boolean }) {
  const keys = (Object.keys(FIELD_LABEL) as AnswerKey[]).filter((k) => c.answers[k] !== undefined && k !== "consent");
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="rise h-full w-full max-w-lg overflow-y-auto bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <div className="flex-1">
            <div className="font-semibold">
              {c.id} · {CLASS_LABEL[c.assessment.classification]}
            </div>
            <div className="text-xs text-muted">รับรายงาน {new Date(c.createdAt).toLocaleString("th-TH")}</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm">
            ปิด
          </button>
        </div>
        <div className="space-y-4 p-4">
          {c.assessment.alerts.length > 0 && (
            <div className="space-y-1.5">
              {c.assessment.alerts.map((a) => (
                <div key={a.code} className={`rounded-lg px-3 py-2 text-sm ${a.level === "red" ? "bg-red-soft text-red" : "bg-amber-soft text-amber"}`}>
                  {a.text}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-line p-3 text-sm">
            <div className="font-medium">เหตุผลตามนิยามโรค</div>
            <div className="mt-1 text-ink-2">{c.assessment.clinicalReason}</div>
            <div className="mt-1 text-xs text-muted">{CASE_DEFINITION.clinical}</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">ข้อมูลรายช่อง และหลักฐานต้นทาง</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {keys.map((k) => {
                const ev = c.evidence[k];
                return (
                  <div key={k} className="px-3 py-2 text-sm">
                    <div className="flex gap-2">
                      <span className="w-36 shrink-0 text-ink-2">{FIELD_LABEL[k]}</span>
                      <span className="flex-1">{k === "phone" && c.answers.phone ? "••• (ปิดบัง)" : describe(k, c.answers[k] as never)}</span>
                    </div>
                    {ev && (
                      <div className="mt-0.5 pl-[9.5rem] text-xs text-muted">
                        <span className="mr-1 rounded bg-bg px-1">{ev.via === "ai" ? "AI ดึงจากข้อความ" : ev.via === "text" ? "ข้อความ" : "เลือกเอง"}</span>“
                        {k === "phone" ? "•••" : ev.quote}”
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {c.transcript.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">บทสนทนา</div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl bg-bg p-3 text-xs">
                {c.transcript.map((t, i) => (
                  <div key={i} className={t.role === "user" ? "text-ink" : "text-muted"}>
                    <b>{t.role === "user" ? "ประชาชน" : "พูดได้"}:</b> {t.text}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!readOnly && <div className="flex gap-2">
            <button onClick={() => onReview(c.id, "verified")} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white">
              ยืนยันเคส
            </button>
            <button onClick={() => onReview(c.id, "dismissed")} className="flex-1 rounded-xl border border-line py-2.5 text-sm">
              ตัดออก (ข้อมูลซ้ำ/ไม่น่าเชื่อถือ)
            </button>
          </div>}
        </div>
      </aside>
    </div>
  );
}

function ReportModal({ r, onClose }: { r: { title: string; md: string; mode: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="rise max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <div className="flex-1 font-semibold">ร่างรายงาน · {r.title}</div>
          <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">{r.mode === "ai" ? "ร่างโดย AI จากข้อเท็จจริงในระบบ" : "แม่แบบ"}</span>
          <button onClick={() => navigator.clipboard.writeText(r.md)} className="rounded-full border border-line px-3 py-1 text-sm">
            คัดลอก
          </button>
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm">
            ปิด
          </button>
        </div>
        <div className="p-5">
          <Markdown md={r.md} />
          <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">ร่างเพื่อให้เจ้าหน้าที่ตรวจแก้ก่อนส่งทุกครั้ง</p>
        </div>
      </div>
    </div>
  );
}

function Markdown({ md }: { md: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {md.split("\n").map((line, i) => {
        if (/^#{1,2} /.test(line)) return <h3 key={i} className="pt-2 text-lg font-bold">{inline(line.replace(/^#+ /, ""))}</h3>;
        if (/^#{3,} /.test(line)) return <h4 key={i} className="pt-2 font-semibold">{inline(line.replace(/^#+ /, ""))}</h4>;
        if (/^\s*[-*] /.test(line)) return <div key={i} className="pl-4 -indent-3">• {inline(line.replace(/^\s*[-*] /, ""))}</div>;
        if (/^\s*\d+\. /.test(line)) return <div key={i} className="pl-4">{inline(line.trim())}</div>;
        if (/^> /.test(line)) return <div key={i} className="border-l-2 border-line pl-3 text-muted">{inline(line.slice(2))}</div>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
