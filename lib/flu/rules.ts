// Deterministic rules. AI never decides classification or urgency — these functions do,
// and each one is traceable to the DDC case definition (see knowledge.ts).
import type { Alert, Answers, Assessment, Classification, DiseaseFocus, Urgency } from "../types";
import { CHRONIC_LABEL, COMPANION_SYMS, DISEASE_CATALOG, EMERGENCY_FLAGS, SYM_LABEL } from "./knowledge";

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

/** Each pattern is a screening rule, not a diagnosis. */
export function clinicalCriteria(a: Answers): { meets: boolean; reason: string } {
  const s = a.symptoms ?? [];
  const focus = a.diseaseFocus ?? "flu";
  if (focus === "unknown") {
    const anySymptom = s.length > 0;
    return { meets: anySymptom, reason: anySymptom ? "มีอาการที่ผู้ใช้รายงาน · ยังไม่จัดเข้ากลุ่มโรค" : "ไม่พบอาการในรายการ" };
  }
  if (focus === "acute_diarrhea") {
    const meets = (a.stoolCount ?? 0) >= 3 || s.includes("bloody_stool");
    return { meets, reason: `ถ่ายเหลว ${a.stoolCount === undefined ? "ยังไม่ทราบจำนวน" : `${a.stoolCount} ครั้ง/24 ชม.`} · ถ่ายมูกเลือด ${s.includes("bloody_stool") ? "มี" : "ไม่มี/ไม่ระบุ"}` };
  }
  if (focus === "food_poisoning") {
    // DDC: nausea, vomiting, abdominal pain (diarrhoea optional) + history of suspect food.
    const hasCore = s.includes("vomiting") || s.includes("abdominal_pain");
    const meets = hasCore && a.sharedMeal === true;
    return { meets, reason: `อาเจียนหรือปวดท้อง ${hasCore ? "มี" : "ไม่มี/ไม่ระบุ"} · กินอาหารที่สงสัยปนเปื้อน ${a.sharedMeal === true ? "ใช่" : a.sharedMeal === false ? "ไม่ใช่" : "ยังไม่ทราบ"} · ต้องให้เจ้าหน้าที่สอบสวน` };
  }
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
  const focus = a.diseaseFocus ?? "flu";
  const test = a.test ?? "none";
  const testDisease: DiseaseFocus | undefined = ["pcr_pos", "rapid_pos_a", "rapid_pos_b"].includes(test) ? "flu" : undefined;
  const disease: DiseaseFocus = focus === "unknown" && testDisease ? testDisease : focus;
  // A positive test never replaces the clinical criteria: every DDC class requires them.
  const { meets, reason } = clinicalCriteria({ ...a, diseaseFocus: disease });
  const highRisk = highRiskReasons(a);
  const s = a.symptoms ?? [];
  const flags = a.redFlags ?? [];
  const respiratory = s.includes("fever") || s.includes("cough");

  let classification: Classification = "not_case";
  if (meets) {
    const matchingPositive = disease === "flu" && ["pcr_pos", "rapid_pos_a", "rapid_pos_b"].includes(test);
    const confirmatory = test === "pcr_pos";
    if (matchingPositive && confirmatory) classification = "confirmed";
    else if (matchingPositive && disease === "flu") classification = "probable";
    else classification = "suspected";
  }

  let urgency: Urgency = "selfcare";
  if (flags.some((f) => EMERGENCY_FLAGS.includes(f))) urgency = "emergency";
  else if (a.status === "recovered") urgency = "recovered";
  else if (a.poultry && respiratory) urgency = "urgent";
  else if (highRisk.length && respiratory) urgency = "urgent";
  else if (flags.length) urgency = "soon";
  // Bloody stool, or diarrhoea/vomiting in a high-risk person, needs a doctor within 24 h.
  else if (s.includes("bloody_stool") || (highRisk.length && s.some((x) => ["diarrhea", "vomiting"].includes(x)))) urgency = "soon";

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
  if (a.onsetDate && disease === "flu") {
    const child = a.age !== undefined && a.age < 12;
    contagiousUntil = addDays(a.onsetDate, child ? 7 : 5);
    hoursSinceOnset = Math.max(0, daysBetween(a.onsetDate, today) * 24);
  }

  return {
    disease,
    surveillanceCode: DISEASE_CATALOG[disease].code,
    meetsClinical: meets,
    clinicalReason: reason,
    classification,
    urgency,
    highRisk,
    alerts,
    contagiousUntil,
    hoursSinceOnset,
  };
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
