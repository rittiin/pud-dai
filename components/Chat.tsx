"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnswerKey, Answers, Assessment, ChatTurn, Evidence, EvidenceItem } from "@/lib/types";
import { nextQuestion, progress, questionOptions, type Question } from "@/lib/flu/questions";
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

function speakOnDevice(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("th"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

type ConsentChoices = { processing: boolean; store: boolean; ai: boolean; openAiVoice: boolean; microphone: boolean };

export default function Chat({ publicDemo, openAiVoiceAvailable, aiAvailable }: { publicDemo: boolean; openAiVoiceAvailable: boolean; aiAvailable: boolean }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [evidence, setEvidence] = useState<Evidence>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [stage, setStage] = useState<"welcome" | "free" | "clarify_term" | "clarify_meaning" | "candidate" | "qa" | "done">("welcome");
  const [candidateTerm, setCandidateTerm] = useState("");
  const [candidateMeaning, setCandidateMeaning] = useState("");
  const [candidateDialect, setCandidateDialect] = useState("unknown");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);
  const [big, setBig] = useState(false);
  const [storeConsent, setStoreConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [micConsent, setMicConsent] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const today = todayISO();

  const onSpeech = useCallback((t: string) => setInput(t), []);
  const speech = useSpeech(onSpeech);

  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (!voiceConsent || !openAiVoiceAvailable) {
      setVoiceBusy(false);
      setVoiceStatus("");
      speakOnDevice(text);
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus("");
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, consent: true }),
      });
      if (!res.ok) throw new Error("speech unavailable");
      const url = URL.createObjectURL(await res.blob());
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      const cleanup = () => {
        if (audioUrlRef.current === url) audioUrlRef.current = null;
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setVoiceBusy(false);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      audioRef.current = null;
      setVoiceBusy(false);
      setVoiceStatus("สร้างเสียง OpenAI ไม่สำเร็จ ใช้เสียงจากอุปกรณ์แทน");
      speakOnDevice(text);
    }
  }, [openAiVoiceAvailable, voiceConsent]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

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

  function start(choices: ConsentChoices) {
    const a: Answers = { consent: choices.processing };
    const ev: Evidence = { consent: { quote: choices.processing ? "ยินยอมให้ประมวลผลเพื่อคัดกรอง" : "ไม่ยินยอม", via: "button" } };
    setStoreConsent(choices.store);
    setAiConsent(choices.ai);
    setVoiceConsent(choices.openAiVoice);
    setMicConsent(choices.microphone);
    setVoiceStatus("");
    setAnswers(a);
    setEvidence(ev);
    if (!choices.processing) {
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
        body: JSON.stringify({ answers: a, evidence: ev, transcript: transcript(), storeConsent, aiConsent }),
      });
      const data = (await res.json()) as { assessment: Assessment; id?: string; stored?: boolean; demo?: boolean };
      if (!data.stored) {
        push({ from: "bot", text: data.demo ? "ผลคัดกรองเสร็จแล้วครับ เดโมสาธารณะไม่ได้บันทึกคำตอบ" : "ผลคัดกรองเสร็จแล้วครับ ตามตัวเลือกของคุณ ระบบไม่ได้บันทึกคำตอบไว้ในแดชบอร์ด" });
      }
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

    if (stage === "clarify_term") {
      if (/^(ไม่แน่ใจ|ไม่รู้|ข้าม)$/i.test(text)) {
        push({ from: "bot", text: "ไม่เป็นไรครับ ผมจะไม่เดาความหมายหรือจัดประเภทจากคำนี้ ไปตอบคำถามทีละข้อแทนนะครับ" });
        setStage("qa");
        await advance(answers, evidence);
      } else {
        setCandidateTerm(text.slice(0, 60));
        setStage("clarify_meaning");
        push({ from: "bot", text: `ขอบคุณครับ คำว่า “${text.slice(0, 60)}” หมายถึงอะไรในกรณีนี้ครับ? ถ้าไม่แน่ใจ พิมพ์ “ไม่แน่ใจ” ได้เลย` });
      }
      return;
    }
    if (stage === "clarify_meaning") {
      if (/^(ไม่แน่ใจ|ไม่รู้|ข้าม)$/i.test(text)) {
        setCandidateMeaning("");
        push({ from: "bot", text: "เข้าใจครับ ผมจะไม่จัดประเภทจากคำนี้ และจะไปถามข้อมูลทีละข้อแทน" });
        setStage("qa");
        await advance(answers, evidence);
      } else {
        setCandidateMeaning(text.slice(0, 200));
        setCandidateDialect("unknown");
        setStage("candidate");
        push({ from: "bot", text: "ขอบคุณครับ ยังไม่ใช้คำนี้เป็นกฎหรือจัดประเภทโรค หากต้องการ สามารถส่งเฉพาะคำและความหมายนี้เป็นคำเสนอให้ผู้เชี่ยวชาญตรวจได้ โดยไม่แนบบทสนทนาหรือข้อมูลระบุตัวบุคคล" });
      }
      return;
    }

    if (stage === "qa" && q && (q.kind === "text" || q.kind === "number")) {
      if (q.kind === "number") {
        const ageValue = q.key === "age"
          ? (() => {
              const match = text.match(/(\d+(?:[.,]\d+)?)\s*(เดือน|ปี|ขวบ)?/);
              if (!match) return NaN;
              const value = Number(match[1].replace(",", "."));
              return match[2] === "เดือน" ? value / 12 : value;
            })()
          : Number.parseInt(text.replace(/[^\d]/g, ""), 10);
        const n = ageValue;
        const max = q.key === "age" ? 120 : 100;
        if (!isNaN(n) && n >= 0 && n < max) {
          await advance({ ...answers, [q.key]: n } as Answers, { ...evidence, [q.key]: { quote: text, via: "text" } });
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
        body: JSON.stringify({ text, context: q?.prompt(answers), aiConsent }),
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
      if (!items.length && stage === "free") {
        setStage("clarify_term");
        push({ from: "bot", text: "ผมยังจับความหมายไม่ได้ครับ คำหรือวลีไหนที่อยากให้ช่วยทำความเข้าใจครับ? พิมพ์เฉพาะคำนั้นได้เลย หรือพิมพ์ “ไม่แน่ใจ” เพื่อข้าม ผมจะไม่จัดประเภทจนกว่าจะได้ข้อมูลชัดเจน" });
        return;
      }
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
    setCandidateTerm("");
    setCandidateMeaning("");
    setCandidateDialect("unknown");
    setStoreConsent(false);
    setAiConsent(false);
    setVoiceConsent(false);
    setMicConsent(false);
    setVoiceStatus("");
  }

  async function submitCandidate() {
    if (!candidateTerm || !candidateMeaning) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dialect-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: candidateTerm, meaning: candidateMeaning, dialect: candidateDialect, consent: true }),
      });
      const data = (await res.json()) as { stored?: boolean };
      push({ from: "bot", text: data.stored ? "ส่งคำเสนอเพื่อรอตรวจแล้วครับ ยังไม่เพิ่มเข้าอภิธานศัพท์" : "เว็บเดโมสาธารณะยังไม่บันทึกคำเสนอครับ ข้อมูลนี้จะไม่ถูกเก็บไว้" });
    } catch {
      push({ from: "bot", text: "ส่งคำเสนอไม่สำเร็จครับ คำนี้ยังไม่ได้ถูกบันทึก" });
    } finally {
      setBusy(false);
      setCandidateTerm("");
      setCandidateMeaning("");
      setStage("qa");
      await advance(answers, evidence);
    }
  }

  const prog = progress(answers);
  const showInput = stage === "free" || stage === "clarify_term" || stage === "clarify_meaning" || (stage === "qa" && q);

  if (stage === "welcome") return <Welcome onStart={start} big={big} setBig={setBig} publicDemo={publicDemo} openAiVoiceAvailable={openAiVoiceAvailable} aiAvailable={aiAvailable} />;

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/" aria-label="หน้าแรก">
          <Mascot mood={mood} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">น้องพูดได้</div>
          <div className="text-xs text-muted">{voiceBusy ? "กำลังสร้างเสียง…" : speech.listening ? "กำลังฟัง…" : voiceStatus || "ผู้ช่วยคัดกรอง 3 กลุ่มโรค"}</div>
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
          <Bubble key={m.id} m={m} showAvatar={m.from === "bot" && msgs[i + 1]?.from !== "bot"} onRestart={restart} onSpeak={speakText} voiceLabel={voiceConsent && openAiVoiceAvailable ? "🔊 เสียง AI จาก OpenAI" : "🔊 อ่านด้วยเสียงอุปกรณ์"} />
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
              {questionOptions(q, answers).map((o) => (
                <Chip key={o.label} onClick={() => answerCurrent(o.value, o.label)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
          {q.kind === "multi" && (
            <div>
              <div className="stagger flex flex-wrap gap-2">
                {questionOptions(q, answers).map((o) => {
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
                  const label = questionOptions(q, answers).filter((o) => multi.includes(String(o.value))).map((o) => o.label).join(", ");
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

      {stage === "candidate" && !busy && (
        <div className="space-y-3 border-t border-line bg-surface px-4 py-3">
          <div className="text-sm font-medium">ภาษาถิ่นโดยประมาณ (ไม่ทราบก็ได้)</div>
          <div className="flex flex-wrap gap-2">
            {[ ["unknown", "ไม่ทราบ"], ["isan", "อีสาน"], ["north", "เหนือ"], ["south", "ใต้"], ["other", "อื่น ๆ"] ].map(([v, label]) => <Chip key={v} active={candidateDialect === v} onClick={() => setCandidateDialect(v)}>{label}</Chip>)}
          </div>
          <p className="text-xs leading-relaxed text-muted">ส่งเฉพาะคำ “{candidateTerm}” และความหมายที่ยืนยัน เพื่อรอตรวจ ไม่บันทึกบทสนทนานี้ในคลังคำ เดโมสาธารณะไม่เก็บข้อมูล</p>
          <div className="flex gap-2">
            <button onClick={submitCandidate} className="press flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white">ยินยอมส่งคำเสนอ</button>
            <button onClick={() => { setStage("qa"); advance(answers, evidence); }} className="press flex-1 rounded-xl border border-line py-3 text-sm">ไม่ส่ง / ไปต่อ</button>
          </div>
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
          {speech.supported && micConsent && (
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
            placeholder={speech.listening ? "พูดได้เลยครับ…" : stage === "free" ? "พิมพ์เล่าอาการ…" : stage === "clarify_term" ? "พิมพ์คำหรือวลีที่ไม่เข้าใจ…" : stage === "clarify_meaning" ? "พิมพ์ความหมาย หรือ “ไม่แน่ใจ”…" : (q?.hint ?? "หรือพิมพ์ตอบเองก็ได้…")}
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
function Welcome({
  onStart,
  big,
  setBig,
  publicDemo,
  openAiVoiceAvailable,
  aiAvailable,
}: {
  onStart: (choices: ConsentChoices) => void;
  big: boolean;
  setBig: (b: boolean) => void;
  publicDemo: boolean;
  openAiVoiceAvailable: boolean;
  aiAvailable: boolean;
}) {
  const [processing, setProcessing] = useState(false);
  const [store, setStore] = useState(false);
  const [ai, setAi] = useState(false);
  const [openAiVoice, setOpenAiVoice] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const begin = (allowed: boolean) => onStart({ processing: allowed, store: allowed && store, ai: allowed && ai, openAiVoice: allowed && openAiVoice, microphone: allowed && microphone });
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col overflow-y-auto bg-gradient-to-b from-brand-soft to-bg px-5 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2">
          ← หน้าแรก
        </Link>
        <TextSize big={big} setBig={setBig} />
      </div>
      <div className="stagger flex flex-col items-center py-5 text-center">
        <Mascot mood="happy" size={112} float />
        <h1 className="mt-3 text-[26px] font-bold leading-tight">สวัสดีครับ ผมน้องพูดได้</h1>
        <p className="mt-2 max-w-sm text-[16px] leading-relaxed text-ink-2">
          ช่วยคัดกรองเบื้องต้นเมื่อมีไข้ ไอ ถ่ายเหลว อาเจียน หรือปวดท้อง ผลไม่ใช่การวินิจฉัยของแพทย์
        </p>
        <ul className="mt-4 w-full max-w-sm space-y-2 text-left">
          {[
            ["🩺", "ควรไปหาหมอไหม และไปเมื่อไหร่"],
            ["🏠", "คำแนะนำดูแลตัวเองและคนใกล้ชิด"],
          ].map(([icon, t]) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-2.5 text-[15px] shadow-sm">
              <span className="text-xl" aria-hidden>
                {icon}
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2.5 rounded-2xl bg-surface p-3 shadow-sm">
        <div className="text-left text-sm font-semibold">ก่อนเริ่ม: เลือกสิ่งที่ยินยอม (ตัวเลือกเสริมไม่บังคับ)</div>
        <p className="text-left text-xs leading-relaxed text-ink-2">
          ต้นแบบเพื่อสาธิต ไม่ใช่บริการจริง โปรดใช้ข้อมูลสมมติ
        </p>
        <ConsentCheck checked={processing} onChange={setProcessing} title="จำเป็น: ใช้คำตอบคำนวณผลคัดกรอง" detail="ไม่รวมการบันทึกหรือส่งให้ AI" />
        <ConsentCheck checked={store} onChange={setStore} disabled={publicDemo} title="บันทึกรายงานให้เจ้าหน้าที่" detail={publicDemo ? "ปิดในเว็บเดโม" : "เก็บคำตอบและบทสนทนาไว้บนแดชบอร์ด"} />
        <ConsentCheck checked={ai} onChange={setAi} disabled={!aiAvailable} title="ให้ AI ช่วยอ่านอาการ" detail={aiAvailable ? "ส่งข้อความอาการที่พิมพ์ไปยัง OpenAI เพื่อช่วยแยกข้อมูล ถ้าไม่เลือกจะใช้การจับคำออฟไลน์" : "ยังไม่พร้อม ใช้การจับคำออฟไลน์แทน"} />
        <ConsentCheck
          checked={openAiVoice}
          onChange={setOpenAiVoice}
          disabled={!openAiVoiceAvailable}
          title="ให้เสียง AI อ่านคำถาม"
          detail={openAiVoiceAvailable ? "ส่งเฉพาะข้อความที่กดอ่านไปยัง OpenAI" : "ยังไม่พร้อม ใช้เสียงจากเครื่องแทนได้"}
        />
        <ConsentCheck checked={microphone} onChange={setMicrophone} title="พูดผ่านไมโครโฟน" detail="ฟังเฉพาะตอนกดปุ่มไมค์ เบราว์เซอร์เป็นผู้แปลงเสียง" />
        {publicDemo && <p className="rounded-lg bg-blue-soft px-3 py-2 text-xs leading-relaxed text-ink-2">เว็บเดโมไม่บันทึกคำตอบ</p>}
        <button onClick={() => begin(true)} disabled={!processing} className="press w-full rounded-2xl bg-brand py-3.5 text-lg font-semibold text-white shadow-md shadow-brand/20 disabled:cursor-not-allowed disabled:opacity-40">
          ยินยอมและเริ่มประเมิน
        </button>
        <button onClick={() => begin(false)} className="w-full rounded-xl border border-line py-2.5 text-sm text-ink-2">
          ไม่ยินยอม ขอดูคำแนะนำทั่วไป
        </button>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-center text-[11px] text-muted">ผลนี้เป็นการคัดกรองเบื้องต้นตามนิยามโรคของกรมควบคุมโรค ไม่ใช่การวินิจฉัยของแพทย์</p>
        <div className="flex justify-center pt-1">
          <ShareButtons compact />
        </div>
      </div>
    </div>
  );
}

function ConsentCheck({
  checked,
  onChange,
  title,
  detail,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-2.5 text-left ${disabled ? "opacity-55" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
      <span>
        <span className="block text-[13px] font-medium leading-snug">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{detail}</span>
      </span>
    </label>
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
  return { disease: "unknown", surveillanceCode: "—", meetsClinical: false, clinicalReason: "", classification: "not_case", urgency: "selfcare", highRisk: [], alerts: [] };
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

function Bubble({ m, showAvatar, onRestart, onSpeak, voiceLabel }: { m: Msg; showAvatar: boolean; onRestart: () => void; onSpeak: (text: string) => void; voiceLabel: string }) {
  if (m.from === "user")
    return (
      <div className="rise ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-[16px] text-white">
        <div className="whitespace-pre-wrap">{m.text}</div>
        <button type="button" onClick={() => onSpeak(`ทวนคำตอบ: ${m.text}`)} className="mt-2 rounded-full border border-white/40 px-3 py-1 text-xs text-white">🔊 ทวนคำตอบ</button>
      </div>
    );
  if (m.from === "bot")
    return (
      <div className="rise flex items-end gap-2">
        <span className="w-8 shrink-0">{showAvatar && <Mascot mood="happy" size={32} />}</span>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-[16px] leading-relaxed shadow-sm">
          <div className="whitespace-pre-wrap">{m.text}</div>
          <button type="button" onClick={() => onSpeak(m.text)} className="mt-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">{voiceLabel}</button>
        </div>
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
          <button type="button" onClick={() => onSpeak(`ผมเข้าใจว่าคุณมี ${m.items.map((it) => `${FIELD_LABEL[it.key]} ${it.value}`).join(" และ ")}`)} className="mt-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">🔊 ทวนสิ่งที่เข้าใจ</button>
          <div className="mt-2 text-xs text-muted">ถ้าไม่ถูก กด “เริ่มใหม่” ด้านบนได้เลย</div>
        </div>
      </div>
    );
  return (
    <div data-result className="scroll-mt-3">
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => onSpeak(`${m.assessment.urgency === "emergency" ? "ไปห้องฉุกเฉินทันที หรือโทร 1669" : m.assessment.urgency === "urgent" ? "ควรไปพบแพทย์วันนี้" : m.assessment.urgency === "soon" ? "ควรไปพบแพทย์ภายใน 24 ชั่วโมง" : "ผลคัดกรองเบื้องต้น"}. ${m.assessment.clinicalReason}. ผลนี้ไม่ใช่การวินิจฉัย โปรดพบแพทย์หากอาการรุนแรง`) } className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2">{voiceLabel}</button>
      </div>
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
