"use client";

// "What next" actions after screening: nearby care via Google Maps, home test kits (pharmacy or Shopee/Lazada),
// and a loop back to surveillance — the person can report their test result, which updates their case.
import { useState } from "react";
import type { Answers, Assessment, TestResult } from "@/lib/types";
import { CLASS_LABEL } from "@/lib/flu/rules";

const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const KIT_QUERY = "ชุดตรวจไข้หวัดใหญ่ Influenza A B self test";
const shopee = `https://shopee.co.th/search?keyword=${encodeURIComponent(KIT_QUERY)}`;
const lazada = `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(KIT_QUERY)}`;

type Place = { label: string; q: string; icon: string; note: string };
const PHARMACY: Place = { label: "ร้านขายยาใกล้ฉัน", q: "ร้านขายยา", icon: "💊", note: "ปรึกษาเภสัชกร ซื้อยาลดไข้ ชุดตรวจ หน้ากาก" };
const CLINIC: Place = { label: "คลินิก / รพ.สต. ใกล้ฉัน", q: "คลินิก โรงพยาบาลส่งเสริมสุขภาพตำบล", icon: "🩺", note: "ตรวจอาการ ไม่ต้องรอคิวนาน" };
const HOSPITAL: Place = { label: "โรงพยาบาลใกล้ฉัน", q: "โรงพยาบาล", icon: "🏥", note: "ตรวจรักษา รับยาต้านไวรัสตามดุลยพินิจแพทย์" };
const VACCINE: Place = { label: "ที่ฉีดวัคซีนไข้หวัดใหญ่ใกล้ฉัน", q: "ฉีดวัคซีนไข้หวัดใหญ่ โรงพยาบาล รพ.สต.", icon: "💉", note: "กลุ่มเสี่ยงฉีดฟรีตามสิทธิ์" };

export default function CareFinder({
  assessment: a,
  answers,
  caseId,
  onUpdated,
}: {
  assessment: Assessment;
  answers: Answers;
  caseId?: string;
  onUpdated: (a: Assessment, test: TestResult) => void;
}) {
  const tested = answers.test && answers.test !== "none";
  const sickNow = a.urgency !== "recovered";

  // What to show depends on the situation — no shopping links in an emergency.
  const places: Place[] =
    a.urgency === "emergency"
      ? [HOSPITAL]
      : a.urgency === "urgent" || a.urgency === "soon"
        ? [HOSPITAL, CLINIC, PHARMACY]
        : a.urgency === "recovered"
          ? [VACCINE, PHARMACY]
          : [PHARMACY, CLINIC];
  const showKit = sickNow && a.urgency !== "emergency" && !tested && a.meetsClinical;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line">
        <div className="px-3 pt-3 text-[16px] font-semibold">{a.urgency === "emergency" ? "โรงพยาบาลที่ใกล้ที่สุด" : "สถานบริการใกล้บ้าน"}</div>
        <div className="space-y-2 p-3">
          {places.map((p) => (
            <a
              key={p.label}
              href={maps(p.q)}
              target="_blank"
              rel="noreferrer"
              className="press flex min-h-14 items-center gap-3 rounded-xl bg-bg px-3 py-2.5"
            >
              <span className="text-2xl" aria-hidden>
                {p.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{p.label}</span>
                <span className="block text-xs text-muted">{p.note}</span>
              </span>
              <span className="text-sm font-semibold text-brand">เปิดแผนที่ →</span>
            </a>
          ))}
          <p className="text-xs text-muted">เปิด Google Maps และค้นหาจากตำแหน่งปัจจุบันของคุณ{sickNow ? " ระหว่างเดินทางให้สวมหน้ากาก" : ""}</p>
        </div>
      </div>

      {showKit && <KitCard />}
      {caseId && sickNow && a.urgency !== "emergency" && <ReportTest caseId={caseId} current={answers.test} onUpdated={onUpdated} />}
    </div>
  );
}

function KitCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex min-h-12 w-full items-center gap-3 px-3 py-3 text-left" aria-expanded={open}>
        <span className="text-2xl" aria-hidden>
          🧪
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-semibold">อยากรู้ว่าเป็นไข้หวัดใหญ่จริงไหม?</span>
          <span className="block text-xs text-muted">ตรวจเองได้ด้วยชุดตรวจ ATK ไข้หวัดใหญ่</span>
        </span>
        <span className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="rise space-y-3 px-3 pb-3">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
            <li>
              เลือกชุดตรวจที่มี<b>เลข อย.</b> และระบุว่า <b>“สำหรับประชาชนตรวจด้วยตนเอง”</b> มีทั้งแบบตรวจไข้หวัดใหญ่ A/B และแบบรวมโควิด-19 + ไข้หวัดใหญ่
            </li>
            <li>ตรวจได้ผลดีที่สุดใน<b>ช่วง 1–3 วันแรก</b>หลังเริ่มมีอาการ</li>
            <li>
              <b>ผลลบไม่ได้แปลว่าไม่เป็น</b> ถ้ายังมีไข้และไอ ให้ดูแลตัวเองและแยกตัวเหมือนเป็นไข้หวัดใหญ่
            </li>
            <li>ระหว่างป่วย ให้คนในบ้านไปซื้อแทน หรือสั่งจากร้านยาผ่านแอปส่งของ ถ้าต้องไปเองให้สวมหน้ากาก</li>
          </ul>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a href={maps("ร้านขายยา")} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 font-semibold text-white">
              💊 ร้านยาใกล้ฉัน
            </a>
            <a href={shopee} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ee4d2d] px-3 font-semibold text-white">
              ซื้อใน Shopee
            </a>
            <a href={lazada} target="_blank" rel="noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0f146d] px-3 font-semibold text-white">
              ซื้อใน Lazada
            </a>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            สั่งออนไลน์อาจได้ของใน 1–3 วัน ซึ่งอาจเลยช่วงที่ตรวจได้ผลดีไปแล้ว ถ้ารีบให้ซื้อที่ร้านยาใกล้บ้าน ซื้อจากร้าน Mall หรือร้านทางการ และตรวจเลข อย. ก่อนใช้ทุกครั้ง
            (พูดได้ไม่ได้รับค่าตอบแทนจากร้านค้า)
          </p>
        </div>
      )}
    </div>
  );
}

function ReportTest({ caseId, current, onUpdated }: { caseId: string; current?: TestResult; onUpdated: (a: Assessment, t: TestResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  async function send(test: TestResult, label: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/cases", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: caseId, test }) });
      const d = (await r.json()) as { case?: { assessment: Assessment } };
      if (d.case) {
        onUpdated(d.case.assessment, test);
        setDone(`${label} · ระบบบันทึกเป็น “${CLASS_LABEL[d.case.assessment.classification]}” แล้ว`);
      } else setDone("บันทึกไม่สำเร็จ ข้อมูลอาจถูกรีเซ็ต ลองประเมินใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl bg-blue-soft p-3">
      <div className="text-[15px] font-semibold">ตรวจ ATK แล้ว? แจ้งผลให้เจ้าหน้าที่</div>
      <p className="mt-0.5 text-xs text-ink-2">ช่วยให้เจ้าหน้าที่รู้ว่าไข้หวัดใหญ่สายพันธุ์ไหนกำลังระบาดในพื้นที่ (รหัสเคส {caseId})</p>
      {done ? (
        <p className="rise mt-2 text-sm font-medium text-blue">✓ {done}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["rapid_pos_a", "เจอสายพันธุ์ A"],
              ["rapid_pos_b", "เจอสายพันธุ์ B"],
              ["neg", "ไม่เจอเชื้อ"],
            ] as [TestResult, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              disabled={busy}
              onClick={() => send(v, l)}
              className={`press min-h-11 rounded-xl border px-3 text-sm ${current === v ? "border-blue bg-blue text-white" : "border-blue/30 bg-surface"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
