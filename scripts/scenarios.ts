// Real-world scenario checks for the pitch: run with `npx jiti scripts/scenarios.ts` (offline keyword mode).
// Each case says what a person would actually type/say and what the system must catch. Failures are kept on purpose.
import { keywordExtract, postCheck } from "../lib/extract";
import type { Answers } from "../lib/types";

type Case = { id: string; region: string; text: string; expect: Partial<Record<keyof Answers, unknown>> };

const today = "2026-11-21";
const CASES: Case[] = [
  { id: "S1-กลาง", region: "ภาษากลาง (ควบคุม)", text: "ไข้ 39 ไอ ปวดหัว ปวดตัว เริ่มเมื่อวาน ที่โรงเรียนเป็นหลายคน", expect: { symptoms: ["fever", "cough", "headache", "myalgia"], onsetDate: "2026-11-20", sickContact: "school" } },
  { id: "S1-อีสาน-1", region: "อีสาน", text: "เป็นไข้ตัวฮ้อนตั้งแต่มื้อวาน เจ็บหัว ไอโค้กๆ", expect: { symptoms: ["fever", "headache", "cough"], onsetDate: "2026-11-20" } },
  { id: "S1-อีสาน-2", region: "อีสาน", text: "บ่สบายมาสองมื้อแล้ว ปวดแข้งปวดขา ไอ บ่มีแฮง", expect: { symptoms: ["cough", "myalgia", "fatigue"], onsetDate: "2026-11-19" } },
  { id: "S1-เหนือ", region: "เหนือ", text: "ไข้ ตัวฮ้อน เจ็บหัว ไอ๋ เป็นตั้งแต่มื้อวาน", expect: { symptoms: ["fever", "headache", "cough"], onsetDate: "2026-11-20" } },
  { id: "S1-ใต้", region: "ใต้", text: "ไข้ ตัวร้อน ไอ หัวตื้อ เจ็บคอ เป็นแต่วานนี้", expect: { symptoms: ["fever", "cough", "sore_throat"], onsetDate: "2026-11-20" } },
];

function check(c: Case) {
  const { answers, evidence } = keywordExtract(c.text, today);
  postCheck(c.text, answers, evidence);
  const misses: string[] = [];
  for (const [k, want] of Object.entries(c.expect)) {
    const got = (answers as Record<string, unknown>)[k];
    if (Array.isArray(want)) {
      const lack = want.filter((w) => !(Array.isArray(got) && got.includes(w)));
      if (lack.length) misses.push(`${k}: ขาด ${lack.join(",")}`);
    } else if (got !== want) misses.push(`${k}: ได้ ${JSON.stringify(got)} ควรเป็น ${JSON.stringify(want)}`);
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
