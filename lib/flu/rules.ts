// Deterministic rules. AI never decides classification or urgency — these functions do,
// and each one is traceable to the DDC case definition (see knowledge.ts).
import type { Alert, Answers, Assessment, Classification, Urgency } from "../types";
import { CHRONIC_LABEL, COMPANION_SYMS, EMERGENCY_FLAGS, SYM_LABEL } from "./knowledge";

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return todayISO(dt);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function thaiDate(iso?: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

/** Clinical criterion: fever + cough + at least one companion symptom. */
export function clinicalCriteria(a: Answers): { meets: boolean; reason: string } {
  const s = a.symptoms ?? [];
  const hasFever = s.includes("fever");
  const hasCough = s.includes("cough");
  const companions = COMPANION_SYMS.filter((x) => s.includes(x));
  const meets = hasFever && hasCough && companions.length > 0;
  const parts = [
    `ไข้ ${hasFever ? "✓" : "✗"}`,
    `ไอ ${hasCough ? "✓" : "✗"}`,
    `อาการร่วม ${companions.length ? "✓ (" + companions.map((c) => SYM_LABEL[c]).join(", ") + ")" : "✗"}`,
  ];
  return { meets, reason: parts.join(" · ") };
}

export function highRiskReasons(a: Answers): string[] {
  const r: string[] = [];
  if (a.age !== undefined && a.age >= 65) r.push("อายุ 65 ปีขึ้นไป");
  if (a.age !== undefined && a.age < 2) r.push("เด็กอายุต่ำกว่า 2 ปี");
  if (a.pregnant) r.push("ตั้งครรภ์");
  for (const c of a.chronic ?? []) r.push(CHRONIC_LABEL[c]);
  return r;
}

export function assess(a: Answers, today = todayISO()): Assessment {
  const { meets, reason } = clinicalCriteria(a);
  const highRisk = highRiskReasons(a);
  const s = a.symptoms ?? [];
  const flags = a.redFlags ?? [];
  const respiratory = s.includes("fever") || s.includes("cough");

  let classification: Classification = "not_case";
  if (meets) {
    if (a.test === "pcr_pos") classification = "confirmed";
    else if (a.test === "rapid_pos_a" || a.test === "rapid_pos_b") classification = "probable";
    else classification = "suspected";
  }

  let urgency: Urgency = "selfcare";
  if (flags.some((f) => EMERGENCY_FLAGS.includes(f))) urgency = "emergency";
  else if (a.status === "recovered") urgency = "recovered";
  else if (a.poultry && respiratory) urgency = "urgent";
  else if (highRisk.length && respiratory) urgency = "urgent";
  else if (flags.length) urgency = "soon";

  const alerts: Alert[] = [];
  if (urgency === "emergency")
    alerts.push({ level: "red", code: "severe", text: "มีสัญญาณอันตราย ควรติดตามว่าได้รับการรักษาแล้ว" });
  if (a.poultry)
    alerts.push({
      level: "red",
      code: "avian",
      text: "สัมผัสสัตว์ปีกป่วยหรือตายใน 14 วัน ต้องพิจารณาไข้หวัดนก (โรคติดต่ออันตราย) และสอบสวนทันที",
    });
  if (a.travel) alerts.push({ level: "amber", code: "travel", text: "เดินทางจากพื้นที่ระบาดใน 14 วันก่อนป่วย" });
  if (a.hcw) alerts.push({ level: "amber", code: "hcw", text: "เป็นบุคลากรทางการแพทย์" });
  if (a.placeSickCount && a.placeSickCount >= 5)
    alerts.push({
      level: "amber",
      code: "cluster_signal",
      text: `ผู้รายงานแจ้งว่ามีผู้ป่วย 5 คนขึ้นไปที่ "${a.placeName ?? "ไม่ระบุ"}" เป็นสัญญาณกลุ่มก้อน`,
    });
  if (highRisk.length && meets && a.status !== "recovered")
    alerts.push({ level: "amber", code: "high_risk", text: `กลุ่มเสี่ยง: ${highRisk.join(", ")}` });

  let contagiousUntil: string | undefined;
  let hoursSinceOnset: number | undefined;
  if (a.onsetDate) {
    const child = a.age !== undefined && a.age < 12;
    contagiousUntil = addDays(a.onsetDate, child ? 7 : 5);
    hoursSinceOnset = Math.max(0, daysBetween(a.onsetDate, today) * 24);
  }

  return { meetsClinical: meets, clinicalReason: reason, classification, urgency, highRisk, alerts, contagiousUntil, hoursSinceOnset };
}

export const CLASS_LABEL: Record<Classification, string> = {
  not_case: "ไม่เข้าเกณฑ์",
  suspected: "ผู้ป่วยสงสัย",
  probable: "ผู้ป่วยเข้าข่าย",
  confirmed: "ผู้ป่วยยืนยัน",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: "ฉุกเฉิน",
  urgent: "พบแพทย์วันนี้",
  soon: "พบแพทย์ภายใน 24 ชม.",
  selfcare: "ดูแลตัวเองที่บ้าน",
  recovered: "หายแล้ว",
};
