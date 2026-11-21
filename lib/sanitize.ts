// Keeps only values that match the schema, whatever the source (keyword, AI or client).
import type { Answers } from "./types";

const SYMS = ["fever", "cough", "sore_throat", "runny_nose", "myalgia", "headache", "fatigue", "chills", "sputum", "diarrhea", "vomiting", "abdominal_pain", "bloody_stool"];
const FLAGS = ["dyspnea", "chest_pain", "confusion", "cyanosis", "cannot_drink", "seizure", "worse_again", "high_fever_3d", "severe_dehydration", "child_fast_breathing", "child_ribs", "child_no_urine", "child_not_alert", "child_severe_muscle_pain", "infant_fever"];
const CHRONIC = ["lung", "heart", "kidney", "liver", "diabetes", "immuno", "cancer", "obesity", "neuro"];

const arr = (v: unknown, allowed: string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : undefined;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && v >= min && v <= max ? v : undefined);
const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export function sanitize(input: Record<string, unknown>): Partial<Answers> {
  const out: Partial<Answers> = {
    consent: bool(input.consent),
    symptoms: arr(input.symptoms, SYMS) as Answers["symptoms"],
    feverTemp: num(input.feverTemp, 34, 43),
    onsetDate: typeof input.onsetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.onsetDate) ? input.onsetDate : undefined,
    status: oneOf(input.status, ["sick", "better", "recovered"] as const),
    redFlags: arr(input.redFlags, FLAGS) as Answers["redFlags"],
    age: num(input.age, 0, 120),
    sex: oneOf(input.sex, ["M", "F"] as const),
    pregnant: bool(input.pregnant),
    chronic: arr(input.chronic, CHRONIC) as Answers["chronic"],
    sickContact: oneOf(input.sickContact, ["household", "school", "work", "other", "none", "unknown"] as const),
    placeName: str(input.placeName),
    placeSickCount: input.placeSickCount === null ? null : num(input.placeSickCount, 0, 10000),
    poultry: bool(input.poultry),
    travel: bool(input.travel),
    hcw: bool(input.hcw),
    vaccinated: oneOf(input.vaccinated, ["yes_1y", "yes_old", "no", "unknown"] as const),
    test: oneOf(input.test, ["none", "rapid_pos_a", "rapid_pos_b", "pcr_pos", "neg"] as const),
    diseaseFocus: oneOf(input.diseaseFocus, ["flu", "acute_diarrhea", "food_poisoning", "unknown"] as const),
    stoolCount: num(input.stoolCount, 0, 100),
    sharedMeal: input.sharedMeal === null ? null : bool(input.sharedMeal),
    province: str(input.province, 40),
    district: str(input.district, 40),
    phone: input.phone === null ? null : str(input.phone, 20),
  };
  for (const k of Object.keys(out) as (keyof Answers)[]) if (out[k] === undefined) delete out[k];
  return out;
}
