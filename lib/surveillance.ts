// Officer-side analytics. Everything here is plain code, so the numbers are reproducible.
import type { CaseRecord, DiseaseFocus } from "./types";
import { CASE_DEFINITION } from "./flu/knowledge";
import { CLASS_LABEL, daysBetween, thaiDate } from "./flu/rules";
import { describe } from "./labels";

export interface Cluster {
  key: string;
  disease: DiseaseFocus;
  place: string;
  province?: string;
  district?: string;
  cases: CaseRecord[];
  firstOnset: string;
  lastOnset: string;
  maxIn7Days: number;
  meetsOutbreak: boolean;
}

const normPlace = (s: string) => s.replace(/\s+/g, "").replace(/^(ร\.ร\.|รร\.?)/, "โรงเรียน").toLowerCase();

export function detectClusters(cases: CaseRecord[]): Cluster[] {
  const groups = new Map<string, CaseRecord[]>();
  for (const c of cases) {
    if (c.assessment.classification === "not_case" || !c.answers.placeName || !c.answers.onsetDate) continue;
    if (c.review === "dismissed") continue;
    const disease = c.assessment.disease ?? c.answers.diseaseFocus ?? "unknown";
    const k = `${disease}:${normPlace(c.answers.placeName)}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: Cluster[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.answers.onsetDate!.localeCompare(b.answers.onsetDate!));
    let max = 0;
    for (let i = 0; i < sorted.length; i++) {
      let j = i;
      while (j + 1 < sorted.length && daysBetween(sorted[i].answers.onsetDate!, sorted[j + 1].answers.onsetDate!) <= 6) j++;
      max = Math.max(max, j - i + 1);
    }
    out.push({
      key,
      disease: (key.split(":", 1)[0] as DiseaseFocus),
      place: sorted[0].answers.placeName!,
      province: sorted[0].answers.province,
      district: sorted[0].answers.district,
      cases: sorted,
      firstOnset: sorted[0].answers.onsetDate!,
      lastOnset: sorted[sorted.length - 1].answers.onsetDate!,
      maxIn7Days: max,
      // The 5-in-7-days outbreak threshold in the cited case definition is influenza-specific.
      meetsOutbreak: key.startsWith("flu:") && max >= 5,
    });
  }
  return out.sort((a, b) => b.maxIn7Days - a.maxIn7Days);
}

export function epiCurve(cases: CaseRecord[], from: string, to: string) {
  const n = daysBetween(from, to) + 1;
  const days = Array.from({ length: n }, (_, i) => {
    const [y, m, d] = from.split("-").map(Number);
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date: iso, count: 0 };
  });
  for (const c of cases) {
    if (c.assessment.classification === "not_case" || !c.answers.onsetDate) continue;
    const i = daysBetween(from, c.answers.onsetDate);
    if (i >= 0 && i < n) days[i].count++;
  }
  return days;
}

/** Facts only — handed to AI (or the template) so the report never contains invented numbers. */
export function clusterFacts(cl: Cluster, today: string): string {
  const cs = cl.cases;
  const ages = cs.map((c) => c.answers.age).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  const male = cs.filter((c) => c.answers.sex === "M").length;
  const byClass = Object.entries(
    cs.reduce<Record<string, number>>((acc, c) => ({ ...acc, [CLASS_LABEL[c.assessment.classification]]: (acc[CLASS_LABEL[c.assessment.classification]] ?? 0) + 1 }), {})
  )
    .map(([k, v]) => `${k} ${v} ราย`)
    .join(", ");
  const symCount = (s: string) => cs.filter((c) => c.answers.symptoms?.includes(s as never)).length;
  const highRisk = cs.filter((c) => c.assessment.highRisk.length);
  const severe = cs.filter((c) => c.assessment.urgency === "emergency");
  const vacc = cs.filter((c) => c.answers.vaccinated === "yes_1y").length;
  const tested = cs.filter((c) => c.answers.test && c.answers.test !== "none");
  return [
    `วันที่จัดทำ: ${thaiDate(today)}`,
    `สถานที่: ${cl.place} อ.${cl.district ?? "-"} จ.${cl.province ?? "-"}`,
    `จำนวนผู้ป่วยที่รายงานผ่านพูดได้: ${cs.length} ราย (${byClass})`,
    `ผู้ป่วยสูงสุดใน 7 วัน: ${cl.maxIn7Days} ราย ${cl.disease === "flu" ? `${cl.meetsOutbreak ? "→ เข้าเกณฑ์สอบสวนการระบาด" : "→ ยังไม่เข้าเกณฑ์สอบสวนการระบาด"} (${CASE_DEFINITION.outbreak})` : "(เป็นสัญญาณเฝ้าระวัง ยังไม่ใช่เกณฑ์ยืนยันการระบาด)"}`,
    `วันเริ่มป่วยรายแรก: ${thaiDate(cl.firstOnset)} รายล่าสุด: ${thaiDate(cl.lastOnset)}`,
    `อายุ: ${ages.length ? `${ages[0]}–${ages[ages.length - 1]} ปี (มัธยฐาน ${ages[Math.floor(ages.length / 2)]} ปี)` : "ไม่มีข้อมูล"} · ชาย ${male} หญิง ${cs.length - male}`,
    cl.disease === "flu"
      ? `อาการ: ไข้ ${symCount("fever")}, ไอ ${symCount("cough")}, เจ็บคอ ${symCount("sore_throat")}, ปวดเมื่อย ${symCount("myalgia")}, ปวดศีรษะ ${symCount("headache")}, มีน้ำมูก ${symCount("runny_nose")}`
      : `อาการทางเดินอาหาร: ถ่ายเหลว ${symCount("diarrhea")}, อาเจียน ${symCount("vomiting")}, ปวดท้อง ${symCount("abdominal_pain")}, ถ่ายมูกเลือด ${symCount("bloody_stool")}`,
    `กลุ่มเสี่ยง: ${highRisk.length} ราย${highRisk.length ? " (" + highRisk.map((c) => c.assessment.highRisk.join("/")).join("; ") + ")" : ""}`,
    `มีสัญญาณอันตราย: ${severe.length} ราย`,
    ...(cl.disease === "flu" ? [`ได้รับวัคซีนไข้หวัดใหญ่ภายใน 1 ปี: ${vacc}/${cs.length} ราย`] : []),
    `ผลตรวจที่ประชาชนแจ้ง: ${tested.length ? tested.map((c) => describe("test", c.answers.test)).join(", ") : "ยังไม่มี"}`,
    ...(cl.disease === "flu" ? [`${CASE_DEFINITION.incubation}; ${CASE_DEFINITION.contagious}`] : []),
  ].join("\n");
}

export function templateReport(cl: Cluster, today: string): string {
  const f = clusterFacts(cl, today);
  const label = cl.disease === "flu" ? "อาการคล้ายไข้หวัดใหญ่" : cl.disease === "acute_diarrhea" ? "อาการอุจจาระร่วงเฉียบพลัน" : cl.disease === "food_poisoning" ? "อาการที่อาจเกี่ยวข้องกับอาหารเป็นพิษ" : "อาการที่ยังไม่จัดกลุ่ม";
  const advice = cl.disease === "flu"
    ? "ทวนสอบผู้ป่วยและพิจารณาสอบสวนตามนิยามไข้หวัดใหญ่ ตรวจตัวอย่างตามแนวทางเจ้าหน้าที่ และเน้นสุขอนามัยทางเดินหายใจ"
    : "ทวนสอบวันเริ่มป่วย อาการ อาหาร/น้ำที่รับประทานร่วมกัน และประสานเจ้าหน้าที่สาธารณสุขเพื่อพิจารณาสอบสวนตามนิยามโรค";
  return `## ร่างรายงานการตรวจสอบข่าว: ${label} ${cl.place}

### ข้อเท็จจริงจากระบบ
${f
  .split("\n")
  .map((l) => `- ${l}`)
  .join("\n")}

### การประเมินความเสี่ยง
- ${cl.disease === "flu" ? (cl.meetsOutbreak ? "พบผู้ป่วยสงสัยตั้งแต่ 5 รายขึ้นไปภายใน 1 สัปดาห์ในสถานที่เดียวกัน **เข้าเกณฑ์สอบสวนการระบาด** ตามนิยามไข้หวัดใหญ่" : "ยังไม่ถึงเกณฑ์ไข้หวัดใหญ่ 5 รายใน 1 สัปดาห์ ให้เฝ้าระวังต่อเนื่อง") : "ข้อมูลกลุ่มนี้เป็นเพียงสัญญาณเฝ้าระวัง ไม่ใช้เกณฑ์ไข้หวัดใหญ่แทนเกณฑ์ของโรคนี้"}

### ข้อเสนอแนะการควบคุมโรค (ให้เจ้าหน้าที่พิจารณา)
1. ${advice}
2. ตรวจสอบข้อมูลกับผู้ป่วยและสถานที่ก่อนบันทึกหรือรายงานต่อ
3. แนะนำสุขอนามัยและการป้องกันตามลักษณะอาการ พร้อมประเมินผู้มีอาการรุนแรงให้พบแพทย์
4. เจ้าหน้าที่พิจารณารหัส รง.506 ที่ตรงกับนิยามและแนวทางทางการ

> ร่างนี้สร้างจากข้อมูลที่ประชาชนรายงานเอง ยังไม่ผ่านการยืนยันทางห้องปฏิบัติการ`;
}
