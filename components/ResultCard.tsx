"use client";

import { useState } from "react";
import type { Answers, Assessment } from "@/lib/types";
import { ADVICE, CASE_DEFINITION, DISEASE_CATALOG, DISEASE_SOURCES, RED_FLAG_LABEL, SOURCES } from "@/lib/flu/knowledge";
import { CLASS_LABEL, thaiDate, todayISO } from "@/lib/flu/rules";
import Mascot, { type Mood } from "./Mascot";
import CareFinder from "./CareFinder";
import AntiviralCard from "./AntiviralCard";
import ShareButtons from "./ShareButtons";

const TONE: Record<string, { bg: string; soft: string; ink: string; mood: Mood; tag: string }> = {
  emergency: { bg: "bg-red", soft: "bg-red-soft", ink: "text-red", mood: "worried", tag: "ฉุกเฉิน" },
  urgent: { bg: "bg-amber", soft: "bg-amber-soft", ink: "text-amber", mood: "worried", tag: "ควรพบแพทย์วันนี้" },
  soon: { bg: "bg-amber", soft: "bg-amber-soft", ink: "text-amber", mood: "worried", tag: "พบแพทย์ภายใน 24 ชม." },
  selfcare: { bg: "bg-brand", soft: "bg-brand-soft", ink: "text-brand", mood: "happy", tag: "ดูแลตัวเองที่บ้าน" },
  recovered: { bg: "bg-green", soft: "bg-green-soft", ink: "text-green", mood: "celebrate", tag: "หายแล้ว" },
};

function headline(a: Assessment, ans: Answers): { title: string; body: string } {
  const disease = DISEASE_CATALOG[a.disease];
  const hasGiSymptoms = (ans.symptoms ?? []).some((s) => ["diarrhea", "vomiting", "abdominal_pain", "bloody_stool"].includes(s));
  switch (a.urgency) {
    case "emergency":
      return {
        title: "ไปห้องฉุกเฉินทันที หรือโทร 1669",
        body: hasGiSymptoms || a.disease === "acute_diarrhea" || a.disease === "food_poisoning"
          ? "มีสัญญาณอันตรายหรือเสี่ยงขาดน้ำรุนแรง ควรไปฉุกเฉินทันที อย่ารอดูอาการที่บ้าน"
          : "คุณมีสัญญาณอันตรายที่อาจเป็นภาวะแทรกซ้อนรุนแรง อย่ารอดูอาการที่บ้าน ระหว่างเดินทางให้สวมหน้ากาก",
      };
    case "urgent": {
      if (ans.poultry)
        return {
          title: "ควรไปพบแพทย์วันนี้",
          body: "คุณมีไข้หรือไอ และเคยสัมผัสสัตว์ปีกป่วยหรือตาย ต้องบอกแพทย์เรื่องนี้ทันที เพราะต้องตรวจแยกไข้หวัดนก ระหว่างเดินทางให้สวมหน้ากาก",
        };
      const within48 = a.disease === "flu" && (a.hoursSinceOnset ?? 99) <= 48;
      return {
        title: "ควรไปพบแพทย์วันนี้",
        body: `คุณอยู่ในกลุ่มเสี่ยงที่อาจมีอาการรุนแรง (${a.highRisk.join(", ")}) ${
          within48
            ? "ตอนนี้ยังอยู่ในช่วง 48 ชั่วโมงแรกหลังเริ่มป่วย ซึ่งแพทย์อาจพิจารณาให้ยาต้านไวรัสที่ได้ผลดีที่สุดในช่วงนี้ อย่ารอ"
            : "แพทย์จะประเมินว่าต้องตรวจเพิ่มเติมหรือมีภาวะแทรกซ้อนหรือไม่"
        } บอกแพทย์ว่ามีอาการอะไรและเริ่มป่วยวันไหน`,
      };
    }
    case "soon":
      return {
        title: "ควรไปพบแพทย์ภายใน 24 ชั่วโมง",
        body: "อาการของคุณไม่ดีขึ้นตามที่ควรเป็น ควรให้แพทย์ตรวจว่ามีภาวะแทรกซ้อน เช่น ปอดอักเสบ หรือไม่",
      };
    case "recovered":
      return {
        title: "ดีใจที่หายแล้วครับ",
        body: "ข้อมูลของคุณช่วยให้เจ้าหน้าที่เห็นภาพการระบาดในพื้นที่ แม้หายแล้วก็ยังมีประโยชน์มาก",
      };
    default:
      return a.disease === "unknown" && hasGiSymptoms
        ? { title: "มีอาการทางเดินอาหาร แต่ยังไม่ทราบสาเหตุ", body: "จิบน้ำเกลือแร่ ORS ที่ผสมตามฉลาก และสังเกตอาการ ผลคัดกรองนี้ยังแยกสาเหตุไม่ได้ หากดื่มน้ำไม่ได้ ปัสสาวะน้อย ซึม ถ่ายเป็นมูกเลือด หรืออาการแย่ลง ให้พบแพทย์" }
        : a.disease === "unknown" && (ans.symptoms ?? []).some((s) => ["cough", "sore_throat", "runny_nose", "sputum"].includes(s))
          ? { title: "มีอาการทางเดินหายใจ แต่ยังไม่ทราบสาเหตุ", body: "อาการคล้ายกันเกิดได้จากหลายโรค อาจพิจารณาตรวจโควิดด้วยชุด ATK สำหรับตรวจเอง และติดตามอาการ ผลตรวจไม่ใช่การวินิจฉัย" }
          : a.meetsClinical && a.disease === "flu"
        ? { title: "อาการเข้าได้กับไข้หวัดใหญ่", body: "อาการเข้าได้กับนิยามคัดกรองไข้หวัดใหญ่ แต่ยังไม่ใช่การวินิจฉัย หากอาการไม่รุนแรงให้พักผ่อนและสังเกตอาการ" }
        : a.meetsClinical
          ? { title: `อาการเข้าเกณฑ์คัดกรอง${disease.label}`, body: `${disease.clinical} ผลนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย` }
          : {
            title: "ดูแลตัวเองที่บ้านได้",
            body: `ข้อมูลที่ตอบมายังไม่ครบหรือไม่เข้ากับเกณฑ์คัดกรองของ${disease.label} ให้สังเกตอาการและพบแพทย์หากอาการรุนแรงหรือแย่ลง`,
          };
  }
}

export default function ResultCard({
  assessment: initialAssessment,
  answers: initialAnswers,
  caseId,
  onRestart,
}: {
  assessment: Assessment;
  answers: Answers;
  caseId?: string;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState<string | null>("selfCare");
  const [a, setA] = useState(initialAssessment); // updates when the person reports a test result
  const [answers, setAnswers] = useState(initialAnswers);

  if (answers.consent === false || (answers.symptoms && answers.symptoms.length === 0)) {
    return (
      <div className="rise space-y-3 rounded-2xl bg-surface p-4 shadow-sm">
        <Mascot mood="happy" size={56} />
        <div className="font-semibold">{answers.consent === false ? "ไม่เป็นไรครับ ระบบจะไม่บันทึกข้อมูลของคุณ" : "ดีครับ ตอนนี้คุณไม่มีอาการ"}</div>
        <p className="text-sm text-ink-2">คำแนะนำทั่วไปเพื่อป้องกันโรคและลดการแพร่เชื้อ:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {["ล้างมือด้วยสบู่บ่อย ๆ และหลีกเลี่ยงการสัมผัสตา จมูก ปาก", "สวมหน้ากากเมื่อมีอาการหรืออยู่ใกล้ผู้ป่วย", ADVICE.protectOthers[2]].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">{ADVICE.hotline}</p>
        <ShareButtons title="แชร์ให้คนที่ไม่สบาย" />
        <button onClick={onRestart} className="w-full rounded-xl border border-line py-2.5 text-sm">
          เริ่มใหม่
        </button>
      </div>
    );
  }

  const tone = TONE[a.urgency];
  const h = headline(a, answers);
  const today = todayISO();
  const isolating = a.disease === "flu" && a.urgency !== "recovered" && a.contagiousUntil && a.contagiousUntil >= today;
  const giSymptoms = (answers.symptoms ?? []).some((s) => ["diarrhea", "vomiting", "abdominal_pain", "bloody_stool"].includes(s));
  const gastrointestinal = a.disease === "acute_diarrhea" || a.disease === "food_poisoning" || giSymptoms;
  const selfCare = gastrointestinal && a.disease === "flu"
    ? [...ADVICE.selfCare, ...ADVICE.giSelfCare]
    : gastrointestinal
      ? ADVICE.giSelfCare
      : a.disease === "flu"
        ? ADVICE.selfCare
        : ADVICE.selfCare.filter((item) => !item.includes("ไข้หวัดใหญ่"));

  const sections: { id: string; title: string; items: string[] }[] = [
    ...(a.urgency === "recovered"
      ? [{ id: "recovered", title: "หลังหายป่วย", items: ADVICE.recovered }]
      : [
          { id: "selfCare", title: "ดูแลตัวเองที่บ้าน", items: selfCare },
          { id: "protect", title: gastrointestinal ? "ป้องกันการแพร่เชื้อทางอาหารและมือ" : "ป้องกันคนในบ้านและคนรอบตัว", items: gastrointestinal ? ADVICE.giProtect : ADVICE.protectOthers },
        ]),
    {
      id: "warn",
      title: "ไปโรงพยาบาลทันทีถ้ามีอาการเหล่านี้",
      items: Object.values(RED_FLAG_LABEL),
    },
          ...(a.disease === "flu" ? [{ id: "vaccine", title: "วัคซีนไข้หวัดใหญ่", items: ADVICE.vaccine }] : []),
  ];

  return (
    <div className="rise overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className={`${tone.bg} px-4 py-4 text-white`}>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white p-1">
            <Mascot mood={tone.mood} size={52} />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/80">{tone.tag}</div>
            <div className="text-xl font-bold leading-snug">{h.title}</div>
          </div>
        </div>
        <p className="mt-3 text-[16px] leading-relaxed text-white/95">{h.body}</p>
        {(a.urgency === "emergency" || a.urgency === "urgent") && (
          <a href="tel:1669" className="press mt-3 inline-flex min-h-12 items-center rounded-full bg-white px-5 text-base font-semibold text-ink">
            โทร 1669
          </a>
        )}
      </div>

      <div className="stagger space-y-4 p-4">
        {isolating && (
          <div className={`rounded-xl ${tone.soft} p-3`}>
            <div className="text-sm font-semibold">ช่วงที่ยังแพร่เชื้อได้</div>
            <p className="mt-1 text-sm">
              หยุดงานหรือหยุดเรียน และอยู่บ้านถึงประมาณ <b>{thaiDate(a.contagiousUntil)}</b> และกลับไปได้เมื่อ
              <b>ไม่มีไข้ต่อเนื่อง 24 ชั่วโมงโดยไม่ใช้ยาลดไข้</b>
            </p>
            <p className="mt-1 text-xs text-ink-2">
              อ้างอิง: {CASE_DEFINITION.contagious}
            </p>
          </div>
        )}

        {a.disease === "flu" && <AntiviralCard assessment={a} answers={answers} />}

        {answers.consent && <CareFinder assessment={a} answers={answers} caseId={caseId} onUpdated={(na, t) => { setA(na); setAnswers({ ...answers, test: t }); }} />}

        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-ink-2">ผลคัดกรอง {DISEASE_CATALOG[a.disease].label}</div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.meetsClinical ? "bg-amber-soft text-amber" : "bg-green-soft text-green"}`}>
              {CLASS_LABEL[a.classification]}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-muted">{a.clinicalReason}</div>
          <div className="mt-1 text-xs text-muted">รหัสเฝ้าระวัง: {a.surveillanceCode} · เกณฑ์: {a.disease === "flu" ? CASE_DEFINITION.clinical : DISEASE_CATALOG[a.disease].clinical}</div>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line">
          {sections.map((s) => (
            <div key={s.id}>
              <button
                onClick={() => setOpen(open === s.id ? null : s.id)}
                className="flex min-h-12 w-full items-center justify-between px-3 py-3 text-left text-[16px] font-medium"
                aria-expanded={open === s.id}
              >
                {s.title}
                <span className={`text-muted transition-transform duration-200 ${open === s.id ? "rotate-180" : ""}`} style={{ transitionTimingFunction: "var(--ease-out)" }}>⌄</span>
              </button>
              {open === s.id && (
                <ul className="rise list-disc space-y-2 px-3 pb-3 pl-8 text-[15px] leading-relaxed">
                  {s.items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {caseId && (
          <div className="rounded-xl bg-blue-soft p-3 text-sm">
            ส่งข้อมูลให้เจ้าหน้าที่ควบคุมโรคแล้ว รหัส <b>{caseId}</b>
            {answers.phone ? " เจ้าหน้าที่อาจโทรติดตามอาการ" : ""}
          </div>
        )}

        <div className="text-xs leading-relaxed text-muted">
          {ADVICE.hotline}
          <br />
          ข้อมูลอ้างอิง:{" "}
          {Object.values(a.disease === "flu" ? SOURCES : DISEASE_SOURCES)
            .slice(0, 3)
            .map((s, i) => (
              <span key={s.label}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                  {s.label.split(" — ")[0].slice(0, 40)}
                </a>
              </span>
            ))}
          <br />
          ผลนี้ใช้คัดกรองเบื้องต้นตามนิยามโรค ไม่ใช่การวินิจฉัยของแพทย์
        </div>

        <ShareButtons title={a.urgency === "recovered" ? "ชวนคนอื่นมาใช้ เผื่อเขาเริ่มป่วย" : "ส่งต่อให้คนในบ้านหรือเพื่อนที่เริ่มมีอาการ"} />

        <button onClick={onRestart} className="press min-h-12 w-full rounded-2xl border border-line text-base">
          ประเมินให้คนอื่น / เริ่มใหม่
        </button>
      </div>
    </div>
  );
}
