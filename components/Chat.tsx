"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnswerKey, Answers, Assessment, ChatTurn, Evidence, EvidenceItem } from "@/lib/types";
import { nextQuestion, progress, type Question } from "@/lib/flu/questions";
import { addDays, todayISO } from "@/lib/flu/rules";
import { describe, FIELD_LABEL } from "@/lib/labels";
import ResultCard from "./ResultCard";
import Mascot, { type Mood } from "./Mascot";
import ShareButtons from "./ShareButtons";

type Msg =
  | { id: number; from: "bot"; text: string }
  | { id: number; from: "user"; text: string }
  | { id: number; from: "extract"; items: { key: AnswerKey; value: string; ev: EvidenceItem }[]; mode: string; dropped: string[] }
  | { id: number; from: "result"; assessment: Assessment; answers: Answers; caseId?: string };

type NewMsg = Msg extends infer T ? (T extends Msg ? Omit<T, "id"> : never) : never;

const FREE_PROMPT =
  "เล่าอาการให้ฟังหน่อยครับ พิมพ์หรือกดไมค์พูดก็ได้ เล่ายาวแค่ไหนก็ได้ ผมจะจับใจความ แล้วถามเฉพาะเรื่องที่ยังขาดครับ";

const EXAMPLES = [
  "มีไข้ ไอ ปวดเมื่อยตัว เริ่มเมื่อวาน",
  "ลูกไข้สูง ไอ เจ็บคอ ที่โรงเรียนเป็นหลายคน",
  "เคยไข้ ไอ ปวดหัว เมื่อ 5 วันก่อน ตอนนี้หายแล้ว",
];

let uid = 0;

/* ---------- Thai speech-to-text via the browser (Chrome/Edge/Safari) ---------- */
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function useSpeech(onText: (t: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setSupported(true);
  }, [onText]);

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) rec.stop();
    else {
      rec.start();
      setListening(true);
    }
  };
  return { supported, listening, toggle };
}

export default function Chat() {
  const [answers, setAnswers] = useState<Answers>({});
  const [evidence, setEvidence] = useState<Evidence>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [stage, setStage] = useState<"welcome" | "free" | "qa" | "done">("welcome");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);
  const [big, setBig] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const today = todayISO();

  const onSpeech = useCallback((t: string) => setInput(t), []);
  const speech = useSpeech(onSpeech);

  const q: Question | null = stage === "qa" ? nextQuestion(answers) : null;

  const push = (...m: NewMsg[]) => setMsgs((prev) => [...prev, ...m.map((x) => ({ ...x, id: ++uid }) as Msg)]);

  // larger text for older users — a per-viewer preference
  useEffect(() => {
    try {
      setBig(localStorage.getItem("pd-text") === "lg");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.text = big ? "lg" : "";
    try {
      localStorage.setItem("pd-text", big ? "lg" : "");
    } catch {}
  }, [big]);

  useEffect(() => {
    // When the summary arrives, land on its top (the headline) instead of the bottom of a long card.
    if (!busy && msgs[msgs.length - 1]?.from === "result") {
      const cards = document.querySelectorAll<HTMLElement>("[data-result]");
      cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const transcript = (): ChatTurn[] =>
    msgs.flatMap((m) => (m.from === "bot" || m.from === "user" ? [{ role: m.from, text: m.text }] : []));

  const result = [...msgs].reverse().find((m) => m.from === "result") as Extract<Msg, { from: "result" }> | undefined;
  const mood: Mood = busy || speech.listening
    ? "listening"
    : result
      ? result.assessment.urgency === "emergency" || result.assessment.urgency === "urgent"
        ? "worried"
        : result.assessment.urgency === "recovered"
          ? "celebrate"
          : "happy"
      : "happy";

  function start(consent: boolean) {
    const a: Answers = { consent };
    const ev: Evidence = { consent: { quote: consent ? "ยินยอม" : "ไม่ยินยอม", via: "button" } };
    setAnswers(a);
    setEvidence(ev);
    if (!consent) {
      setStage("done");
      setMsgs([{ id: ++uid, from: "result", assessment: emptyAssessment(), answers: a }]);
      return;
    }
    setStage("free");
    setMsgs([{ id: ++uid, from: "bot", text: FREE_PROMPT }]);
  }

  async function advance(a: Answers, ev: Evidence) {
    setAnswers(a);
    setEvidence(ev);
    setMulti([]);
    const nq = nextQuestion(a);
    if (nq) {
      push({ from: "bot", text: nq.prompt(a) });
      return;
    }
    setStage("done");
    setBusy(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: a, evidence: ev, transcript: transcript() }),
      });
      const data = (await res.json()) as { assessment: Assessment; id?: string };
      push({ from: "result", assessment: data.assessment, answers: a, caseId: data.id });
    } finally {
      setBusy(false);
    }
  }

  function answerCurrent(value: unknown, label: string) {
    if (!q) return;
    push({ from: "user", text: label });
    advance({ ...answers, [q.key]: value } as Answers, { ...evidence, [q.key]: { quote: label, via: "button" } } as Evidence);
  }

  async function sendText(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (speech.listening) speech.toggle();
    setInput("");
    push({ from: "user", text });

    if (stage === "qa" && q && (q.kind === "text" || q.kind === "number")) {
      if (q.kind === "number") {
        const n = parseInt(text.replace(/[^\d]/g, ""));
        if (!isNaN(n) && n >= 0 && n < 120) {
          await advance({ ...answers, age: n }, { ...evidence, age: { quote: text, via: "text" } });
          return;
        }
      } else {
        await advance({ ...answers, [q.key]: text } as Answers, { ...evidence, [q.key]: { quote: text, via: "text" } });
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: q?.prompt(answers) }),
      });
      const data = (await res.json()) as { answers: Partial<Answers>; evidence: Evidence; mode: string; dropped: string[] };
      const merged: Answers = { ...answers };
      const ev: Evidence = { ...evidence };
      const items: { key: AnswerKey; value: string; ev: EvidenceItem }[] = [];
      for (const [k, v] of Object.entries(data.answers) as [AnswerKey, unknown][]) {
        const prev = merged[k];
        let next = v;
        if (Array.isArray(prev) && Array.isArray(v)) next = [...new Set([...prev, ...v])];
        else if (prev !== undefined && k !== "onsetDate") continue; // never silently overwrite what the person already chose
        (merged as Record<string, unknown>)[k] = next;
        if (data.evidence[k]) ev[k] = data.evidence[k];
        items.push({ key: k, value: describe(k, next as never), ev: data.evidence[k] ?? { quote: text, via: "text" } });
      }
      if (items.length) push({ from: "extract", items, mode: data.mode, dropped: data.dropped });
      if (stage === "free") setStage("qa");
      if (!items.length && stage === "qa") {
        push({ from: "bot", text: "ขอโทษครับ ผมยังจับใจความไม่ได้ ลองกดเลือกคำตอบด้านล่างได้เลยครับ" });
        return;
      }
      if (!items.length && stage === "free") push({ from: "bot", text: "ไม่เป็นไรครับ งั้นผมขอถามทีละข้อนะครับ" });
      await advance(merged, ev);
    } finally {
      setBusy(false);
    }
  }

  function skipFree() {
    push({ from: "user", text: "ขอตอบทีละข้อ" });
    setStage("qa");
    advance(answers, evidence);
  }

  function restart() {
    setAnswers({});
    setEvidence({});
    setStage("welcome");
    setMulti([]);
    setMsgs([]);
    setInput("");
  }

  const prog = progress(answers);
  const showInput = stage === "free" || (stage === "qa" && q);

  if (stage === "welcome") return <Welcome onStart={start} big={big} setBig={setBig} />;

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/" aria-label="หน้าแรก">
          <Mascot mood={mood} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">น้องพูดได้</div>
          <div className="text-xs text-muted">{busy ? "กำลังอ่าน…" : speech.listening ? "กำลังฟัง…" : "ผู้ช่วยประเมินอาการไข้หวัดใหญ่"}</div>
        </div>
        <TextSize big={big} setBig={setBig} />
        <button onClick={restart} className="press rounded-full border border-line px-3 py-1.5 text-sm text-ink-2">
          เริ่มใหม่
        </button>
      </header>
      {stage === "qa" && (
        <div className="flex items-center gap-2 bg-surface px-4 pb-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full origin-left rounded-full bg-brand transition-transform duration-300"
              style={{ transform: `scaleX(${prog.done / Math.max(prog.total, 1)})`, transitionTimingFunction: "var(--ease-out)" }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted">
            {prog.done}/{prog.total}
          </span>
        </div>
      )}

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {msgs.map((m, i) => (
          <Bubble key={m.id} m={m} showAvatar={m.from === "bot" && msgs[i + 1]?.from !== "bot"} onRestart={restart} />
        ))}
        {busy && (
          <div className="rise flex items-end gap-2">
            <Mascot mood="listening" size={32} />
            <div className="typing flex gap-1.5 rounded-2xl rounded-bl-sm bg-surface px-4 py-3.5 shadow-sm" aria-label="กำลังพิมพ์">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </main>

      {stage === "free" && !busy && (
        <div className="stagger flex gap-2 overflow-x-auto px-4 pb-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => setInput(e)} className="press shrink-0 rounded-full border border-dashed border-brand/50 bg-brand-soft px-3.5 py-2 text-sm text-brand">
              “{e}”
            </button>
          ))}
          <button onClick={skipFree} className="press shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-sm">
            ขอตอบทีละข้อ →
          </button>
        </div>
      )}

      {stage === "qa" && q && !busy && (
        <div key={q.key} className="rise max-h-[45dvh] overflow-y-auto border-t border-line bg-surface px-4 pb-2 pt-3">
          {q.kind === "single" && (
            <div className="stagger flex flex-wrap gap-2">
              {q.options!.map((o) => (
                <Chip key={o.label} onClick={() => answerCurrent(o.value, o.label)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
          {q.kind === "multi" && (
            <div>
              <div className="stagger flex flex-wrap gap-2">
                {q.options!.map((o) => {
                  const v = String(o.value);
                  const on = multi.includes(v);
                  return (
                    <Chip
                      key={v}
                      active={on}
                      onClick={() =>
                        setMulti((cur) =>
                          o.exclusive ? (on ? [] : [v]) : on ? cur.filter((x) => x !== v) : [...cur.filter((x) => x !== "__none"), v]
                        )
                      }
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-md border text-xs transition-colors ${on ? "border-white bg-white text-brand" : "border-line"}`}
                        aria-hidden
                      >
                        {on ? "✓" : ""}
                      </span>
                      {o.label}
                    </Chip>
                  );
                })}
              </div>
              <button
                disabled={!multi.length}
                onClick={() => {
                  const vals = multi.filter((x) => x !== "__none");
                  const label = q.options!.filter((o) => multi.includes(String(o.value))).map((o) => o.label).join(", ");
                  answerCurrent(vals, label);
                }}
                className="press mt-3 w-full rounded-2xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-40"
              >
                {multi.length ? `ยืนยัน (${multi.filter((x) => x !== "__none").length || "ไม่มี"})` : "เลือกอย่างน้อย 1 ข้อ"}
              </button>
            </div>
          )}
          {q.kind === "date" && (
            <div className="stagger flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const label = d === 0 ? "วันนี้" : d === 1 ? "เมื่อวาน" : `${d} วันก่อน`;
                return (
                  <Chip key={d} onClick={() => answerCurrent(addDays(today, -d), label)}>
                    {label}
                  </Chip>
                );
              })}
              <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-line px-3.5 text-[15px] text-ink-2">
                นานกว่านั้น
                <input
                  type="date"
                  max={today}
                  className="bg-transparent"
                  onChange={(e) => e.target.value && answerCurrent(e.target.value, describe("onsetDate", e.target.value))}
                />
              </label>
            </div>
          )}
          {q.optional && (
            <div className="mt-2">
              <Chip onClick={() => answerCurrent(null, "ข้าม")}>ข้าม</Chip>
            </div>
          )}
        </div>
      )}

      {showInput && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendText();
          }}
          className="flex items-center gap-2 border-t border-line bg-surface px-3 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {speech.supported && (
            <button
              type="button"
              onClick={speech.toggle}
              aria-label={speech.listening ? "หยุดฟัง" : "กดเพื่อพูด"}
              className={`press relative grid h-12 w-12 shrink-0 place-items-center rounded-full ${speech.listening ? "bg-red text-white" : "bg-brand-soft text-brand"}`}
            >
              {speech.listening && <span className="mic-ring absolute inset-0 rounded-full bg-red" aria-hidden />}
              <MicIcon />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode={q?.kind === "number" ? "numeric" : "text"}
            placeholder={speech.listening ? "พูดได้เลยครับ…" : stage === "free" ? "พิมพ์เล่าอาการ…" : (q?.hint ?? "หรือพิมพ์ตอบเองก็ได้…")}
            className="h-12 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-base outline-none transition-colors focus:border-brand"
          />
          <button
            disabled={!input.trim() || busy}
            aria-label="ส่ง"
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-35"
          >
            <SendIcon />
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- Welcome ---------- */
function Welcome({ onStart, big, setBig }: { onStart: (c: boolean) => void; big: boolean; setBig: (b: boolean) => void }) {
  const [showPdpa, setShowPdpa] = useState(false);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-gradient-to-b from-brand-soft to-bg px-5 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2">
          ← หน้าแรก
        </Link>
        <TextSize big={big} setBig={setBig} />
      </div>
      <div className="stagger flex flex-1 flex-col items-center justify-center text-center">
        <Mascot mood="happy" size={148} float />
        <h1 className="mt-4 text-[26px] font-bold leading-tight">สวัสดีครับ ผมน้องพูดได้</h1>
        <p className="mt-2 max-w-sm text-[17px] leading-relaxed text-ink-2">
          มีไข้ ไอ เจ็บคอ หรือปวดเมื่อยตัว? เล่าให้ผมฟังสัก 2 นาที แล้วผมจะช่วยบอกว่าควรทำอะไรต่อ
        </p>
        <ul className="mt-6 w-full max-w-sm space-y-2.5 text-left">
          {[
            ["🩺", "ควรไปหาหมอไหม และไปเมื่อไหร่"],
            ["🏠", "ต้องหยุดงานหรือหยุดเรียนถึงวันไหน"],
            ["👨‍👩‍👧", "ดูแลตัวเองและคนในบ้านอย่างไร"],
          ].map(([icon, t]) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[16px] shadow-sm">
              <span className="text-xl" aria-hidden>
                {icon}
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2.5">
        <button onClick={() => onStart(true)} className="press w-full rounded-2xl bg-brand py-4 text-lg font-semibold text-white shadow-md shadow-brand/20">
          เริ่มประเมินอาการ
        </button>
        <p className="px-2 text-center text-xs leading-relaxed text-muted">
          ต้นแบบนี้ใช้เพื่อสาธิต ไม่ใช่บริการของหน่วยงานจริง โปรดใช้ข้อมูลสมมติเท่านั้น เมื่อกดเริ่ม คุณยินยอมให้ระบบประเมินคำตอบเพื่อการสาธิต{" "}
          <button onClick={() => setShowPdpa((s) => !s)} className="underline">
            {showPdpa ? "ซ่อน" : "อ่านเพิ่ม"}
          </button>
        </p>
        {showPdpa && (
          <div className="rise rounded-xl bg-surface p-3 text-xs leading-relaxed text-ink-2">
            อย่ากรอกชื่อ เบอร์โทร หรือข้อมูลสุขภาพจริง เว็บเดโมสาธารณะไม่บันทึกรายงาน และ Dashboard แสดงข้อมูลสมมติเท่านั้น
            <button onClick={() => onStart(false)} className="mt-2 block text-ink underline">
              ไม่ยินยอม ขอดูคำแนะนำทั่วไปอย่างเดียว
            </button>
          </div>
        )}
        <p className="text-center text-[11px] text-muted">ผลนี้เป็นการคัดกรองเบื้องต้นตามนิยามโรคของกรมควบคุมโรค ไม่ใช่การวินิจฉัยของแพทย์</p>
        <div className="flex justify-center pt-1">
          <ShareButtons compact />
        </div>
      </div>
    </div>
  );
}

function TextSize({ big, setBig }: { big: boolean; setBig: (b: boolean) => void }) {
  return (
    <button
      onClick={() => setBig(!big)}
      aria-pressed={big}
      aria-label="ขยายตัวอักษร"
      className={`press rounded-full border px-3 py-1.5 text-sm font-semibold ${big ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2"}`}
    >
      ก<span className="text-[0.8em]">ก</span>+
    </button>
  );
}

function emptyAssessment(): Assessment {
  return { meetsClinical: false, clinicalReason: "", classification: "not_case", urgency: "selfcare", highRisk: [], alerts: [] };
}

function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press flex min-h-12 items-center gap-2 rounded-2xl border px-4 py-2 text-left text-[15px] ${
        active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Bubble({ m, showAvatar, onRestart }: { m: Msg; showAvatar: boolean; onRestart: () => void }) {
  if (m.from === "user")
    return (
      <div className="rise ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-[16px] text-white">{m.text}</div>
    );
  if (m.from === "bot")
    return (
      <div className="rise flex items-end gap-2">
        <span className="w-8 shrink-0">{showAvatar && <Mascot mood="happy" size={32} />}</span>
        <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-[16px] leading-relaxed shadow-sm">{m.text}</div>
      </div>
    );
  if (m.from === "extract")
    return (
      <div className="rise flex items-end gap-2">
        <span className="w-8 shrink-0" />
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-brand/25 bg-brand-soft px-4 py-3">
          <div className="mb-2 text-sm font-semibold text-brand">ผมเข้าใจแบบนี้ ถูกไหมครับ</div>
          <ul className="stagger space-y-2">
            {m.items.map((it) => (
              <li key={it.key} className="text-[15px]">
                <span className="font-medium">✓ {FIELD_LABEL[it.key]}:</span> {it.value}
                <div className="mt-0.5 pl-4 text-xs text-ink-2">
                  จากที่คุณบอกว่า “{it.ev.quote}”
                  <span className="ml-1 rounded bg-white/70 px-1 text-[10px] text-muted">{it.ev.via === "ai" ? "AI" : "คำค้น"}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-muted">ถ้าไม่ถูก กด “เริ่มใหม่” ด้านบนได้เลย</div>
        </div>
      </div>
    );
  return (
    <div data-result className="scroll-mt-3">
      <ResultCard assessment={m.assessment} answers={m.answers} caseId={m.caseId} onRestart={onRestart} />
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="relative">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
