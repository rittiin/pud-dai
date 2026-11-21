// End-to-end checks for scenarios 2 (test-kit link) and 3 (report → dashboard → trace back).
// Needs the app running: `npm run dev`, then `BASE=http://localhost:3000 npx jiti scripts/e2e.ts`.
// Writes real cases into data/cases.json — reset demo data afterwards.
import { assess, addDays, todayISO } from "../lib/flu/rules";
import type { Answers } from "../lib/types";

const BASE = process.env.BASE ?? "http://localhost:3000";
const results: { id: string; ok: boolean; note: string }[] = [];
const rec = (id: string, ok: boolean, note: string) => {
  results.push({ id, ok, note });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"} ${id} — ${note}`);
};

// Same rule as components/CareFinder.tsx (showKit). Keep in sync.
function showKit(a: Answers) {
  const r = assess(a);
  const tested = a.test && a.test !== "none";
  return r.urgency !== "recovered" && r.urgency !== "emergency" && !tested && r.meetsClinical;
}

const today = todayISO();
const base: Answers = {
  consent: true, status: "sick", symptoms: ["fever", "cough", "myalgia"], feverTemp: 38.8,
  onsetDate: addDays(today, -1), redFlags: [], chronic: [], poultry: false, travel: false, hcw: false,
  vaccinated: "no", age: 30, sex: "F", province: "ขอนแก่น", district: "เมืองขอนแก่น", sickContact: "none",
} as Answers;

// ---------- Scenario 2: test-kit link only when appropriate ----------
const kitCases: [string, Partial<Answers>, boolean][] = [
  ["S2-a ยังไม่ได้ตรวจ อาการเข้าเกณฑ์", { test: "none" }, true],
  ["S2-b ตรวจแล้วเจอ A", { test: "rapid_pos_a" }, false],
  ["S2-c ภาวะฉุกเฉิน (หายใจลำบาก)", { test: "none", redFlags: ["dyspnea"] }, false],
  ["S2-d หายแล้ว", { test: "none", status: "recovered" }, false],
  ["S2-e อาการไม่เข้าเกณฑ์ (น้ำมูกอย่างเดียว)", { test: "none", symptoms: ["runny_nose"], feverTemp: undefined }, false],
];
for (const [id, patch, want] of kitCases) {
  const got = showKit({ ...base, ...patch } as Answers);
  rec(id, got === want, `แสดงการ์ดชุดตรวจ=${got} (ควรเป็น ${want})`);
}

// ---------- Scenario 3: report → dashboard → trace back ----------
async function api(method: string, body?: unknown) {
  const r = await fetch(`${BASE}/api/cases`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

(async () => {
  const said = "ไข้ 38.8 ไอ ปวดตัว เริ่มเมื่อวาน";
  const transcript = [
    { role: "bot", text: "เล่าอาการให้ฟังหน่อยครับ" },
    { role: "user", text: said },
  ];
  const evidence = {
    symptoms: { quote: said, via: "text" }, feverTemp: { quote: "ไข้ 38.8", via: "text" },
    onsetDate: { quote: "เริ่มเมื่อวาน", via: "text" }, consent: { quote: "ยินยอม", via: "button" },
  };
  const post = await api("POST", { answers: { ...base, test: "none" }, evidence, transcript });
  rec("S3-a ส่งรายงานแล้วบันทึกได้", post.stored === true && !!post.id, `id=${post.id} classification=${post.assessment?.classification}`);

  const { cases } = await api("GET");
  const c = cases.find((x: { id: string }) => x.id === post.id);
  rec("S3-b เคสขึ้นบน Dashboard", !!c, c ? `พบ ${c.id} สถานะรีวิว=${c.review}` : "ไม่พบเคส");
  rec("S3-c ย้อนดูหลักฐานได้ทุกช่องที่พิมพ์มา", !!c && ["symptoms", "feverTemp", "onsetDate"].every((k) => c.evidence?.[k]?.quote),
    c ? `feverTemp ← “${c.evidence?.feverTemp?.quote}”, onsetDate ← “${c.evidence?.onsetDate?.quote}”` : "-");
  rec("S3-d เห็นบทสนทนาเดิม", !!c && c.transcript?.some((t: { text: string }) => t.text === said), `${c?.transcript?.length ?? 0} ข้อความ`);

  const patched = await api("PATCH", { id: post.id, test: "rapid_pos_a" });
  const after = (await api("GET")).cases.find((x: { id: string }) => x.id === post.id);
  rec("S3-e แจ้งผล ATK ภายหลัง → อัปเดตบน Dashboard", patched.ok && after?.answers.test === "rapid_pos_a",
    `${post.assessment?.classification} → ${after?.assessment.classification}, หลักฐาน “${after?.evidence?.test?.quote}”`);

  const rv = await api("PATCH", { id: post.id, review: "verified" });
  rec("S3-f เจ้าหน้าที่กดยืนยันเคสได้", rv.case?.review === "verified", `review=${rv.case?.review}`);

  const noConsent = await api("POST", { answers: { ...base, consent: false }, evidence, transcript });
  rec("S3-g ไม่ยินยอม → ไม่บันทึกเข้าระบบ", noConsent.stored === false, `stored=${noConsent.stored}`);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nสรุป ${pass}/${results.length} ผ่าน`);
})();
