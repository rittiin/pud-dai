"use client";

// Encourages the people who will benefit most to see a doctor within the 48-hour antiviral window.
// No doses — Oseltamivir is prescription-only; this card only explains why going early matters.
import { useState } from "react";
import type { Answers, Assessment } from "@/lib/types";
import { ANTIVIRAL } from "@/lib/flu/knowledge";

const hospitalMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("โรงพยาบาล")}`;

export default function AntiviralCard({ assessment: a, answers }: { assessment: Assessment; answers: Answers }) {
  const [open, setOpen] = useState(false);
  if (a.urgency === "recovered" || a.urgency === "emergency") return null;

  const positive = answers.test === "rapid_pos_a" || answers.test === "rapid_pos_b" || answers.test === "pcr_pos";
  if (!a.meetsClinical && !positive) return null;

  const days = a.hoursSinceOnset !== undefined ? Math.round(a.hoursSinceOnset / 24) : undefined;
  const inWindow = days === undefined || days <= 2;
  const highRisk = a.highRisk.length > 0;
  const strong = (highRisk || positive) && inWindow;
  const lateHighRisk = highRisk && !inWindow;

  const reasons: string[] = [];
  if (positive) reasons.push(answers.test === "rapid_pos_b" ? "ผลตรวจพบเชื้อสายพันธุ์ B" : answers.test === "pcr_pos" ? "ผลตรวจ RT-PCR พบเชื้อ" : "ผลตรวจพบเชื้อสายพันธุ์ A");
  if (highRisk) reasons.push(`อยู่ในกลุ่มเสี่ยง (${a.highRisk.join(", ")})`);

  const windowText =
    days === undefined
      ? "ยาได้ผลดีที่สุดถ้าเริ่มภายใน 48 ชั่วโมงหลังมีอาการ"
      : days === 0
        ? "คุณเพิ่งเริ่มป่วยวันนี้ ยังอยู่ในช่วงที่ยาได้ผลดีที่สุด"
        : days === 1
          ? "คุณป่วยมา 1 วัน เหลือเวลาประมาณ 1 วันในช่วงที่ยาได้ผลดีที่สุด"
          : days === 2
            ? "คุณป่วยมา 2 วัน ใกล้ครบ 48 ชั่วโมงแล้ว ควรไปวันนี้"
            : `คุณป่วยมา ${days} วัน เกิน 48 ชั่วโมงแล้ว`;

  const tone = strong || lateHighRisk ? "border-amber/40 bg-amber-soft" : "border-line bg-surface";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          💊
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-snug">
            {strong
              ? "ไปพบแพทย์วันนี้ เพื่อให้พิจารณายาต้านไวรัส"
              : lateHighRisk
                ? "ยังควรไปพบแพทย์ แม้เกิน 48 ชั่วโมงแล้ว"
                : "ยาต้านไวรัสไข้หวัดใหญ่ มีหรือไม่?"}
          </div>
          <p className="mt-1 text-[15px] leading-relaxed">
            {strong || lateHighRisk ? (
              <>
                มียา <b>{ANTIVIRAL.name}</b> ที่ช่วยให้หายเร็วขึ้นและลดโอกาสเป็นปอดอักเสบ{" "}
                {lateHighRisk ? "ถึงเกิน 48 ชั่วโมงแล้ว แพทย์ก็ยังอาจให้ยาในกลุ่มเสี่ยง" : ""}{" "}
                <b>ต้องให้แพทย์สั่งจ่ายเท่านั้น</b>
              </>
            ) : (
              <>
                มียา <b>{ANTIVIRAL.name}</b> แต่ต้องให้แพทย์สั่งจ่ายเท่านั้น คนส่วนใหญ่ที่ไม่ได้อยู่ในกลุ่มเสี่ยงหายเองได้
                ถ้าอาการไม่ดีขึ้นหรืออยากปรึกษาเรื่องยา ให้ไปพบแพทย์ภายใน 48 ชั่วโมงหลังเริ่มป่วย
              </>
            )}
          </p>
          {reasons.length > 0 && (strong || lateHighRisk) && (
            <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
              {reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(strong || days !== undefined) && (
        <div className="mt-3">
          <div className="relative h-2 overflow-hidden rounded-full bg-white">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${inWindow ? "bg-amber" : "bg-muted"}`}
              style={{ width: `${Math.min(100, (((days ?? 0) + 0.5) / 2) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>เริ่มป่วย</span>
            <span>24 ชม.</span>
            <span>48 ชม.</span>
          </div>
          <p className="mt-1 text-sm font-medium">{windowText}</p>
        </div>
      )}

      {(strong || lateHighRisk) && (
        <a href={hospitalMap} target="_blank" rel="noreferrer" className="press mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink font-semibold text-white">
          🏥 หาโรงพยาบาลใกล้ฉัน
        </a>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-2 text-sm text-ink-2 underline" aria-expanded={open}>
        {open ? "ซ่อน" : "อ่านเรื่องยานี้เพิ่ม"}
      </button>
      {open && (
        <div className="rise mt-2">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
            {ANTIVIRAL.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a href={ANTIVIRAL.source.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-muted underline">
            อ้างอิง: {ANTIVIRAL.source.label}
          </a>
        </div>
      )}
    </div>
  );
}
