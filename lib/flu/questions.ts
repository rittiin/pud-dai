// Screening questions, adapted from the DDC SARI_AI 2 form into plain language.
// The chat asks only what is still missing, so anything the person already said in free text is skipped.
import type { AnswerKey, Answers, Chronic, RedFlag, Sym } from "../types";
import { CHRONIC_LABEL, RED_FLAG_LABEL, SYM_LABEL } from "./knowledge";

export interface Option {
  label: string;
  value: unknown;
  exclusive?: boolean; // clears other choices in a multi-select ("none of these")
}

export interface Question {
  key: AnswerKey;
  kind: "single" | "multi" | "date" | "number" | "text";
  prompt: (a: Answers) => string;
  hint?: string;
  options?: Option[];
  optional?: boolean;
  ask: (a: Answers) => boolean;
  formRef: string; // which part of the SARI_AI 2 form this question fills
}

const symOrder: Sym[] = ["fever", "cough", "sore_throat", "runny_nose", "myalgia", "headache", "fatigue", "chills", "sputum", "diarrhea"];
const flagOrder: RedFlag[] = ["dyspnea", "chest_pain", "confusion", "cyanosis", "cannot_drink", "seizure", "worse_again", "high_fever_3d"];
const chronicOrder: Chronic[] = ["lung", "heart", "diabetes", "kidney", "liver", "immuno", "cancer", "obesity", "neuro"];

const sick = (a: Answers) => a.consent === true && (a.symptoms?.length ?? 0) > 0;
const yesNo: Option[] = [
  { label: "ไม่มี", value: false },
  { label: "มี", value: true },
];

export const QUESTIONS: Question[] = [
  {
    key: "consent",
    kind: "single",
    formRef: "PDPA",
    prompt: () =>
      "สวัสดีครับ ผมชื่อ “พูดได้” ผู้ช่วยประเมินอาการไข้หวัดใหญ่ของกรมควบคุมโรค (ต้นแบบ)\n\nคำตอบของคุณจะใช้เพื่อให้คำแนะนำ และส่งให้เจ้าหน้าที่ควบคุมโรคใช้เฝ้าระวังการระบาดในพื้นที่ ข้อมูลจะไม่ถูกเปิดเผยเป็นรายบุคคล\n\nยินยอมให้ใช้ข้อมูลไหมครับ?",
    options: [
      { label: "ยินยอม เริ่มเลย", value: true },
      { label: "ไม่ยินยอม", value: false },
    ],
    ask: () => true,
  },
  {
    key: "symptoms",
    kind: "multi",
    formRef: "2.2 อาการและอาการแสดง",
    prompt: () => "ตอนนี้หรือช่วงที่ป่วย มีอาการอะไรบ้างครับ (เลือกได้หลายข้อ)",
    options: [...symOrder.map((s) => ({ label: SYM_LABEL[s], value: s })), { label: "ไม่มีอาการเหล่านี้", value: "__none", exclusive: true }],
    ask: (a) => a.consent === true,
  },
  {
    key: "onsetDate",
    kind: "date",
    formRef: "2.2 วันที่เริ่มป่วย",
    prompt: () => "เริ่มมีอาการวันไหนครับ",
    ask: sick,
  },
  {
    key: "status",
    kind: "single",
    formRef: "5. ผลการรักษา",
    prompt: () => "ตอนนี้อาการเป็นอย่างไรบ้างครับ",
    options: [
      { label: "ยังป่วยอยู่", value: "sick" },
      { label: "ดีขึ้นแล้ว", value: "better" },
      { label: "หายแล้ว", value: "recovered" },
    ],
    ask: sick,
  },
  {
    key: "redFlags",
    kind: "multi",
    formRef: "สัญญาณอันตราย (ปอดอักเสบแทรกซ้อน)",
    prompt: () => "มีอาการต่อไปนี้ไหมครับ ข้อนี้สำคัญมาก",
    options: [...flagOrder.map((f) => ({ label: RED_FLAG_LABEL[f], value: f })), { label: "ไม่มีเลย", value: "__none", exclusive: true }],
    ask: (a) => sick(a) && a.status !== "recovered",
  },
  {
    key: "age",
    kind: "number",
    formRef: "1. ข้อมูลทั่วไป: อายุ",
    prompt: () => "ผู้ป่วยอายุเท่าไหร่ครับ (ถ้าตอบแทนคนอื่น เช่น ลูกหรือพ่อแม่ ให้ใส่อายุของผู้ป่วย)",
    hint: "พิมพ์ตัวเลข เช่น 34",
    ask: sick,
  },
  {
    key: "sex",
    kind: "single",
    formRef: "1. ข้อมูลทั่วไป: เพศ",
    prompt: () => "เพศของผู้ป่วยครับ",
    options: [
      { label: "ชาย", value: "M" },
      { label: "หญิง", value: "F" },
    ],
    ask: sick,
  },
  {
    key: "pregnant",
    kind: "single",
    formRef: "4.1 ตั้งครรภ์",
    prompt: () => "ตอนนี้ตั้งครรภ์อยู่ไหมครับ",
    options: [
      { label: "ไม่ได้ตั้งครรภ์", value: false },
      { label: "ตั้งครรภ์", value: true },
    ],
    ask: (a) => sick(a) && a.sex === "F" && (a.age ?? 0) >= 12 && (a.age ?? 99) <= 50,
  },
  {
    key: "chronic",
    kind: "multi",
    formRef: "4.1 โรคประจำตัว",
    prompt: () => "มีโรคประจำตัวไหมครับ",
    options: [{ label: "ไม่มี", value: "__none", exclusive: true }, ...chronicOrder.map((c) => ({ label: CHRONIC_LABEL[c], value: c }))],
    ask: sick,
  },
  {
    key: "sickContact",
    kind: "single",
    formRef: "6.6 / 6.9 ผู้ป่วยอาการคล้ายกัน",
    prompt: () => "ช่วง 1 สัปดาห์ก่อนป่วย มีคนรอบตัวป่วยแบบเดียวกันไหมครับ",
    options: [
      { label: "คนในบ้าน", value: "household" },
      { label: "ที่โรงเรียน", value: "school" },
      { label: "ที่ทำงาน", value: "work" },
      { label: "ที่อื่น", value: "other" },
      { label: "ไม่มี", value: "none" },
      { label: "ไม่แน่ใจ", value: "unknown" },
    ],
    ask: sick,
  },
  {
    key: "placeName",
    kind: "text",
    formRef: "สถานที่ศึกษา/ทำงาน",
    prompt: (a) =>
      a.sickContact === "school" ? "โรงเรียนชื่ออะไรครับ" : a.sickContact === "work" ? "ที่ทำงานชื่ออะไรครับ" : "สถานที่นั้นชื่ออะไรครับ",
    hint: "เช่น โรงเรียนบ้านหนองแวง",
    ask: (a) => sick(a) && ["school", "work", "other"].includes(a.sickContact ?? ""),
  },
  {
    key: "placeSickCount",
    kind: "single",
    formRef: "6.9 ผู้ป่วยเป็นกลุ่มก้อน",
    prompt: (a) => `ที่${a.placeName ?? "นั่น"} มีคนป่วยประมาณกี่คนครับ (เท่าที่ทราบ)`,
    options: [
      { label: "1–2 คน", value: 2 },
      { label: "3–4 คน", value: 4 },
      { label: "5–9 คน", value: 5 },
      { label: "10 คนขึ้นไป", value: 10 },
      { label: "ไม่ทราบ", value: null },
    ],
    ask: (a) => sick(a) && !!a.placeName,
  },
  {
    key: "poultry",
    kind: "single",
    formRef: "6.1–6.3 สัมผัสสัตว์ปีก",
    prompt: () => "ช่วง 14 วันก่อนป่วย ได้จับ ชำแหละ หรืออยู่ใกล้ไก่ เป็ด หรือนกที่ป่วยหรือตายผิดปกติไหมครับ",
    options: yesNo,
    ask: sick,
  },
  {
    key: "travel",
    kind: "single",
    formRef: "6.5 เดินทางจากพื้นที่ระบาด",
    prompt: () => "ช่วง 14 วันก่อนป่วย เดินทางไปต่างประเทศหรือพื้นที่ที่มีการระบาดไหมครับ",
    options: yesNo,
    ask: sick,
  },
  {
    key: "hcw",
    kind: "single",
    formRef: "6.8 บุคลากรทางการแพทย์",
    prompt: () => "ผู้ป่วยทำงานในโรงพยาบาลหรือสถานพยาบาลไหมครับ",
    options: [
      { label: "ไม่ใช่", value: false },
      { label: "ใช่", value: true },
    ],
    ask: sick,
  },
  {
    key: "vaccinated",
    kind: "single",
    formRef: "4.4 วัคซีนไข้หวัดใหญ่",
    prompt: () => "เคยฉีดวัคซีนไข้หวัดใหญ่ไหมครับ",
    options: [
      { label: "ฉีดภายใน 1 ปีนี้", value: "yes_1y" },
      { label: "เคยฉีด นานกว่า 1 ปี", value: "yes_old" },
      { label: "ไม่เคยฉีด", value: "no" },
      { label: "จำไม่ได้", value: "unknown" },
    ],
    ask: sick,
  },
  {
    key: "test",
    kind: "single",
    formRef: "3.10 ผลตรวจทางห้องปฏิบัติการ",
    prompt: () => "ได้ตรวจหาเชื้อไข้หวัดใหญ่แล้วหรือยังครับ",
    options: [
      { label: "ยังไม่ได้ตรวจ", value: "none" },
      { label: "ชุดตรวจเร็ว: เจอสายพันธุ์ A", value: "rapid_pos_a" },
      { label: "ชุดตรวจเร็ว: เจอสายพันธุ์ B", value: "rapid_pos_b" },
      { label: "โรงพยาบาลยืนยันด้วย RT-PCR", value: "pcr_pos" },
      { label: "ตรวจแล้วไม่เจอเชื้อ", value: "neg" },
    ],
    ask: sick,
  },
  {
    key: "province",
    kind: "text",
    formRef: "ที่อยู่ขณะป่วย: จังหวัด",
    prompt: () => "ขณะป่วยอยู่จังหวัดอะไรครับ",
    hint: "เช่น ขอนแก่น",
    ask: sick,
  },
  {
    key: "district",
    kind: "text",
    formRef: "ที่อยู่ขณะป่วย: อำเภอ",
    prompt: () => "อำเภอหรือเขตอะไรครับ",
    hint: "เช่น เมืองขอนแก่น",
    ask: sick,
  },
  {
    key: "phone",
    kind: "text",
    formRef: "หมายเลขโทรศัพท์",
    prompt: () => "ถ้าต้องการให้เจ้าหน้าที่โทรติดตามอาการ ใส่เบอร์โทรได้ครับ (ไม่บังคับ)",
    hint: "เช่น 0812345678",
    optional: true,
    ask: sick,
  },
];

export function nextQuestion(a: Answers): Question | null {
  if (a.consent === false) return null;
  if (a.consent === true && a.symptoms && a.symptoms.length === 0) return null;
  for (const q of QUESTIONS) {
    if (a[q.key] === undefined && q.ask(a)) return q;
  }
  return null;
}

export function progress(a: Answers): { done: number; total: number } {
  const relevant = QUESTIONS.filter((q) => q.ask(a));
  return { done: relevant.filter((q) => a[q.key] !== undefined).length, total: relevant.length };
}
