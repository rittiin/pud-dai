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

const symOrder: Sym[] = ["fever", "cough", "sore_throat", "runny_nose", "myalgia", "headache", "fatigue", "chills", "sputum", "diarrhea", "vomiting", "abdominal_pain", "bloody_stool"];
const flagOrder: RedFlag[] = ["dyspnea", "chest_pain", "confusion", "cyanosis", "cannot_drink", "seizure", "worse_again", "high_fever_3d", "severe_dehydration"];
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
      "สวัสดีครับ ผมชื่อน้องพูดได้ ต้นแบบคัดกรอง 3 โรค: ไข้หวัดใหญ่ อุจจาระร่วงเฉียบพลัน และอาหารเป็นพิษ\n\nระบบเดโมสาธารณะปิดการเรียก AI ภายนอกและไม่บันทึกรายงาน อย่ากรอกชื่อ เลขบัตร หรือข้อมูลที่ระบุตัวบุคคลได้ หากนำระบบไปเปิดใช้งานจริง ผู้ดูแลต้องแจ้งวัตถุประสงค์ ระยะเวลาเก็บข้อมูล และผู้ให้บริการที่ประมวลผลก่อนขอความยินยอม\n\nคำศัพท์ภาษาถิ่นจะไม่ถูกเก็บจากบทสนทนา หากต้องการส่งคำเสนอให้ตรวจ จะถามความยินยอมแยกต่างหากครับ\n\nยินยอมให้ใช้คำตอบเพื่อการคัดกรองในเดโมไหมครับ?",
    options: [
      { label: "ยินยอม เริ่มเลย", value: true },
      { label: "ไม่ยินยอม", value: false },
    ],
    ask: () => true,
  },
  {
    key: "diseaseFocus",
    kind: "single",
    formRef: "เป้าหมายการคัดกรอง (ไม่ใช่การวินิจฉัย)",
    prompt: () => "ต้องการคัดกรองกลุ่มโรคใดครับ? อาการเป็นเพียงข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัย",
    options: [
      { label: "ไข้หวัดใหญ่", value: "flu" },
      { label: "อุจจาระร่วงเฉียบพลัน", value: "acute_diarrhea" },
      { label: "อาหารเป็นพิษ", value: "food_poisoning" },
      { label: "ไม่แน่ใจ", value: "unknown" },
    ],
    ask: (a) => a.consent === true,
  },
  {
    key: "symptoms",
    kind: "multi",
    formRef: "2.2 อาการและอาการแสดง",
    prompt: (a) => a.diseaseFocus === "acute_diarrhea" || a.diseaseFocus === "food_poisoning"
      ? "ตอนนี้หรือช่วงที่ป่วย มีอาการอะไรบ้างครับ โดยเฉพาะอาการทางท้อง (เลือกได้หลายข้อ)"
      : "ตอนนี้หรือช่วงที่ป่วย มีอาการอะไรบ้างครับ (เลือกได้หลายข้อ)",
    options: [...symOrder.map((s) => ({ label: SYM_LABEL[s], value: s })), { label: "ไม่มีอาการเหล่านี้", value: "__none", exclusive: true }],
    ask: (a) => a.consent === true,
  },
  {
    key: "stoolCount",
    kind: "number",
    formRef: "จำนวนครั้งที่ถ่ายเหลวใน 24 ชั่วโมง",
    prompt: () => "ใน 24 ชั่วโมงที่ผ่านมา ถ่ายเหลวกี่ครั้งครับ?",
    hint: "จำนวนครั้ง เช่น 3",
    ask: (a) => sick(a) && (a.diseaseFocus === "acute_diarrhea" || a.diseaseFocus === "unknown") && (a.symptoms ?? []).includes("diarrhea"),
  },
  {
    key: "sharedMeal",
    kind: "single",
    formRef: "ประวัติรับประทานอาหารร่วมกัน",
    prompt: () => "ก่อนเริ่มป่วย ได้รับประทานอาหารมื้อเดียวกันกับคนอื่นที่มีอาการคล้ายกันไหมครับ?",
    options: [{ label: "ใช่", value: true }, { label: "ไม่ใช่", value: false }, { label: "ไม่แน่ใจ", value: null }],
    ask: (a) => sick(a) && (a.diseaseFocus === "food_poisoning" || a.diseaseFocus === "unknown") && (a.symptoms ?? []).some((s) => ["diarrhea", "vomiting", "abdominal_pain"].includes(s)),
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
    formRef: "สัญญาณอันตราย",
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
    ask: (a) => sick(a) && a.diseaseFocus === "flu",
  },
  {
    key: "travel",
    kind: "single",
    formRef: "6.5 เดินทางจากพื้นที่ระบาด",
    prompt: () => "ช่วง 14 วันก่อนป่วย เดินทางไปต่างประเทศหรือพื้นที่ที่มีการระบาดไหมครับ",
    options: yesNo,
    ask: (a) => sick(a) && a.diseaseFocus === "flu",
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
    ask: (a) => sick(a) && a.diseaseFocus === "flu",
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
    ask: (a) => sick(a) && a.diseaseFocus === "flu",
  },
  {
    key: "test",
    kind: "single",
    formRef: "3.10 ผลตรวจทางห้องปฏิบัติการ",
    prompt: () => "ได้รับผลตรวจไข้หวัดใหญ่หรือยังครับ",
    options: [
      { label: "ยังไม่ได้ตรวจ", value: "none" },
      { label: "ชุดตรวจเร็ว: เจอสายพันธุ์ A", value: "rapid_pos_a" },
      { label: "ชุดตรวจเร็ว: เจอสายพันธุ์ B", value: "rapid_pos_b" },
      { label: "โรงพยาบาลยืนยันไข้หวัดใหญ่ด้วย RT-PCR", value: "pcr_pos" },
      { label: "ตรวจแล้วไม่เจอเชื้อ", value: "neg" },
    ],
    ask: (a) => sick(a) && a.diseaseFocus === "flu",
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
