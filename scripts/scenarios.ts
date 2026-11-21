// Real-world scenario checks for the pitch: run with `npx jiti scripts/scenarios.ts` (offline keyword mode).
// Each case says what a person would actually type/say and what the system must catch. Failures are kept on purpose.
import { keywordExtract, postCheck } from "../lib/extract";
import { assess } from "../lib/flu/rules";
import type { Answers } from "../lib/types";

type Case = { id: string; region: string; text: string; expect: Partial<Record<keyof Answers, unknown>> };

const today = "2026-11-21";
const CASES: Case[] = [
  { id: "S1-กลาง", region: "ภาษากลาง (ควบคุม)", text: "ไข้ 39 ไอ ปวดหัว ปวดตัว เริ่มเมื่อวาน ที่โรงเรียนเป็นหลายคน", expect: { symptoms: ["fever", "cough", "headache", "myalgia"], onsetDate: "2026-11-20", sickContact: "school" } },
  { id: "S1-อีสาน-1", region: "อีสาน", text: "เป็นไข้ตัวฮ้อนตั้งแต่มื้อวาน เจ็บหัว ไอโค้กๆ", expect: { symptoms: ["fever", "headache", "cough"], onsetDate: "2026-11-20" } },
  { id: "S1-อีสาน-2", region: "อีสาน", text: "บ่สบายมาสองมื้อแล้ว ปวดแข้งปวดขา ไอ บ่มีแฮง", expect: { symptoms: ["cough", "myalgia", "fatigue"], onsetDate: "2026-11-19" } },
  { id: "S1-เหนือ", region: "เหนือ", text: "ไข้ ตัวฮ้อน เจ็บหัว ไอ๋ เป็นตั้งแต่มื้อวาน", expect: { symptoms: ["fever", "headache", "cough"], onsetDate: "2026-11-20" } },
  { id: "S1-ใต้", region: "ใต้", text: "ไข้ ตัวร้อน ไอ หัวตื้อ เจ็บคอ เป็นแต่วานนี้", expect: { symptoms: ["fever", "cough", "sore_throat"], onsetDate: "2026-11-20" } },
  { id: "S1-อีสาน-ปฏิเสธอาการ", region: "อีสาน", text: "บ่มีไข้ บ่ไอ", expect: { symptoms: [] } },
];

const norm = (s: string) => s.replace(/\s+/g, "").replace(/ํา/g, "ำ");

function check(c: Case) {
  const { answers, evidence } = keywordExtract(c.text, today);
  postCheck(c.text, answers, evidence);
  const misses: string[] = [];
  for (const [k, want] of Object.entries(c.expect)) {
    const got = (answers as Record<string, unknown>)[k];
    if (Array.isArray(want)) {
      const expected = [...want].sort();
      const actual = Array.isArray(got) ? [...got].sort() : [];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) misses.push(`${k}: ได้ ${JSON.stringify(actual)} ควรเป็น ${JSON.stringify(expected)}`);
    } else if (got !== want) misses.push(`${k}: ได้ ${JSON.stringify(got)} ควรเป็น ${JSON.stringify(want)}`);

    if (Array.isArray(want) ? want.length > 0 : true) {
      const quote = evidence[k as keyof Answers]?.quote;
      if (!quote) misses.push(`${k}: ไม่มีข้อความอ้างอิง`);
      else if (!norm(c.text).includes(norm(quote.replace(/^…|…$/g, "")))) misses.push(`${k}: ข้อความอ้างอิงไม่อยู่ในคำพูดต้นฉบับ`);
    }
  }
  return { answers, misses };
}

let pass = 0;
for (const c of CASES) {
  const r = check(c);
  if (!r.misses.length) pass++;
  console.log(`${r.misses.length ? "❌ FAIL" : "✅ PASS"} ${c.id} [${c.region}] "${c.text}"`);
  console.log(`   ได้: ${JSON.stringify(r.answers)}`);
  for (const m of r.misses) console.log(`   - ${m}`);
}
console.log(`\nสรุป ${pass}/${CASES.length} ผ่าน (keyword mode, ไม่ใช้ AI)`);
if (pass !== CASES.length) process.exitCode = 1;

const diseaseCases: { name: string; answers: Answers; code: string; classification: string }[] = [
  { name: "influenza uses code 506 15", answers: { diseaseFocus: "flu", symptoms: ["fever", "cough", "myalgia"] }, code: "506 15", classification: "suspected" },
  { name: "acute diarrhea requires three stools or bloody stool", answers: { diseaseFocus: "acute_diarrhea", symptoms: ["diarrhea"], stoolCount: 3 }, code: "506 02", classification: "suspected" },
  { name: "acute diarrhea: two stools is not enough", answers: { diseaseFocus: "acute_diarrhea", symptoms: ["diarrhea"], stoolCount: 2 }, code: "506 02", classification: "not_case" },
  { name: "acute diarrhea: one bloody stool is enough", answers: { diseaseFocus: "acute_diarrhea", symptoms: ["bloody_stool"] }, code: "506 02", classification: "suspected" },
  { name: "food poisoning: vomiting/abdominal pain + suspect food", answers: { diseaseFocus: "food_poisoning", symptoms: ["vomiting", "abdominal_pain"], sharedMeal: true }, code: "506 03", classification: "suspected" },
  { name: "food poisoning: diarrhoea alone does not meet DDC clinical criteria", answers: { diseaseFocus: "food_poisoning", symptoms: ["diarrhea"], sharedMeal: true }, code: "506 03", classification: "not_case" },
  { name: "food poisoning not classified without suspect-food history", answers: { diseaseFocus: "food_poisoning", symptoms: ["vomiting"], sharedMeal: null }, code: "506 03", classification: "not_case" },
  { name: "influenza: positive ATK without clinical criteria is not a case", answers: { diseaseFocus: "flu", symptoms: ["runny_nose"], test: "rapid_pos_a" }, code: "506 15", classification: "not_case" },
  { name: "influenza: clinical criteria + positive ATK is probable", answers: { diseaseFocus: "flu", symptoms: ["fever", "cough", "headache"], test: "rapid_pos_a" }, code: "506 15", classification: "probable" },
  { name: "influenza: clinical criteria + RT-PCR is confirmed", answers: { diseaseFocus: "flu", symptoms: ["fever", "cough", "fatigue"], test: "pcr_pos" }, code: "506 15", classification: "confirmed" },
];
let diseasePass = 0;
for (const scenario of diseaseCases) {
  const result = assess(scenario.answers);
  const ok = result.surveillanceCode === scenario.code && result.classification === scenario.classification;
  if (ok) diseasePass++;
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"} ${scenario.name}: ${result.surveillanceCode} / ${result.classification}`);
}
console.log(`สรุปคัดกรองโรค ${diseasePass}/${diseaseCases.length} ผ่าน`);
if (diseasePass !== diseaseCases.length) process.exitCode = 1;
