// Prototype storage: a JSON file (data/cases.json), falling back to memory where the disk is read-only (e.g. Vercel).
// Mock data is generated relative to today, so the demo always looks current.
import { promises as fs } from "fs";
import path from "path";
import type { Answers, CaseRecord, Evidence } from "./types";
import { addDays, assess, todayISO } from "./flu/rules";

const FILE = path.join(process.cwd(), "data", "cases.json");
let memory: CaseRecord[] | null = null;

type Seed = [number, number, "M" | "F", Partial<Answers>, string];

function seed(today: string): CaseRecord[] {
  const school = { sickContact: "school" as const, placeName: "โรงเรียนบ้านหนองแวง", province: "ขอนแก่น", district: "เมืองขอนแก่น" };
  const flu = ["fever", "cough", "sore_throat", "myalgia", "headache"] as const;
  const rows: Seed[] = [
    // [onset days ago, age, sex, extra, what the person typed]
    [6, 9, "M", { ...school, symptoms: [...flu], placeSickCount: 4 }, "ลูกชายไข้สูง ไอ เจ็บคอ ปวดหัว เพื่อนในห้องเป็นหลายคน"],
    [5, 10, "F", { ...school, symptoms: ["fever", "cough", "runny_nose", "fatigue"] }, "ไข้ ไอ น้ำมูก เพลีย"],
    [5, 8, "M", { ...school, symptoms: ["fever", "cough", "headache"], test: "rapid_pos_a" }, "ไข้ ไอ ปวดหัว ตรวจชุดตรวจเจอ A"],
    [4, 11, "F", { ...school, symptoms: [...flu], placeSickCount: 10 }, "ไข้ 39 ไอ เจ็บคอ ปวดตัว ที่โรงเรียนป่วยกันเยอะ"],
    [4, 9, "M", { ...school, symptoms: ["fever", "cough", "sore_throat"] }, "ไข้ ไอ เจ็บคอ"],
    [3, 10, "M", { ...school, symptoms: ["fever", "cough", "myalgia", "fatigue"], status: "better" }, "ไข้ ไอ ปวดเมื่อย ดีขึ้นแล้ว"],
    [3, 42, "F", { ...school, symptoms: ["fever", "cough", "headache", "myalgia"] }, "ครูประจำชั้น ไข้ ไอ ปวดหัว ปวดเมื่อย"],
    [2, 9, "F", { ...school, symptoms: ["fever", "cough", "runny_nose"], test: "rapid_pos_a" }, "ไข้ ไอ น้ำมูก ตรวจเจอ A"],
    [2, 8, "M", { ...school, symptoms: ["fever", "cough", "headache"], chronic: ["lung"] }, "ไข้ ไอ ปวดหัว เป็นหอบหืด"],
    [1, 10, "F", { ...school, symptoms: ["fever", "cough", "sore_throat", "fatigue"] }, "ไข้ ไอ เจ็บคอ เพลีย"],
    [1, 68, "F", { sickContact: "household", province: "ขอนแก่น", district: "เมืองขอนแก่น", symptoms: ["fever", "cough", "myalgia", "sputum"], chronic: ["diabetes"], redFlags: ["dyspnea"] }, "ยายไข้ ไอมีเสมหะ หายใจเหนื่อย หลานเป็นไข้หวัดจากโรงเรียน"],
    [3, 35, "M", { sickContact: "work", placeName: "โรงงานแปรรูปอาหาร", province: "ขอนแก่น", district: "บ้านไผ่", symptoms: [...flu] }, "ไข้ ไอ เจ็บคอ ปวดตัว"],
    [2, 29, "F", { sickContact: "work", placeName: "โรงงานแปรรูปอาหาร", province: "ขอนแก่น", district: "บ้านไผ่", symptoms: ["fever", "cough", "fatigue"] }, "ไข้ ไอ เพลีย"],
    [2, 51, "M", { sickContact: "none", province: "ขอนแก่น", district: "ชุมแพ", symptoms: ["fever", "cough", "myalgia"], poultry: true }, "ไข้ ไอ ปวดตัว ไก่ที่บ้านตายหลายตัว"],
    [8, 27, "F", { sickContact: "none", province: "ขอนแก่น", district: "เมืองขอนแก่น", symptoms: ["cough", "runny_nose"] }, "ไอ น้ำมูก ไม่มีไข้"],
    [10, 33, "M", { sickContact: "household", province: "ขอนแก่น", district: "น้ำพอง", symptoms: [...flu], status: "recovered" }, "ไข้ ไอ ปวดหัว หายแล้ว"],
    [12, 45, "F", { sickContact: "unknown", province: "ขอนแก่น", district: "เมืองขอนแก่น", symptoms: ["fever", "cough", "headache"], status: "recovered", vaccinated: "yes_1y" }, "ไข้ ไอ ปวดหัว หายแล้ว"],
    [0, 7, "M", { ...school, symptoms: ["fever", "cough", "sore_throat"] }, "ไข้ ไอ เจ็บคอ เริ่มวันนี้"],
  ];
  return rows.map(([ago, age, sex, extra, said], i) => {
    const answers: Answers = {
      consent: true,
      status: "sick",
      redFlags: [],
      chronic: [],
      poultry: false,
      travel: false,
      hcw: false,
      vaccinated: "no",
      test: "none",
      ...extra,
      onsetDate: addDays(today, -ago),
      age,
      sex,
    };
    const evidence: Evidence = {};
    for (const k of Object.keys(answers) as (keyof Answers)[]) evidence[k] = { quote: k === "symptoms" ? said : "(ข้อมูลสมมติ)", via: k === "symptoms" ? "text" : "button" };
    return {
      id: `D${String(i + 1).padStart(3, "0")}`,
      createdAt: new Date(Date.now() - ago * 86400000 + 3600000 * (8 + (i % 8))).toISOString(),
      demo: true,
      answers,
      evidence,
      transcript: [{ role: "user" as const, text: said }],
      assessment: assess(answers, today),
      review: "pending" as const,
    };
  });
}

async function load(): Promise<CaseRecord[]> {
  if (memory) return memory;
  try {
    memory = JSON.parse(await fs.readFile(FILE, "utf8")) as CaseRecord[];
  } catch {
    memory = seed(todayISO());
    await save();
  }
  return memory;
}

async function save() {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(memory, null, 1));
  } catch {
    /* read-only filesystem: keep in memory */
  }
}

export async function listCases(): Promise<CaseRecord[]> {
  return [...(await load())].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addCase(c: Omit<CaseRecord, "id">): Promise<CaseRecord> {
  const all = await load();
  const n = all.filter((x) => !x.demo).length + 1;
  const rec = { ...c, id: `C${String(n).padStart(3, "0")}` };
  all.push(rec);
  await save();
  return rec;
}

export async function updateReview(id: string, review: CaseRecord["review"]) {
  const all = await load();
  const c = all.find((x) => x.id === id);
  if (c) c.review = review;
  await save();
  return c;
}

/** Citizen reports a home test result later — re-run the rules so classification updates on the dashboard. */
export async function updateTest(id: string, test: Answers["test"]) {
  const all = await load();
  const c = all.find((x) => x.id === id);
  if (!c) return undefined;
  c.answers = { ...c.answers, test };
  c.evidence = { ...c.evidence, test: { quote: "แจ้งผลตรวจภายหลัง", via: "button" } };
  c.assessment = assess(c.answers, todayISO());
  await save();
  return c;
}

export async function resetDemo() {
  memory = seed(todayISO());
  await save();
}
