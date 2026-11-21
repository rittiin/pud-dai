import type { AnswerKey, Answers } from "./types";
import { CHRONIC_LABEL, RED_FLAG_LABEL, SYM_LABEL } from "./flu/knowledge";
import { thaiDate } from "./flu/rules";

export const FIELD_LABEL: Record<AnswerKey, string> = {
  consent: "ความยินยอม",
  symptoms: "อาการ",
  feverTemp: "อุณหภูมิ",
  onsetDate: "วันเริ่มป่วย",
  status: "อาการตอนนี้",
  redFlags: "สัญญาณอันตราย",
  age: "อายุ",
  sex: "เพศ",
  pregnant: "ตั้งครรภ์",
  chronic: "โรคประจำตัว",
  sickContact: "มีคนรอบตัวป่วย",
  placeName: "สถานที่",
  placeSickCount: "จำนวนคนป่วยที่สถานที่",
  poultry: "สัมผัสสัตว์ปีกป่วย/ตาย",
  travel: "เดินทางจากพื้นที่ระบาด",
  hcw: "บุคลากรการแพทย์",
  vaccinated: "วัคซีนไข้หวัดใหญ่",
  test: "ผลตรวจ",
  province: "จังหวัด",
  district: "อำเภอ",
  phone: "เบอร์โทร",
};

const CONTACT = { household: "คนในบ้าน", school: "ที่โรงเรียน", work: "ที่ทำงาน", other: "ที่อื่น", none: "ไม่มี", unknown: "ไม่แน่ใจ" };
const VACC = { yes_1y: "ฉีดภายใน 1 ปี", yes_old: "เคยฉีด นานกว่า 1 ปี", no: "ไม่เคยฉีด", unknown: "จำไม่ได้" };
const TEST = { none: "ยังไม่ได้ตรวจ", rapid_pos_a: "ชุดตรวจเร็ว: Flu A", rapid_pos_b: "ชุดตรวจเร็ว: Flu B", pcr_pos: "RT-PCR บวก", neg: "ตรวจแล้วไม่พบเชื้อ" };
const STATUS = { sick: "ยังป่วย", better: "ดีขึ้น", recovered: "หายแล้ว" };

export function describe<K extends AnswerKey>(key: K, v: Answers[K]): string {
  if (v === undefined) return "-";
  if (v === null) return key === "phone" ? "ไม่ให้" : "ไม่ทราบ";
  switch (key) {
    case "symptoms":
      return (v as string[]).length ? (v as (keyof typeof SYM_LABEL)[]).map((s) => SYM_LABEL[s]).join(", ") : "ไม่มี";
    case "redFlags":
      return (v as string[]).length ? (v as (keyof typeof RED_FLAG_LABEL)[]).map((s) => RED_FLAG_LABEL[s]).join(", ") : "ไม่มี";
    case "chronic":
      return (v as string[]).length ? (v as (keyof typeof CHRONIC_LABEL)[]).map((s) => CHRONIC_LABEL[s]).join(", ") : "ไม่มี";
    case "onsetDate":
      return thaiDate(v as string);
    case "feverTemp":
      return `${v} °C`;
    case "age":
      return `${v} ปี`;
    case "sex":
      return v === "M" ? "ชาย" : "หญิง";
    case "status":
      return STATUS[v as keyof typeof STATUS];
    case "sickContact":
      return CONTACT[v as keyof typeof CONTACT];
    case "vaccinated":
      return VACC[v as keyof typeof VACC];
    case "test":
      return TEST[v as keyof typeof TEST];
    case "placeSickCount":
      return `${v} คนขึ้นไป`;
    default:
      return typeof v === "boolean" ? (v ? "ใช่/มี" : "ไม่ใช่/ไม่มี") : String(v);
  }
}
