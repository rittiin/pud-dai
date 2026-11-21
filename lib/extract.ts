// Turns free Thai text ("ไข้ 39 ไอ ปวดตัว เริ่มเมื่อวาน ที่โรงเรียนเป็นหลายคน") into structured answers.
// Keyword mode works offline; AI mode (lib/ai.ts) uses OpenAI when enabled.
// Both modes must return a verbatim quote as evidence for every field.
import type { Answers, Chronic, Evidence, RedFlag, Sym } from "./types";
import { addDays, todayISO } from "./flu/rules";

export interface Extraction {
  answers: Partial<Answers>;
  evidence: Evidence;
}

function quoteAround(text: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  const start = Math.max(0, i - 12);
  const end = Math.min(text.length, i + m[0].length + 12);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

const SYM_RX: [Sym, RegExp][] = [
  ["fever", /ไข้(?!หวัด)|ตัวร้อน|ตัวฮ้อน|มีไข้|ไข้หวัด/],
  ["cough", /ไอ(?!ที)/],
  ["sore_throat", /เจ็บคอ|แสบคอ|คอแห้ง|กลืนเจ็บ/],
  ["runny_nose", /น้ำมูก|น้ํามูก|คัดจมูก|จมูกตัน/],
  ["myalgia", /ปวดแข้งปวดขา|ปวดแขนขา|ปวดเมื่อย|ปวดตัว|เมื่อยตัว|ปวดกล้ามเนื้อ|ปวดตามตัว|ปวดเนื้อปวดตัว/],
  ["headache", /เจ็บหัว|ปวดหัว|ปวดศีรษะ|ปวดศรีษะ|มึนหัว/],
  ["fatigue", /บ่มีแฮง|ไม่มีแฮง|บ่มีแรง|อ่อนเพลีย|เพลีย|ไม่มีแรง|หมดแรง|อ่อนแรง/],
  ["chills", /หนาวสั่น|หนาวๆร้อนๆ|หนาว ๆ ร้อน ๆ/],
  ["sputum", /เสมหะ|เสลด/],
  ["diarrhea", /ท้องเสีย|ถ่ายเหลว|ท้องร่วง|ถ่ายเป็นน้ำ/],
  ["vomiting", /อาเจียน|อ้วก|อ๊วก/],
  ["abdominal_pain", /ปวดท้อง|เจ็บท้อง|จุกท้อง/],
  ["bloody_stool", /ถ่าย.{0,5}(มูกเลือด|เลือดปน)|มูกเลือด.{0,5}ถ่าย/],
];

const NEGATED_SYMPTOM_PREFIX = /(?:ไม่(?:ได้|ค่อยมี|มี|เป็น)?|ไม่มี|บ่(?:ได้|มี|เป็น|ค่อยมี)?|บ่ค่อย)\s*$/;

function findAffirmedMatch(text: string, rx: RegExp): RegExpMatchArray | null {
  const scan = new RegExp(rx.source, `${rx.flags.replace(/[gy]/g, "")}g`);
  let m: RegExpExecArray | null;
  while ((m = scan.exec(text))) {
    const prefix = text.slice(Math.max(0, m.index - 12), m.index);
    if (!NEGATED_SYMPTOM_PREFIX.test(prefix)) return m;
  }
  return null;
}

const FLAG_RX: [RedFlag, RegExp][] = [
  ["dyspnea", /หายใจ(ลำบาก|ไม่ทัน|ไม่อิ่ม|ไม่สะดวก|เหนื่อย)|หอบ/],
  ["chest_pain", /เจ็บหน้าอก|แน่นหน้าอก|เจ็บอก/],
  ["confusion", /ซึม|สับสน|ปลุกไม่ตื่น/],
  ["cyanosis", /ปากเขียว|ตัวเขียว|ปลายมือเขียว/],
  ["cannot_drink", /กินไม่ได้|ดื่มน้ำไม่ได้|กินข้าวไม่ได้/],
  ["severe_dehydration", /ปากแห้งมาก|ปัสสาวะ(น้อยมาก|ไม่ออก)|ซึมมาก.{0,5}(ขาดน้ำ|ถ่าย)|ขาดน้ำรุนแรง/],
  ["seizure", /ชัก/],
];

const CHRONIC_RX: [Chronic, RegExp][] = [
  ["diabetes", /เบาหวาน/],
  ["heart", /โรคหัวใจ|หัวใจ/],
  ["kidney", /โรคไต|ไตวาย|ฟอกไต/],
  ["liver", /ตับแข็ง|โรคตับ/],
  ["lung", /หอบหืด|ถุงลมโป่งพอง|copd|โรคปอด/i],
  ["immuno", /ภูมิคุ้มกันบกพร่อง|hiv|เอชไอวี|กินยากดภูมิ/i],
  ["cancer", /มะเร็ง|เคมีบำบัด/],
  ["obesity", /อ้วนมาก/],
];

export function keywordExtract(text: string, today = todayISO()): Extraction {
  const t = text.replace(/\s+/g, " ").trim();
  const answers: Partial<Answers> = {};
  const evidence: Evidence = {};
  let m: RegExpMatchArray | null;
  const set = <K extends keyof Answers>(k: K, v: Answers[K], m: RegExpMatchArray) => {
    answers[k] = v;
    evidence[k] = { quote: quoteAround(t, m), via: "text" };
  };

  const diseaseMatch = t.match(/อาหารเป็นพิษ/) ?? t.match(/อุจจาระร่วงเฉียบพลัน|ท้องเสียเฉียบพลัน/) ?? t.match(/ไข้หวัดใหญ่/);
  if (diseaseMatch) {
    const focus = /อาหารเป็นพิษ/.test(diseaseMatch[0]) ? "food_poisoning" : /อุจจาระร่วง|ท้องเสีย/.test(diseaseMatch[0]) ? "acute_diarrhea" : "flu";
    set("diseaseFocus", focus, diseaseMatch);
  }

  // symptoms
  const syms: Sym[] = [];
  let firstSymMatch: RegExpMatchArray | null = null;
  for (const [s, rx] of SYM_RX) {
    const m = findAffirmedMatch(t, rx);
    if (m) {
      syms.push(s);
      firstSymMatch ??= m;
    }
  }
  if (syms.length && firstSymMatch) {
    answers.symptoms = syms;
    evidence.symptoms = { quote: t.length > 80 ? t.slice(0, 80) + "…" : t, via: "text" };
  }

  if ((m = t.match(/(?:ถ่าย|อุจจาระ|ท้องเสีย|ท้องร่วง).{0,12}(\d{1,2})\s*ครั้ง|\b(\d{1,2})\s*ครั้ง.{0,12}(?:ถ่าย|อุจจาระ)/))) {
    set("stoolCount", Number(m[1] ?? m[2]), m);
  }
  if ((m = t.match(/(กิน|ทาน|รับประทาน).{0,15}(อาหาร|มื้อ).{0,12}(ร่วมกัน|เหมือนกัน|เดียวกัน)|กินอาหาร.{0,15}แล้ว.{0,15}(ท้องเสีย|อาเจียน)/))) {
    set("sharedMeal", true, m);
  } else if ((m = t.match(/ไม่ได้กิน.{0,10}(อาหาร|มื้อเดียวกัน)|ไม่มีใครกินร่วม/))) set("sharedMeal", false, m);

  const temp = t.match(/(?<!\d)(3[7-9]|4[0-2])([.,]\d)?(?!\d)(?!\s*(?:ปี|ขวบ|คน|วัน|เดือน|กก|กิโล))\s*(องศา|°|c\b)?/i);
  const afterAge = temp ? /อายุ\s*$/.test(t.slice(0, temp.index)) : false;
  if (temp && !afterAge && (temp[3] || /ไข้|วัด/.test(t))) {
    set("feverTemp", parseFloat(temp[0].replace(",", ".")), temp);
    if (!syms.includes("fever") && parseFloat(temp[0]) >= 37.5) {
      answers.symptoms = [...(answers.symptoms ?? []), "fever"];
      evidence.symptoms ??= { quote: quoteAround(t, temp), via: "text" };
    }
  }

  // red flags
  const flags: RedFlag[] = [];
  let flagM: RegExpMatchArray | null = null;
  for (const [f, rx] of FLAG_RX) {
    const m = t.match(rx);
    if (m) {
      flags.push(f);
      flagM ??= m;
    }
  }
  if (flags.length && flagM) set("redFlags", flags, flagM);

  // onset
  if ((m = t.match(/เมื่อวานซืน|วานซืน|(?:สอง|2)\s*วัน(?:ที่แล้ว|ก่อน)/))) set("onsetDate", addDays(today, -2), m);
  else if ((m = t.match(/(?:สอง|2)\s*มื้อ(?:แล้ว|ก่อน|ที่แล้ว|มาแล้ว)?/))) set("onsetDate", addDays(today, -2), m);
  else if ((m = t.match(/มื้อวาน(?:นี้)?|แต่วานนี้|วานนี้|เมื่อวาน(?:นี้)?/))) set("onsetDate", addDays(today, -1), m);
  else if ((m = t.match(/(\d{1,2})\s*วัน\s*(ที่แล้ว|ก่อน|แล้ว)/))) set("onsetDate", addDays(today, -parseInt(m[1])), m);
  else if ((m = t.match(/(เริ่ม|เป็น)[^ ]{0,6}วันนี้|ตั้งแต่เช้า|เมื่อเช้า/))) set("onsetDate", today, m);
  else if ((m = t.match(/(\d{1,2})\s*สัปดาห์\s*(ที่แล้ว|ก่อน)/))) set("onsetDate", addDays(today, -7 * parseInt(m[1])), m);

  // status
  if ((m = t.match(/หายแล้ว|หายดีแล้ว|ตอนนี้หาย/))) set("status", "recovered", m);
  else if ((m = t.match(/ดีขึ้น/))) set("status", "better", m);

  // age
  if ((m = t.match(/อายุ\s*(\d{1,3})/)) || (m = t.match(/(\d{1,3})\s*(ขวบ|ปี)(?!ที่แล้ว)/))) {
    const n = parseInt(m[1]);
    if (n > 0 && n < 120) set("age", n, m);
  } else if ((m = t.match(/(\d{1,2})\s*เดือน/)) && /ลูก|เด็ก|ทารก/.test(t)) {
    set("age", 0, m);
  }

  if ((m = t.match(/ตั้งครรภ์|ตั้งท้อง|กำลังท้อง/))) set("pregnant", true, m);

  // chronic disease
  const chronic: Chronic[] = [];
  let chM: RegExpMatchArray | null = null;
  for (const [c, rx] of CHRONIC_RX) {
    const mm = t.match(rx);
    if (mm) {
      chronic.push(c);
      chM ??= mm;
    }
  }
  if (/ไม่มีโรคประจำตัว/.test(t)) set("chronic", [], t.match(/ไม่มีโรคประจำตัว/)!);
  else if (chronic.length && chM) set("chronic", chronic, chM);

  // contacts / cluster setting
  if ((m = t.match(/โรงเรียน[^\s,]*|ห้องเรียน|เพื่อนร่วมชั้น|เพื่อนในห้อง/))) {
    set("sickContact", "school", m);
    const name = t.match(/โรงเรียน[ก-๙a-zA-Z0-9]+/);
    // Thai has no spaces between words: cut the name at common verbs/particles ("โรงเรียนก็ป่วย…")
    const clean = name?.[0].split(/(ก็|ป่วย|เป็น|มี|ด้วย|หลาย|ครับ|ค่ะ|คะ|นะ)/)[0];
    if (name && clean && clean.length > 9) set("placeName", clean, name);
  } else if ((m = t.match(/ที่ทำงาน|ออฟฟิศ|เพื่อนร่วมงาน|โรงงาน[ก-๙]*/))) set("sickContact", "work", m);
  else if ((m = t.match(/คนในบ้าน|ที่บ้าน.{0,10}(ป่วย|เป็น)|(ลูก|แม่|พ่อ|สามี|ภรรยา|แฟน|พี่|น้อง).{0,8}(ป่วย|เป็นด้วย|ก็เป็น)/))) set("sickContact", "household", m);

  if ((m = t.match(/(\d{1,3})\s*คน/)) && answers.sickContact) set("placeSickCount", parseInt(m[1]), m);
  else if ((m = t.match(/เป็นกันหลายคน|ป่วยหลายคน|เป็นหลายคน|ป่วยกันเยอะ/))) {
    if (!answers.sickContact) set("sickContact", "other", m);
  }

  if ((m = t.match(/(ไก่|เป็ด|สัตว์ปีก|ฝูงนก|นกพิราบ).{0,15}(ตาย|ป่วย)|(ชำแหละ|จับ).{0,6}(ไก่|เป็ด)/))) set("poultry", true, m);
  if ((m = t.match(/ไม่(ได้|เคย)ฉีดวัคซีน/))) set("vaccinated", "no", m);
  else if ((m = t.match(/ฉีดวัคซีน(ไข้หวัดใหญ่)?.{0,10}(ปีนี้|แล้ว)/))) set("vaccinated", "yes_1y", m);

  if ((m = t.match(/(ตรวจ|atk|ชุดตรวจ).{0,20}(สายพันธุ์\s*)?(a|เอ)\b/i))) set("test", "rapid_pos_a", m);
  else if ((m = t.match(/(ตรวจ|atk|ชุดตรวจ).{0,20}(สายพันธุ์\s*)?(b|บี)\b/i))) set("test", "rapid_pos_b", m);
  else if ((m = t.match(/pcr/i))) set("test", "pcr_pos", m);

  const prov = t.match(/จังหวัด\s*([ก-๙]+)|จ\.\s*([ก-๙]+)/);
  if (prov) set("province", (prov[1] ?? prov[2]).trim(), prov);
  const dist = t.match(/อำเภอ\s*([ก-๙]+)|อ\.\s*([ก-๙]+)|เขต\s*([ก-๙]+)/);
  if (dist) set("district", (dist[1] ?? dist[2] ?? dist[3]).trim(), dist);

  return { answers, evidence };
}

/**
 * Final safety pass over merged keyword + AI results (runs in both modes).
 * Returns the names of fields it removed, so the chat simply asks for them instead.
 */
export function postCheck(text: string, answers: Partial<Answers>, evidence: Evidence): string[] {
  const dropped: string[] = [];
  const drop = (k: keyof Answers, why: string) => {
    delete answers[k];
    delete evidence[k];
    dropped.push(`${k}(${why})`);
  };

  // 1) Numbers must literally appear in the quoted evidence — no "หลายคน" → 5.
  for (const k of ["age", "placeSickCount", "feverTemp"] as const) {
    const v = answers[k];
    if (typeof v !== "number") continue;
    const q = evidence[k]?.quote ?? "";
    const digits = String(v).split(".")[0];
    if (!q.includes(digits) && !(k === "age" && v === 0 && /เดือน/.test(q))) drop(k, "ไม่มีตัวเลขในข้อความ");
  }

  // 2) Someone else is also sick and the age/sex sits next to a relative word → it may be theirs, not the patient's.
  const othersSick = /ก็เป็น|เป็นเหมือนกัน|ก็ป่วย|ป่วยด้วย|เป็นด้วย|ติดมาจาก/.test(text);
  const RELATIVE = /ลูก|หลาน|เพื่อน|ครู|น้อง|พี่|พ่อ|แม่|สามี|ภรรยา|แฟน|ยาย|ตา|ปู่|ย่า/;
  if (othersSick) {
    for (const k of ["age", "sex"] as const) {
      if (answers[k] === undefined) continue;
      const q = (evidence[k]?.quote ?? "").replace(/^…|…$/g, "");
      const at = Math.max(0, text.indexOf(q));
      const window = text.slice(Math.max(0, at - 12), at + q.length);
      if (RELATIVE.test(window)) drop(k, "อาจเป็นของคนอื่น");
    }
  }
  return dropped;
}
